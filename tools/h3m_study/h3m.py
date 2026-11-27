"""Minimal .h3m reader (RoE/AB/SoD): header, terrain, object templates and objects with positions."""
import gzip, struct
ROE, AB, SOD = 0x0E, 0x15, 0x1C

class R:
    def __init__(s, d): s.d = d; s.p = 0
    def u8(s): v = s.d[s.p]; s.p += 1; return v
    def s8(s): v = struct.unpack_from('<b', s.d, s.p)[0]; s.p += 1; return v
    def u16(s): v = struct.unpack_from('<H', s.d, s.p)[0]; s.p += 2; return v
    def u32(s): v = struct.unpack_from('<I', s.d, s.p)[0]; s.p += 4; return v
    def skip(s, n): s.p += n
    def str(s): n = s.u32(); v = s.d[s.p:s.p + n]; s.p += n; return v.decode('latin1')
    def pos(s): return (s.u8(), s.u8(), s.u8())

def parse(path):
    r = R(gzip.open(path).read())
    V = r.u32(); r.u8(); N = r.u32(); two = r.u8(); name = r.str(); r.str(); r.u8()
    if V != ROE: r.u8()
    art = (lambda: r.u8()) if V == ROE else (lambda: r.u16())
    cre = art
    players = []
    for pl in range(8):
        hum, comp = r.u8(), r.u8()
        if not (hum or comp):
            r.skip({ROE: 6, AB: 12, SOD: 13}[V]); players.append(None); continue
        r.u8()
        if V == SOD: r.u8()
        r.u8() if V == ROE else r.u16()
        r.u8()
        town = None
        if r.u8():
            if V != ROE: r.u8(); r.u8()
            town = r.pos()
        r.u8(); h = r.u8()
        if h != 0xFF: r.u8(); r.str()
        if V != ROE:
            r.u8(); n = r.u8(); r.skip(3)
            for _ in range(n): r.u8(); r.str()
        players.append({'town': town})
    vc = r.u8()
    if vc != 0xFF:
        r.u8(); r.u8()
        if vc == 0: r.u8(); V != ROE and r.skip(1)
        elif vc == 1: r.u8(); V != ROE and r.skip(1); r.u32()
        elif vc == 2: r.u8(); r.u32()
        elif vc == 3: r.pos(); r.u8(); r.u8()
        elif vc in (4, 5, 6, 7): r.pos()
        elif vc == 10: r.u8(); r.pos()
    lc = r.u8()
    if lc in (0, 1): r.pos()
    elif lc == 2: r.u16()
    if r.u8(): r.skip(8)
    r.skip(16 if V == ROE else 20)
    if V > ROE: r.skip(r.u32())
    if V == SOD:
        for _ in range(r.u8()): r.u8(); r.u8(); r.str(); r.u8()
    r.skip(31)
    if V == AB: r.skip(17)
    if V == SOD: r.skip(18); r.skip(9); r.skip(4)
    for _ in range(r.u32()): r.str(); r.str()
    def hero_arts():
        if r.u8():
            for _ in range(16): art()
            if V >= SOD: art()
            art()
            art() if V > ROE else r.skip(1)
            for _ in range(r.u16()): art()
    if V == SOD:
        for _ in range(156):
            if r.u8():
                if r.u8(): r.u32()
                if r.u8(): r.skip(2 * r.u32())
                hero_arts()
                if r.u8(): r.str()
                r.u8()
                if r.u8(): r.skip(9)
                if r.u8(): r.skip(4)
    levels = 2 if two else 1
    tiles = []
    for z in range(levels):
        lv = []
        for i in range(N * N):
            t = r.d[r.p:r.p + 7]; r.p += 7
            lv.append(tuple(t))
        tiles.append(lv)
    defs = []
    for _ in range(r.u32()):
        nm = r.str(); block = r.d[r.p:r.p + 6]; r.p += 6; visit = r.d[r.p:r.p + 6]; r.p += 6
        r.u16(); r.u16(); cid = r.u32(); sub = r.u32(); r.u8(); r.u8(); r.skip(16)
        defs.append({'name': nm.lower(), 'id': cid, 'sub': sub, 'block': block, 'visit': visit})
    def cset(n):
        out = []
        for _ in range(n):
            c = cre(); k = r.u16(); out.append((c, k))
        return out
    def msg_guards():
        g = None
        if r.u8():
            r.str()
            if r.u8(): g = cset(7)
            r.skip(4)
        return g
    def quest():
        t = r.u8()
        if t == 0: return 0
        if t in (1, 3, 4): r.u32()
        elif t == 2: r.skip(4)
        elif t == 5: r.skip(2 * r.u8())
        elif t == 6: r.skip(4 * r.u8())
        elif t == 7: r.skip(28)
        elif t in (8, 9): r.u8()
        r.u32(); r.str(); r.str(); r.str()
        return t
    def bundle(event):
        r.u32(); r.u32(); r.s8(); r.s8(); r.skip(28); r.skip(4)
        r.skip(2 * r.u8())
        for _ in range(r.u8()): art()
        r.skip(r.u8())
        cset(r.u8())
        r.skip(8)
        if event: r.u8(); r.u8(); r.u8(); r.skip(4)
    objs = []
    for _ in range(r.u32()):
        x, y, z = r.pos(); dn = r.u32(); r.skip(5)
        D = defs[dn]; cid = D['id']; o = {'x': x, 'y': y, 'z': z, 'id': cid, 'sub': D['sub'], 'def': D['name'], 'dn': dn}
        if cid == 26: o['guard'] = msg_guards(); bundle(True)
        elif cid in (34, 70, 62):
            if V > ROE: r.u32()
            o['owner'] = r.u8(); r.u8()
            if r.u8(): r.str()
            if V > AB:
                if r.u8(): r.u32()
            else: r.u32()
            if r.u8(): r.u8()
            if r.u8(): r.skip(2 * r.u32())
            if r.u8(): cset(7)
            r.u8(); hero_arts(); r.u8()
            if V > ROE:
                if r.u8(): r.str()
                r.u8()
            if V > AB:
                if r.u8(): r.skip(9)
            elif V == AB: r.u8()
            if V > AB:
                if r.u8(): r.skip(4)
            r.skip(16)
        elif cid in (54, 71, 72, 73, 74, 75, 162, 163, 164):
            if V > ROE: r.u32()
            o['count'] = r.u16(); r.u8()
            if r.u8(): r.str(); r.skip(28); art()
            r.u8(); r.u8(); r.skip(2)
        elif cid in (59, 91): r.str(); r.skip(4)
        elif cid == 83:
            if V > ROE: t = quest()
            else: t = 0 if r.u8() == 255 else 5
            if t:
                rt = r.u8()
                if rt in (1, 2): r.u32()
                elif rt in (3, 4, 9): r.u8()
                elif rt == 5: r.u8(); r.u32()
                elif rt in (6, 7): r.u8(); r.u8()
                elif rt == 8: art()
                elif rt == 10: cre(); r.u16()
                r.skip(2)
            else: r.skip(3)
        elif cid == 113:
            if V > ROE: r.skip(4)
        elif cid == 81: r.u8(); r.u8(); r.skip(6)
        elif cid in (33, 219):
            o['owner'] = r.u8(); r.skip(3); o['guard'] = cset(7)
            if V > ROE: r.u8()
            r.skip(8)
        elif cid in (5, 65, 66, 67, 68, 69, 93):
            o['guard'] = msg_guards()
            if cid == 93: r.u32()
        elif cid in (76, 79): o['guard'] = msg_guards(); o['amount'] = r.u32(); r.skip(4)
        elif cid in (77, 98):
            if V > ROE: r.u32()
            o['owner'] = r.u8()
            if r.u8(): r.str()
            if r.u8(): cset(7)
            r.u8()
            if r.u8(): r.skip(12)
            else: r.u8()
            if V > ROE: r.skip(9)
            r.skip(9)
            for _ in range(r.u32()):
                r.str(); r.str(); r.skip(28); r.u8()
                if V > AB: r.u8()
                r.u8(); r.u16(); r.u8(); r.skip(17); r.skip(6); r.skip(14); r.skip(4)
            if V > AB: r.u8()
            r.skip(3)
        elif cid in (53, 220, 17, 18, 19, 20, 87, 42): o['owner'] = r.u8(); r.skip(3)
        elif cid in (88, 89, 90): r.u32()
        elif cid == 6: o['guard'] = msg_guards(); bundle(False)
        elif cid == 36: r.u32()
        elif cid in (216, 217, 218):
            r.u32()
            if cid in (216, 217):
                if r.u32() == 0: r.u16()
            if cid in (216, 218): r.u8(); r.u8()
        elif cid == 215: quest()
        elif cid == 214:
            r.u8()
            if r.u8() == 0xFF: r.u8()
        objs.append(o)
    return {'name': name, 'V': V, 'N': N, 'levels': levels, 'tiles': tiles, 'defs': defs, 'objs': objs, 'players': players, 'end': r.p, 'len': len(r.d)}

def mask_cells(m):
    """(dx, dy) offsets, relative to the object's x,y (its bottom-right cell), of set cells in an 8x6 mask
    whose bit is 0 for blocked / 1 for visitable depending on the mask."""
    cells = []
    for row in range(6):
        for col in range(8):
            bit = (m[row] >> col) & 1
            cells.append(((col, row), bit))
    return cells
