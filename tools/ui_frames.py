"""Terminal-style window frames (Rites spell window, commander screen) from the painted mock-ups:
elements painted in a 'selected' state are repainted as unselected (the game draws its own highlight),
then saved as webp under assets/ui/."""
from PIL import Image
import os
SRC = 'assets/source'; OUT = 'assets/ui'; os.makedirs(OUT, exist_ok=True)

def copy(im, box, to):
    im.paste(im.crop(box), to)

r = Image.open(f'{SRC}/ui_rites.jpg').convert('RGB')
copy(r, (272, 254, 722, 338), (272, 339))        # highlighted spell row -> plain row
copy(r, (146, 352, 258, 428), (146, 276))        # selected category tab -> plain tab
copy(r, (1090, 194, 1176, 236), (902, 194))      # lit sort button -> plain button
copy(r, (679, 634, 702, 656), (654, 634))        # lit page dot -> plain dot
r.save(f'{OUT}/rites.webp', quality=90)

c = Image.open(f'{SRC}/ui_commander.jpg').convert('RGB')
# spell pills painted in the spells panel: clear the panel body (the game lists real spells there)
body = c.crop((915, 500, 1262, 622)).resize((347, 186))
c.paste(body, (915, 436))
# the brighter primary button stays (Close); the backpack first slot keeps its bag icon
c.save(f'{OUT}/commander.webp', quality=90)
print('ok')
