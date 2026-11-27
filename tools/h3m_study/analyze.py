import sys, os, collections, statistics as st, json
sys.path.insert(0, os.path.dirname(__file__)); import h3m
OBST = set(range(116, 162)) | {177, 199} | set(range(206, 212))
MONS = {54, 71, 72, 73, 74, 75, 162, 163, 164}
CAT = {}
for i in OBST: CAT[i] = 'obst'
for i in MONS: CAT[i] = 'monster'
CAT.update({98: 'town', 77: 'town', 53: 'mine', 220: 'mine', 76: 'pile', 79: 'pile', 101: 'chest', 12: 'pile', 29: 'sea', 82: 'sea', 5: 'art', 65: 'art', 66: 'art', 67: 'art', 68: 'art', 69: 'art', 93: 'art',
            17: 'dwell', 18: 'dwell', 19: 'dwell', 20: 'dwell', 216: 'dwell', 217: 'dwell', 218: 'dwell', 16: 'bank', 24: 'bank', 25: 'bank', 84: 'bank', 85: 'bank', 34: 'hero', 70: 'hero', 26: 'event', 6: 'pandora', 8: 'boat', 0: 'skip', 214: 'hero',
            9: 'gate', 212: 'gate', 10: 'key', 215: 'gate', 33: 'garrison', 219: 'garrison', 36: 'skip', 43: 'teleport', 44: 'teleport', 45: 'teleport', 103: 'teleport', 111: 'sea', 11: 'sea', 21: 'sea'})
def cat(o): return CAT.get(o['id'], 'site')

def offsets(m, blocked):
    out = []
    for i in range(6):
        for j in range(8):
            bit = (m[i] >> j) & 1
            if (bit == 0) if blocked else (bit == 1): out.append((-(7 - j), -(5 - i)))
    return out

