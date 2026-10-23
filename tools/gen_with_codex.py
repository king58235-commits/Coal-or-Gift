#!/usr/bin/env python3
"""用 Codex CLI 批次生圖(每張圖一次獨立呼叫,可並行),再把結果從 Codex 的暫存資料夾收進專案。

為什麼要這樣:Codex 生出來的圖會存在 ~/.codex/generated_images/<session id>/,
但它自己「複製到專案資料夾」這一步常常失敗,所以改成由這支程式去收。

用法:
  python tools/gen_with_codex.py <工作清單.json> [--parallel 3] [--retries 1]

工作清單 JSON:
{
  "base_prompt": "共用規則(角色一致性、透明背景…)",
  "reference": ["assets/_gen/santa/_reference_idle.png"],      // 附給 Codex 的參考圖(可多張,可空)
  "out_dir": "assets/_gen/santa",
  "jobs": [ { "name": "windup", "prompt": "這一張的姿勢描述" }, ... ]
}
結果存成 <out_dir>/<name>.png(原始尺寸,之後再用 tools/prep_sprite.py 整理成遊戲規格)。
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN_DIR = os.path.join(os.path.expanduser("~"), ".codex", "generated_images")
MODEL = os.environ.get("CODEX_MODEL", "gpt-6-luna")
lock = threading.Lock()

WRAPPER = """You are an image generator for a game art pipeline.
Call your image generation tool EXACTLY ONCE to create the image described below, then reply with the single word "done".
Do NOT save, copy, move, open or inspect any files. Do NOT write code. Do NOT call the image tool more than once.
If reference images are attached, they show the approved character: keep the SAME character design and art style.

{base}

THIS IMAGE:
{job}
"""


def find_sid(log_text):
    m = re.search(r"session id:\s*([0-9a-f-]{36})", log_text, re.I)
    return m.group(1) if m else None


def best_image(sid, since, opaque=False):
    """在這次 session 的資料夾裡挑出『真正的成品』:最大張、且是直式有透明通道的。"""
    cands = []
    for f in glob.glob(os.path.join(GEN_DIR, sid, "*.png")) if sid else []:
        try:
            im = Image.open(f)
            if min(im.size) < 400:
                continue
            # 必須有「真的透明」的像素(有些生圖會把棋盤格背景直接畫進去,alpha 全不透明 → 不合格)
            if not opaque and (im.mode != "RGBA" or im.getchannel("A").getextrema()[0] > 10):
                continue
            cands.append((os.path.getsize(f), f, im.mode))
        except Exception:
            pass
    if not cands:
        return None
    cands.sort(reverse=True)
    return cands[0][1]


def run_job(job, cfg, retries):
    name = job["name"]
    out = os.path.join(ROOT, cfg["out_dir"], name + ".png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    prompt = WRAPPER.format(base=cfg["base_prompt"], job=job["prompt"])
    for attempt in range(retries + 1):
        cmd = ["codex", "exec", "-m", MODEL, "-s", "read-only", "-C", ROOT, "--skip-git-repo-check"]
        for r in job.get("reference", cfg.get("reference", [])):
            cmd += ["-i", os.path.join(ROOT, r)]
        cmd.append("-")
        log_path = os.path.join(ROOT, cfg["out_dir"], "_log_%s_%d.txt" % (name, attempt))
        with lock:
            print("[start] %s (attempt %d)" % (name, attempt + 1), flush=True)
        p = subprocess.run(cmd, input=prompt.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, shell=(os.name == "nt"))
        text = p.stdout.decode("utf-8", "ignore")
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(re.sub(r"[A-Za-z0-9+/=]{2000,}", "<base64 omitted>", text))
        sid = find_sid(text)
        img = best_image(sid, 0, job.get("opaque", cfg.get("opaque", False)))
        if img:
            shutil.copyfile(img, out)
            with lock:
                print("[ok]    %s <- %s" % (name, os.path.basename(img)), flush=True)
            return name, True
        with lock:
            print("[fail]  %s (session %s, no image found)" % (name, sid), flush=True)
    return name, False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs_file")
    ap.add_argument("--parallel", type=int, default=3)
    ap.add_argument("--retries", type=int, default=1)
    ap.add_argument("--only", help="只跑指定的名稱(逗號分隔)")
    a = ap.parse_args()
    cfg = json.load(open(a.jobs_file, encoding="utf-8"))
    jobs = cfg["jobs"]
    if a.only:
        keep = set(a.only.split(","))
        jobs = [j for j in jobs if j["name"] in keep]
    with ThreadPoolExecutor(max_workers=a.parallel) as ex:
        results = list(ex.map(lambda j: run_job(j, cfg, a.retries), jobs))
    bad = [n for n, ok in results if not ok]
    print("完成:%d 張成功,%d 張失敗 %s" % (len(results) - len(bad), len(bad), bad), flush=True)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
