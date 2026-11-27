"""Build the Windows installer: python3 pc/build.py
Stages pc/dist/AshenOath/ (launcher, icon, game files: the page wrapped as a full document with local fonts,
src/, and only the assets the game loads), then runs makensis on pc/installer.nsi -> pc/AshenOath-Setup.exe.
The launcher is built with: cd pc/launcher && GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui" -o ../AshenOath.exe ."""
import json, os, re, shutil, subprocess
PC = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(PC)
DIST = os.path.join(PC, 'dist', 'AshenOath'); GAME = os.path.join(DIST, 'game')
if os.path.exists(os.path.join(PC, 'dist')): shutil.rmtree(os.path.join(PC, 'dist'))
os.makedirs(GAME)

page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
page = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', page)
page = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', '<link rel="stylesheet" href="fonts/fonts.css">', page)
open(os.path.join(GAME, 'index.html'), 'w', encoding='utf-8').write(
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    '<link rel="icon" href="data:,"><style>[hidden]{display:none!important}html,body{margin:0;background:#0d0b0a}</style>\n'
    + page + '\n</body></html>\n' if '<body' in page else
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    '<link rel="icon" href="data:,"><style>[hidden]{display:none!important}html,body{margin:0;background:#0d0b0a}</style></head><body>\n'
    + page + '\n</body></html>\n')
open(os.path.join(GAME, 'ashen-oath.txt'), 'w').write('Ashen Oath\n')
shutil.copytree(os.path.join(PC, 'fonts'), os.path.join(GAME, 'fonts'))
shutil.copytree(os.path.join(ROOT, 'src'), os.path.join(GAME, 'src'))

A = os.path.join(ROOT, 'assets')
M = json.load(open(os.path.join(A, 'sprites.json')))
need = set()
for k, m in M.items():
    need.add(f"{m['atlas']}.{m.get('aext', 'png')}" if m.get('atlas') else f"{k}.{m.get('ext', 'png')}")
packed = {}
for f in os.listdir(os.path.join(A, 'town')):
    mp = os.path.join(A, 'town', f, 'meta.json')
    if os.path.exists(mp) and json.load(open(mp)).get('atlas'): packed[f] = True
def wanted(rel):
    p = rel.split('/')
    if p[0] in ('source', 'sprites_olive') or p[-1].startswith('_'): return False
    if p[0] == 'sprites' and len(p) == 2:
        n = p[1]
        return n in need or n.startswith(('icon_', 'commander_', 'town_'))
    if p[0] == 'town' and len(p) == 3 and p[1] in packed:
        return p[2] in ('base.webp', 'meta.json', 'atlas.webp') or p[2].endswith('_anim.webp')
    return True
n = size = 0
for d, _, fs in os.walk(A):
    for f in fs:
        rel = os.path.relpath(os.path.join(d, f), A).replace(os.sep, '/')
        if not wanted(rel): continue
        dst = os.path.join(GAME, 'assets', rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(d, f), dst); n += 1; size += os.path.getsize(dst)
missing = [x for x in need if not os.path.exists(os.path.join(GAME, 'assets', 'sprites', x))]
if missing: raise SystemExit(f'missing sprites: {missing[:10]}')
shutil.copy2(os.path.join(PC, 'AshenOath.exe'), DIST)
shutil.copy2(os.path.join(PC, 'ashen.ico'), DIST)
print(f'{n} asset files, {size / 1e6:.0f} MB staged')
subprocess.check_call(['makensis', '-V2', os.path.join(PC, 'installer.nsi')])
print('built', os.path.join(PC, 'AshenOath-Setup.exe'), round(os.path.getsize(os.path.join(PC, 'AshenOath-Setup.exe')) / 1e6), 'MB')
