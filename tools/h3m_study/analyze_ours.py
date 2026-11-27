import json, sys, statistics as st, collections
S = json.load(open(sys.argv[1])); out = []
for M in S:
    N = M['N']; land = M['land']; road = M['road']; obst = M['obst'][:]
    blk = obst[:]
    for o in M['objs']:
        for x, y in o['foot']:
            if 0 <= x < N and 0 <= y < N: blk[y * N + x] = True
    nl = sum(land); R = {'map': M['map'], 'N': N}
    R['obst_cover'] = sum(1 for i in range(N * N) if land[i] and obst[i]) / nl
    R['block_cover'] = sum(1 for i in range(N * N) if land[i] and blk[i]) / nl
    R['road_frac'] = sum(1 for i in range(N * N) if land[i] and road[i]) / nl
    cnt = collections.Counter(o['cat'] for o in M['objs'])
    for k in ('mine', 'pile', 'chest', 'art', 'dwell', 'bank', 'site', 'monster', 'town'): R['per1k_' + k] = cnt[k] * 1000 / nl
    dist = lambda a, b: max(abs(a[0] - b[0]), abs(a[1] - b[1]))
    mons = [o['visit'] for o in M['objs'] if o['cat'] == 'monster']; towns = [o['visit'] for o in M['objs'] if o['cat'] == 'town']
    def nearroad(p, r):
        return any(0 <= p[0] + dx < N and 0 <= p[1] + dy < N and road[(p[1] + dy) * N + p[0] + dx] for dx in range(-r, r + 1) for dy in range(-r, r + 1))
    for k in ('mine', 'art', 'bank', 'pile', 'chest', 'site'):
        vs = [o['visit'] for o in M['objs'] if o['cat'] == k]
        if vs:
            R['guard_' + k] = sum(any(dist(p, m) <= 2 for m in mons if m != p) for p in vs) / len(vs)
            R['road2_' + k] = sum(nearroad(p, 2) for p in vs) / len(vs)
    R['mon_onroad'] = sum(road[y * N + x] for x, y in mons) / max(1, len(mons))
    md = collections.defaultdict(list)
    for o in M['objs']:
        if o['cat'] == 'mine': md[o['res']].append(min(dist(o['visit'], t) for t in towns))
    R['mine_dist'] = {k: st.median(v) for k, v in md.items()}
    vis = [o['visit'] for o in M['objs'] if o['cat'] not in ('monster',)]
    R['nn_vis'] = st.median(min(dist(a, b) for b in vis if b is not a) for a in vis)
    back = []
    for o in M['objs']:
        if o['cat'] in ('site', 'mine', 'bank') and o['foot']:
            xs = [x for x, y in o['foot']]; ys = [y for x, y in o['foot']]
            band = [(x, min(ys) - 1) for x in range(min(xs) - 1, max(xs) + 2) if 0 <= x < N and min(ys) - 1 >= 0]
            if band: back.append(sum(blk[y * N + x] for x, y in band) / len(band))
    R['back_blocked'] = st.mean(back) if back else 0
    seen = [False] * (N * N); sizes = []
    for i in range(N * N):
        if obst[i] and land[i] and not seen[i]:
            stack = [i]; seen[i] = True; n = 0
            while stack:
                j = stack.pop(); n += 1; x, y = j % N, j // N
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < N and 0 <= yy < N and obst[yy * N + xx] and not seen[yy * N + xx]: seen[yy * N + xx] = True; stack.append(yy * N + xx)
            sizes.append(n)
    R['clusters'] = len(sizes) * 1000 / nl; R['cluster_med'] = st.median(sizes); R['cluster_big_share'] = sum(s for s in sizes if s >= 30) / max(1, sum(sizes))
    out.append(R)
json.dump(out, open(sys.argv[2], 'w'))
