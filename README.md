# Ashen Oath

A grimdark, turn-based fantasy strategy game in the spirit of the classic hero-and-castle games: explore a
generated map with your commanders, capture mines and towns, build up your town, recruit creatures and fight
tactical battles on a hex grid.

Six factions: the Iron Concord, the Hollow Host, the Rustbound, the Scrapjaw Horde, the Deathless Dynasty and the Pale Fang Exiles.

## Play on Windows

Download **AshenOath-Setup.exe** from the [Releases](../../releases) page and run it.
If Windows shows "Windows protected your PC", click **More info**, then **Run anyway** (the installer is not
code-signed). The game installs for your user only, starts in full screen (Menu > Display switches to a window with borders or a smaller window; F11 toggles) and plays offline.

## Project layout

- `index.html`, `src/` — the game (plain JavaScript modules and canvas, no build step)
- `assets/` — the art the game loads (sprites, towns, terrain, interface, intro video)
- `tools/` — Python scripts that cut and pack the delivered artwork into `assets/`
- `pc/` — the Windows launcher (Go, WebView2) and installer (NSIS); build with `python3 pc/build.py`
- `*_prompts.txt` — the image-generation prompts used for the artwork

The raw delivered artwork (`assets/source/`) is not in this repository because of its size.