def analyze(path):
    M = h3m.parse(path); N = M['N']; res = []
    for z in range(M['levels']):
        T = M['tiles'][z]
        land = [t[0] not in (8, 9) for t in T]          # not water, not rock
        road = [t[4] != 0 for t in T]
        blk = [False] * (N * N); obst = [False] * (N * N)
        objs = [o for o in M['objs'] if o['z'] == z]
        info = []
        for o in objs:
            D = M['defs'][o['dn']]; c = cat(o)
            bl = [(o['x'] + dx, o['y'] + dy) for dx, dy in offsets(D['block'], True)]
            vi = [(o['x'] + dx, o['y'] + dy) for dx, dy in offsets(D['visit'], False)]
            for x, y in bl:
                if 0 <= x < N and 0 <= y < N:
                    blk[y * N + x] = True
                    if c == 'obst': obst[y * N + x] = True
            info.append((o, c, bl, vi))
        nl = sum(land)
        if nl < 200: continue
        R = {'map': M['name'], 'N': N, 'z': z, 'land': nl}
        R['obst_cover'] = sum(1 for i in range(N * N) if land[i] and obst[i]) / nl
        R['block_cover'] = sum(1 for i in range(N * N) if land[i] and blk[i]) / nl
        R['road_frac'] = sum(1 for i in range(N * N) if land[i] and road[i]) / nl
        cnt = collections.Counter(c for o, c, bl, vi in info)
        for k in ('mine', 'pile', 'chest', 'art', 'dwell', 'bank', 'site', 'monster', 'town'):
            R['per1k_' + k] = cnt[k] * 1000 / nl
        R['sites_kinds'] = len(set(o['id'] for o, c, bl, vi in info if c == 'site'))
        towns = [(vi[0] if vi else (o['x'], o['y'])) for o, c, bl, vi in info if c == 'town']
        mons = [(o['x'], o['y']) for o, c, bl, vi in info if c == 'monster']
        def dist(a, b): return max(abs(a[0] - b[0]), abs(a[1] - b[1]))
        def guarded(p, r=2): return any(dist(p, m) <= r for m in mons)
        def nearroad(p, r):
            x0, y0 = p
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    x, y = x0 + dx, y0 + dy
                    if 0 <= x < N and 0 <= y < N and road[y * N + x]: return True
            return False
        for k in ('mine', 'art', 'bank', 'dwell', 'pile', 'chest', 'site'):
            vs = [vi[0] for o, c, bl, vi in info if c == k and vi]
            if vs:
                R['guard_' + k] = sum(guarded(p) for p in vs) / len(vs)
                R['road2_' + k] = sum(nearroad(p, 2) for p in vs) / len(vs)
        # monsters on roads / near roads
        if mons: R['mon_onroad'] = sum(road[y * N + x] for x, y in mons if 0 <= x < N and 0 <= y < N) / len(mons)
        # mines: distance from the nearest town by kind
        md = collections.defaultdict(list)
        for o, c, bl, vi in info:
            if c == 'mine' and vi and towns and o['id'] == 53: md[o['sub']].append(min(dist(vi[0], t) for t in towns))
        R['mine_dist'] = {k: st.median(v) for k, v in md.items()}
        # nearest-neighbour spacing between visitable non-obstacle objects
        vis = [vi[0] for o, c, bl, vi in info if vi and c not in ('obst', 'monster', 'sea', 'event', 'hero', 'skip')]
        if len(vis) > 3:
            R['nn_vis'] = st.median(min(dist(a, b) for b in vis if b is not a) for a in vis)
        # what lies behind (above) a visitable site: blocked tiles in the 3x2 band above its footprint
        back = []; sides = collections.Counter()
        for o, c, bl, vi in info:
            if c in ('site', 'mine', 'bank', 'dwell') and vi and bl:
                xs = [x for x, y in bl]; ys = [y for x, y in bl]
                band = [(x, min(ys) - 1) for x in range(min(xs) - 1, max(xs) + 2)]
                band = [(x, y) for x, y in band if 0 <= x < N and 0 <= y < N]
                if band: back.append(sum(blk[y * N + x] for x, y in band) / len(band))
                # where the visit tile sits relative to the footprint
                v = vi[0]; cx = (min(xs) + max(xs)) / 2
                sides['left' if v[0] < cx - 0.25 else 'right' if v[0] > cx + 0.25 else 'mid'] += 1
                # road relative to the visit tile
        if back: R['back_blocked'] = st.mean(back)
        R['visit_side'] = dict(sides)
        # obstacle clusters (8-connected) sizes, and composition
        seen = [False] * (N * N); sizes = []
        for i in range(N * N):
            if obst[i] and not seen[i]:
                stack = [i]; seen[i] = True; n = 0
                while stack:
                    j = stack.pop(); n += 1; x, y = j % N, j // N
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            xx, yy = x + dx, y + dy
                            if 0 <= xx < N and 0 <= yy < N and obst[yy * N + xx] and not seen[yy * N + xx]: seen[yy * N + xx] = True; stack.append(yy * N + xx)
                sizes.append(n)
        sizes.sort()
        R['clusters'] = len(sizes) * 1000 / nl
        R['cluster_med'] = st.median(sizes) if sizes else 0
        R['cluster_big_share'] = sum(s for s in sizes if s >= 30) / max(1, sum(sizes))
        comp = collections.Counter(o['id'] for o, c, bl, vi in info if c == 'obst')
        R['obst_mix'] = {('mountain' if k == 134 else 'trees' if k in (135, 137, 155, 199) else 'rocks' if k in (147, 136, 206, 207, 208, 209, 210, 211) else 'small'): 0 for k in comp}
        for k, v in comp.items():
            g = 'mountain' if k == 134 else 'trees' if k in (135, 137, 155, 199) else 'rocks' if k in (147, 136, 206, 207, 208, 209, 210, 211) else 'small'
            R['obst_mix'][g] += v
        # free-space corridor width: distance from free land tiles to nearest blocked/non-land tile
        INF = 99; d = [0 if (not land[i] or blk[i]) else INF for i in range(N * N)]
        for i in range(N * N):
            x, y = i % N, i // N
            if d[i]:
                for xx, yy in ((x - 1, y), (x, y - 1), (x - 1, y - 1), (x + 1, y - 1)):
                    if 0 <= xx < N and 0 <= yy < N: d[i] = min(d[i], d[yy * N + xx] + 1)
                    else: d[i] = min(d[i], 1)
        for i in reversed(range(N * N)):
            x, y = i % N, i // N
            if d[i]:
                for xx, yy in ((x + 1, y), (x, y + 1), (x + 1, y + 1), (x - 1, y + 1)):
                    if 0 <= xx < N and 0 <= yy < N: d[i] = min(d[i], d[yy * N + xx] + 1)
                    else: d[i] = min(d[i], 1)
        free = [d[i] for i in range(N * N) if d[i]]
        R['open_med'] = st.median(free) if free else 0
        R['open_p90'] = sorted(free)[int(len(free) * 0.9)] if free else 0
        # terrain variety: distinct land terrain types and their patch count
        tt = collections.Counter(T[i][0] for i in range(N * N) if land[i])
        R['terrains'] = sum(1 for v in tt.values() if v > nl * 0.03)
        res.append(R)
    return res

if __name__ == '__main__':
    D = sys.argv[1]; out = []
    for f in sorted(os.listdir(D)):
        try: out += analyze(os.path.join(D, f))
        except Exception as e: print('fail', f, e)
    json.dump(out, open(sys.argv[2], 'w'))
    print(len(out), 'levels analysed')
