#!/usr/bin/env python3
"""Background removal + autocrop for generated sprites.
usage: tools/cut.py in.png out.(png|webp) [maxsize=0] [model=isnet-general-use]
Needs: pip install rembg onnxruntime, and the .onnx model in $U2NET_HOME
(https://github.com/danielgatis/rembg/releases/download/v0.0.0/<model>.onnx)."""
import sys
from rembg import remove, new_session
from PIL import Image

inp, out = sys.argv[1], sys.argv[2]
mx = int(sys.argv[3]) if len(sys.argv) > 3 else 0
model = sys.argv[4] if len(sys.argv) > 4 else "isnet-general-use"
im = Image.open(inp).convert("RGB")
res = remove(im, session=new_session(model), post_process_mask=False)
bb = res.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
if bb:
    pad = 6
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(res.width, bb[2] + pad), min(res.height, bb[3] + pad))
    res = res.crop(bb)
if mx and max(res.size) > mx:
    s = mx / max(res.size)
    res = res.resize((round(res.width * s), round(res.height * s)), Image.LANCZOS)
if out.lower().endswith(".webp"):
    res.save(out, quality=90, method=6)
else:
    res.save(out)
print(out, res.size)
