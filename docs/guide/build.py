# Builds app/guide-it.html, app/guide-en.html and app/guide-de.html from docs/guide/*.md
# (Everyday's build, handover of 2 Nov 2026; Ricette has a third language).
#   python3 docs/guide/build.py                    the three pages
#   python3 docs/guide/build.py --desk /tmp/desk   first turn the computer screenshots (/tmp/desk/<lang>/*.png)
#                                                  into app/guide/<lang>/desk/*.webp, then the pages
# Needs the markdown and Pillow packages.
import markdown, pathlib, html, re, sys
from PIL import Image

root = pathlib.Path(__file__).resolve().parents[2]
APP = 'Ricette'
CSS = """
:root{color-scheme:light dark;--bg:#faf6ef;--ink:#2b2420;--muted:#7a6e64;--line:#e9e1d4;--acc:#b5532d;--card:#f3ece1}
@media(prefers-color-scheme:dark){:root{--bg:#1c1916;--ink:#f1ebe3;--muted:#a99d91;--line:#3a3430;--acc:#e07a4f;--card:#262220}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px 18px 60px}
h1{font-family:Georgia,serif;font-size:1.9rem;margin:.4em 0}h2{font-family:Georgia,serif;margin-top:2em;border-top:1px solid var(--line);padding-top:1em}
h3{margin-top:1.6em}a{color:var(--acc)}code{background:var(--card);padding:1px 5px;border-radius:5px;font-size:.92em}
img{display:block;max-width:300px;width:100%;margin:14px auto;border:1px solid var(--line);border-radius:18px;box-shadow:0 6px 20px rgba(0,0,0,.18);cursor:zoom-in}
table{border-collapse:collapse;width:100%;font-size:.95em}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px 12px;flex-wrap:wrap;font-size:.95em}.top a{text-decoration:none}
.langs{display:inline-flex;gap:12px}
nav.toc{background:var(--card);border-radius:14px;padding:10px 16px;margin:16px 0}nav.toc a{display:block;padding:3px 0;text-decoration:none}
html:not(.desk) .dk,html:not(.desk) .desk-only,html.desk .ph,html.desk .phone-only{display:none}
.mode{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:2px;gap:2px}
.mode button{border:0;background:none;color:var(--muted);font:inherit;font-size:.88em;padding:4px 12px;border-radius:999px;cursor:pointer}
.mode button[aria-pressed=true]{background:var(--acc);color:var(--bg);font-weight:600}
html.desk main{max-width:1080px;padding:24px 32px 80px}
html.desk main>p,html.desk main>ul,html.desk main>ol,html.desk main>table,html.desk main>h2,html.desk main>h3,html.desk main>div,html.desk nav.toc{max-width:780px;margin-left:auto;margin-right:auto}
html.desk nav.toc{columns:2;column-gap:24px}
html.desk main>p:has(img.dk),html.desk main>p:has(img.wide){max-width:none}
html.desk img.dk,html.desk img.wide{max-width:100%;border-radius:12px;margin:18px auto 26px}
img.wide{max-width:100%;border-radius:12px}
html.desk .desk-only{background:var(--card);border-radius:14px;padding:2px 16px}
.zoom{position:fixed;inset:0;z-index:9;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;padding:2vw;cursor:zoom-out}
.zoom img{max-width:100%;max-height:100%;width:auto;margin:0;border:0;box-shadow:none;cursor:zoom-out}
"""
HEAD_JS = "(function(){var m;try{m=localStorage.getItem('guideMode')}catch(e){}var w=innerWidth,d=m?m==='desk':w>=1000||(w>=700&&matchMedia('(pointer:fine)').matches);if(d)document.documentElement.classList.add('desk')})()"
BODY_JS = """<script>
document.addEventListener('click',function(e){var z=document.querySelector('.zoom');if(z){z.remove();return;}var i=e.target.closest('main img');if(!i)return;var d=document.createElement('div');d.className='zoom';var b=document.createElement('img');b.src=i.currentSrc||i.src;b.alt=i.alt;d.appendChild(b);document.body.appendChild(d);});
function setMode(m,keep){document.documentElement.classList.toggle('desk',m==='desk');document.querySelectorAll('.mode button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.mode===m));});if(keep){try{localStorage.setItem('guideMode',m)}catch(e){}}}
setMode(document.documentElement.classList.contains('desk')?'desk':'phone',false);
document.querySelectorAll('.mode button').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();setMode(b.dataset.mode,true);});});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var z=document.querySelector('.zoom');if(z)z.remove();}});
</script>"""
# lang, back link, phone, computer, switch label, the word for "guide", the language's own name
LANGS = [
    ('it', "← Torna all'app", 'Telefono', 'Computer', 'Mostra la guida per', 'Guida', 'Italiano'),
    ('en', '← Back to the app', 'Phone', 'Computer', 'Show the guide for', 'Guide', 'English'),
    ('de', '← Zurück zur App', 'Handy', 'Computer', 'Anleitung anzeigen für', 'Anleitung', 'Deutsch'),
]


