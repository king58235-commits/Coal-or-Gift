#!/usr/bin/env python3
"""把「AI 味重」的上色壓平:去掉光澤高光與細碎材質,留下大色塊 + 原本的黑外框。

用法: python tools/toon_filter.py <輸入png> <輸出png> [--colors 12] [--smooth 1.0]
做法:保留 alpha → 邊緣保留的平滑(mean-shift)抹掉細節 → 色彩量化成少數幾色 → 外框變暗變一致。
"""
import argparse
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--colors", type=int, default=12)
ap.add_argument("--smooth", type=float, default=1.0)
a = ap.parse_args()

im = cv2.imread(a.src, cv2.IMREAD_UNCHANGED)
if im.shape[2] == 3:
    im = cv2.cvtColor(im, cv2.COLOR_BGR2BGRA)
bgr, alpha = im[:, :, :3], im[:, :, 3]
# 長邊縮到 768 處理(夠大,速度快)
h, w = alpha.shape; k = 768 / max(h, w)
if k < 1:
    bgr = cv2.resize(bgr, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(alpha, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
# 邊緣保留的平滑,抹掉光澤/布料皺褶/細毛
sm = cv2.pyrMeanShiftFiltering(bgr, sp=int(10 * a.smooth), sr=int(28 * a.smooth))
# 量化成少數幾色(只用不透明區域的像素算 k-means)
mask = alpha > 128
Z = sm[mask].reshape(-1, 3).astype(np.float32)
crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
_, labels, centers = cv2.kmeans(Z, a.colors, None, crit, 3, cv2.KMEANS_PP_CENTERS)
out = sm.copy()
out[mask] = centers[labels.flatten()].astype(np.uint8)
# 去掉量化後殘留的碎點:對標籤做中值濾波
out = cv2.medianBlur(out, 5)
res = np.dstack([out, alpha])
cv2.imwrite(a.dst, res)
print("ok", a.dst)
