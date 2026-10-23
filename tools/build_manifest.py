#!/usr/bin/env python3
"""掃描 assets/ 底下的遊戲圖片,產生 js/art_manifest.js。

用法(在專案根目錄):  python tools/build_manifest.py

- 每次新增 / 刪除 / 改名圖片後都要重跑一次(遊戲只會載入清單裡有的檔案,所以缺圖不會有 404)。
- 可選:assets/anchors.json 放各張圖的錨點(例如投擲手的位置,用圖片寬高的比例 0~1):
    { "sprites/santa/release_fwd": { "hand": [0.82, 0.28] } }
- 可選:assets/units.json 調整各類角色在遊戲內的大小:
    { "santa": 340, "kidGood": 134, "kidBad": 150, "yeti": 460 }
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
FOLDERS = ["sprites", "scene", "ui", "muscle", "fx", "intro"]
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def read_json(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    files = []
    for folder in FOLDERS:
        base = os.path.join(ASSETS, folder)
        if not os.path.isdir(base):
            continue
        for dirpath, _, names in os.walk(base):
            for n in sorted(names):
                if os.path.splitext(n)[1].lower() in EXTS:
                    rel = os.path.relpath(os.path.join(dirpath, n), ROOT).replace(os.sep, "/")
                    files.append(rel)
    files.sort()
    manifest = {
        "files": files,
        "anchors": read_json(os.path.join(ASSETS, "anchors.json")),
        "units": read_json(os.path.join(ASSETS, "units.json")),
    }
    out = os.path.join(ROOT, "js", "art_manifest.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// 由 tools/build_manifest.py 自動產生,請勿手動修改\n")
        f.write("window.ART_MANIFEST = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n")
    print("已寫入 js/art_manifest.js,共 %d 張圖" % len(files))
    for p in files:
        print("  ", p)


if __name__ == "__main__":
    sys.exit(main())