def desk_to_webp(src):
    for lang, *_ in LANGS:
        out = root / 'app' / 'guide' / lang / 'desk'
        out.mkdir(parents=True, exist_ok=True)
        for f in sorted(pathlib.Path(src, lang).glob('*.png')):
            Image.open(f).convert('RGB').save(out / f'{f.stem}.webp', 'WEBP', quality=82, method=6)


if '--desk' in sys.argv:
    desk_to_webp(sys.argv[sys.argv.index('--desk') + 1])

for lang, back, phoneL, deskL, modeLabel, word, _ in LANGS:
    md = (root / 'docs/guide' / f'{lang}.md').read_text(encoding='utf8')
    body = markdown.markdown(md, extensions=['tables', 'toc', 'md_in_html'], extension_configs={'toc': {'toc_depth': '2-2'}})
    toc = ''.join(f'<a href="#{m.group(1)}">{html.unescape(m.group(2))}</a>' for m in re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>', body))
    others = ''.join(f'<a href="guide-{o}.html" hreflang="{o}">{name}</a>' for o, *_, name in LANGS if o != lang)
    top = (f'<div class="top"><a href="./#/settings">{back}</a>'
           f'<span class="mode" role="group" aria-label="{modeLabel}"><button type="button" data-mode="phone">📱 {phoneL}</button>'
           f'<button type="button" data-mode="desk">💻 {deskL}</button></span><span class="langs">{others}</span></div>')
    page = (f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{APP} · {word}</title><script>{HEAD_JS}</script><style>{CSS}</style></head><body><main>{top}{body}</main>{BODY_JS}</body></html>')

    def pic(m, lang=lang):
        tag, src = m.group(0), m.group(1)
        name = pathlib.Path(src).stem
        desk = root / 'app' / 'guide' / lang / 'desk' / f'{name}.webp'
        try:
            w, h = Image.open(root / 'app' / src).size
        except Exception:
            w, h = (1, 2)
        if w > h:
            tag = tag.replace('<img ', '<img class="wide" ', 1)
        tag = tag.replace('<img ', '<img loading="lazy" ', 1)
        if not desk.exists():
            return tag
        dk = re.sub(r'src="[^"]+"', f'src="guide/{lang}/desk/{name}.webp"', tag).replace('<img ', '<img class="dk" ', 1)
        return tag.replace('<img ', '<img class="ph" ', 1) + dk

    page = re.sub(r'<img [^>]*src="(guide/[^"]+\.png)"[^>]*>', pic, page)
    page = page.replace('</h1>', f'</h1><nav class="toc">{toc}</nav>', 1)
    (root / 'app' / f'guide-{lang}.html').write_text(page, encoding='utf8')
    print(lang, len(page))
