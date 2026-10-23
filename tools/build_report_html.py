"""Render docs/PROCESS_REPORT.md into a self-contained docs/PROCESS_REPORT.html (no dependencies)."""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "PROCESS_REPORT.md"
DST = ROOT / "docs" / "PROCESS_REPORT.html"


def slug(text):
    t = re.sub(r"[`*]", "", text).strip().lower()
    t = re.sub(r"[^\w\s-]", "", t)
    return re.sub(r"\s", "-", t)


def inline(s):
    codes = []

    def stash(m):
        codes.append("<code>%s</code>" % html.escape(m.group(1)))
        return "\x00%d\x00" % (len(codes) - 1)

    s = re.sub(r"`([^`]+)`", stash, s)
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lambda m: '<a href="%s">%s</a>' % (
        m.group(2).replace(".md", ".md") if not m.group(2).startswith("..") else m.group(2), m.group(1)), s)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], s)


def split_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def render(md):
    lines = md.split("\n")
    out, i, n = [], 0, len(lines)
    title = "Report"
    while i < n:
        ln = lines[i]
        if ln.startswith("```"):
            lang = ln[3:].strip()
            buf = []
            i += 1
            while i < n and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            out.append('<pre><code%s>%s</code></pre>' % (
                ' class="lang-%s"' % lang if lang else "", html.escape("\n".join(buf))))
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", ln)
        if m:
            lvl, text = len(m.group(1)), m.group(2)
            if lvl == 1:
                title = text
            out.append('<h%d id="%s">%s</h%d>' % (lvl, slug(text), inline(text), lvl))
            i += 1
            continue
        if re.match(r"^-{3,}$", ln.strip()):
            out.append("<hr>")
            i += 1
            continue
        if ln.startswith("|") and i + 1 < n and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()):
            head = split_row(ln)
            i += 2
            rows = []
            while i < n and lines[i].startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            t = ["<div class=\"tw\"><table><thead><tr>%s</tr></thead><tbody>" % "".join(
                "<th>%s</th>" % inline(c) for c in head)]
            for r in rows:
                t.append("<tr>%s</tr>" % "".join("<td>%s</td>" % inline(c) for c in r))
            t.append("</tbody></table></div>")
            out.append("".join(t))
            continue
        if ln.startswith(">"):
            buf = []
            while i < n and lines[i].startswith(">"):
                buf.append(re.sub(r"^>\s?", "", lines[i]))
                i += 1
            # split into paragraphs / simple lists inside the quote
            out.append("<blockquote>%s</blockquote>" % render("\n".join(buf))[0])
            continue
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", ln)
        if m:
            ordered = m.group(2)[0].isdigit()
            items = []
            while i < n:
                mm = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
                if not mm:
                    break
                text = mm.group(3)
                i += 1
                while i < n and lines[i].startswith("   ") and not re.match(r"^\s*([-*]|\d+\.)\s", lines[i]):
                    text += " " + lines[i].strip()
                    i += 1
                items.append(text)
            tag = "ol" if ordered else "ul"
            out.append("<%s>%s</%s>" % (tag, "".join("<li>%s</li>" % inline(t) for t in items), tag))
            continue
        if not ln.strip():
            i += 1
            continue
        buf = []
        while i < n and lines[i].strip() and not re.match(
                r"^(#{1,4}\s|```|\||>|-{3,}$|\s*([-*]|\d+\.)\s)", lines[i]):
            buf.append(lines[i].strip())
            i += 1
        if not buf:  # safety: never loop forever
            buf = [lines[i].strip()]
            i += 1
        out.append("<p>%s</p>" % inline("<br>".join(buf)).replace("&lt;br&gt;", "<br>"))
    return "\n".join(out), title


CSS = """
:root{--bg:#fbf8f3;--fg:#241c22;--mute:#6b5f68;--card:#fff;--line:#e6dccf;--acc:#c8203a;--acc2:#1a1030;--code:#f3ece2}
@media (prefers-color-scheme:dark){:root{--bg:#17121c;--fg:#f1e9ee;--mute:#a79aa5;--card:#221a2a;--line:#3a2f45;--acc:#ff5a70;--acc2:#f1e9ee;--code:#2b2234}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.75 "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif}
main{max-width:920px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:2rem;line-height:1.3;margin:.2em 0 .6em;color:var(--acc)}
h2{font-size:1.45rem;margin:2.2em 0 .6em;padding-bottom:.25em;border-bottom:3px solid var(--acc)}
h3{font-size:1.15rem;margin:1.8em 0 .4em}
h4{font-size:1rem;margin:1.4em 0 .3em;color:var(--mute)}
a{color:var(--acc)}
code{background:var(--code);padding:.1em .35em;border-radius:4px;font:.88em ui-monospace,Consolas,monospace}
pre{background:var(--code);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow-x:auto;line-height:1.5}
pre code{background:none;padding:0;font-size:.85rem}
blockquote{margin:1em 0;padding:.4em 1em;background:var(--card);border-left:5px solid var(--acc);border-radius:0 8px 8px 0}
blockquote p{margin:.5em 0}
.tw{overflow-x:auto;margin:1em 0}
table{border-collapse:collapse;width:100%;font-size:.93rem;background:var(--card)}
th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
th{background:var(--code);white-space:nowrap}
hr{border:0;border-top:1px dashed var(--line);margin:2em 0}
li{margin:.25em 0}
@media (max-width:600px){body{font-size:15px}h1{font-size:1.6rem}}
"""


def main():
    body, title = render(SRC.read_text(encoding="utf-8"))
    page = (
        '<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        "<title>%s</title>\n<style>%s</style>\n</head>\n<body>\n<main>\n%s\n</main>\n</body>\n</html>\n"
        % (html.escape(title), CSS, body)
    )
    DST.write_text(page, encoding="utf-8")
    print("wrote", DST, len(page), "bytes")


if __name__ == "__main__":
    main()
