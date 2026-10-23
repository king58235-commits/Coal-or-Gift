#!/usr/bin/env python3
"""把 Codex 生出來的原圖整理成遊戲用的規格圖。

用法:
  python tools/prep_sprite.py <原圖> <輸出檔> [--size 640x800] [--foot 0.97] [--fit h|w|contain]

做的事:
  1. 裁掉四周全透明的空白(依不透明像素的外框)
  2. 以「外框高度」等比縮放到 canvas 高度 * foot(預設 97%,腳底留 3% 空白),
     若寬度超出 canvas 寬度則改成縮到剛好塞進寬度
  3. 腳底(圖片底邊)置中貼在 canvas 底部,輸出透明 PNG

同一組角色的各個姿勢請用同樣的 --size / --foot,大小才會一致。
--fit contain: 不依高度,直接縮到整個外框塞進 canvas(用在不是站立角色的圖,例如物品)。
"""
import argparse
import sys

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--size", default="640x800")
    ap.add_argument("--foot", type=float, default=0.97)
    ap.add_argument("--fit", default="h", choices=["h", "contain"])
    ap.add_argument("--scale", type=float, default=0, help="固定縮放倍率(同一組姿勢用同一個倍率,角色大小才一致;保留原圖水平構圖,只把腳底對齊)")
    ap.add_argument("--alpha-cut", type=int, default=24, help="低於此 alpha 視為空白(去除極淡的光暈)")
    a = ap.parse_args()
    cw, ch = [int(v) for v in a.size.lower().split("x")]

    im = Image.open(a.src).convert("RGBA")
    arr = np.array(im)
    alpha = arr[:, :, 3]
    # 把極淡的半透明雜訊(光暈)清掉,避免外框被拉大
    arr[:, :, 3] = np.where(alpha < a.alpha_cut, 0, alpha)
    im = Image.fromarray(arr)
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        print("圖片全透明:", a.src)
        return 1
    if a.scale > 0:
        k = a.scale
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        bb = im.getchannel("A").getbbox()
        out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ox = (cw - im.width) // 2
        oy = round(ch * a.foot) - bb[3]          # 讓腳底(外框底邊)落在 foot 線上
        out.alpha_composite(im, (ox, oy)) if (ox >= 0 and oy >= 0) else out.paste(im, (ox, oy))
        out.save(a.dst)
        print(f"{a.src} -> {a.dst}  (scale {k}, content {bb[2]-bb[0]}x{bb[3]-bb[1]}, canvas {cw}x{ch})")
        return 0
    im = im.crop(bbox)
    w, h = im.size

    if a.fit == "contain":
        k = min(cw * 0.94 / w, ch * 0.94 / h)
    else:
        k = ch * a.foot / h
        if w * k > cw * 0.98:
            k = cw * 0.98 / w
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    im = im.resize((nw, nh), Image.LANCZOS)

    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ox = (cw - nw) // 2
    oy = round(ch * a.foot) - nh if a.fit == "h" else (ch - nh) // 2
    out.alpha_composite(im, (ox, max(0, oy)))
    out.save(a.dst)
    print(f"{a.src} -> {a.dst}  ({w}x{h} -> {nw}x{nh}, canvas {cw}x{ch})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
