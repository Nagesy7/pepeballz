# Builds side-by-side proof sheets from e2e screenshots.
from PIL import Image
def row(paths, out, half=False):
    ims = [Image.open(p).convert('RGB') for p in paths]
    if half: ims = [i.resize((i.width // 2, i.height // 2)) for i in ims]
    o = Image.new('RGB', (sum(i.width for i in ims), max(i.height for i in ims)), (26, 20, 32)); x = 0
    for i in ims: o.paste(i, (x, 0)); x += i.width
    o.save(out)
row([f'proof/stage-{i}.png' for i in range(4)], 'proof/stages-side-by-side.png')
row(['proof/cutscene-1-powerup.png', 'proof/cutscene-2-flash.png', 'proof/cutscene-3-crater.png'], 'proof/cutscene-strip.png', True)
row(['proof/pose-punch.png', 'proof/pose-kick.png', 'proof/pose-beam.png'], 'proof/poses-strip.png', True)
