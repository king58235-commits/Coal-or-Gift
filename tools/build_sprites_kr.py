#!/usr/bin/env python3
"""把 assets/_gen/chars_kr/ 的角色原圖整理成遊戲規格,放進 assets/sprites/。

每一組角色用「同一個縮放倍率」(以該組待機圖的外框高度決定),這樣不同表情/變體的大小一致。
用法: python tools/build_sprites_kr.py
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "_gen", "chars_kr")
OUT = os.path.join(ROOT, "assets", "sprites")

# (資料夾, 畫布 WxH, 以哪張當縮放基準, 該組的圖: 目標檔名 -> 原圖名)
GROUPS = [
    # 好孩子(兩種造型共用同一倍率)
    ("kid_good", "256x320", "kid_good_a_idle", [
        ("kid_good_a/idle_1", "kid_good_a_idle"), ("kid_good_a/idle_2", "kid_good_a_idle_2"),
        ("kid_good_a/happy", "kid_good_a_happy"), ("kid_good_a/cry", "kid_good_a_cry"),
        ("kid_good_b/idle_1", "kid_good_b_idle"), ("kid_good_b/idle_2", "kid_good_b_idle_2"),
        ("kid_good_b/happy", "kid_good_b_happy"), ("kid_good_b/cry", "kid_good_b_cry")]),
    ("thug", "320x400", "thug_a_idle", [
        (f"thug_{v}/{n}", f"thug_{v}_{src}") for v in "ab"
        for n, src in (("idle", "idle"), ("smug", "smug"), ("hit", "hit"), ("converted", "converted"))]),
    ("goblin", "320x400", "goblin_a_idle", [
        (f"goblin_{v}/{n}", f"goblin_{v}_{src}") for v in "ab"
        for n, src in (("idle", "idle"), ("smug", "smug"), ("hit", "hit"), ("converted", "converted"))]),
    ("yeti", "1024x1024", "yeti_idle", [
        (f"yeti/{n}", f"yeti_{n}") for n in ("idle", "roar", "eat", "hit", "dizzy")]),
    # 偽裝老人(韓系 Q 版,原圖在 assets/_gen/fake_kr/):640x800 畫布,三種造型共用同一倍率
    ("fake", "640x800", "..\fake_kr\fake_kid_idle", [
        (f"fake_{k}/{n}", f"../fake_kr/fake_{k}_{n}") for k in ("kid", "thug", "goblin") for n in ("idle", "flex")]),
]


def bbox_h(path, cut=24):
    a = np.array(Image.open(path).convert("RGBA"))[:, :, 3]
    ys = np.where(a >= cut)[0]
    return ys.max() - ys.min() + 1


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    for name, size, base, items in GROUPS:
        cw, ch = [int(v) for v in size.split("x")]
        if base:
            # 以「該組最高的那一張」(例如頭上有光環/星星的表情)為準,確保任何一張都不會被裁到
            hs = [bbox_h(os.path.join(SRC, src + ".png")) for _, src in items if os.path.exists(os.path.join(SRC, src + ".png"))]
            k = (ch * 0.955) / max(hs)
        else:
            k = 0.5
        print(f"[{name}] canvas {size} scale {k:.4f}")
        for dst, src in items:
            sp = os.path.join(SRC, src + ".png")
            if not os.path.exists(sp):
                print("   缺圖,略過:", src)
                continue
            dp = os.path.join(OUT, dst + ".png")
            os.makedirs(os.path.dirname(dp), exist_ok=True)
            subprocess.run([sys.executable, os.path.join(ROOT, "tools", "prep_sprite.py"), sp, dp,
                            "--size", size, "--foot", "0.975", "--scale", f"{k:.5f}"], check=True, stdout=subprocess.DEVNULL)
    print("完成。接著請執行: python tools/build_manifest.py")


if __name__ == "__main__":
    main()
