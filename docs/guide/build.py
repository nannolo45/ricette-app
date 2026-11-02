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
THEME_KEY = 'ricette-theme'    # the app's Automatico / Chiaro / Scuro choice (js/theme.js); 'ricette-accent' is its colour
CSS = """
:root{color-scheme:light;--bg:#f3f5f5;--ink:#162021;--muted:#5d696a;--line:#dde3e3;--acc:#7a3f93;--card:#ffffff}
:root.dark{color-scheme:dark;--bg:#151a1b;--ink:#e9eeec;--muted:#94a09f;--line:#313b3c;--acc:#c792dc;--card:#1f2627}
:root[data-accent=petrolio]{--acc:#1d6b75}:root[data-accent=terracotta]{--acc:#b5532d}:root[data-accent=fiordaliso]{--acc:#3657b0}
:root.dark[data-accent=petrolio]{--acc:#4fb3bf}:root.dark[data-accent=terracotta]{--acc:#e07a4f}:root.dark[data-accent=fiordaliso]{--acc:#86a8f2}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px 18px 60px}
h1{font-family:Georgia,serif;font-size:1.9rem;margin:.4em 0}h2{font-family:Georgia,serif;margin-top:2em;border-top:1px solid var(--line);padding-top:1em}
h3{margin-top:1.6em}a{color:var(--acc)}code{background:var(--card);padding:1px 5px;border-radius:5px;font-size:.92em}
img{display:block;max-width:300px;width:100%;margin:14px auto;border:1px solid var(--line);border-radius:18px;box-shadow:0 6px 20px rgba(0,0,0,.18);cursor:zoom-in}
table{border-collapse:collapse;width:100%;font-size:.95em}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px 12px;flex-wrap:wrap;font-size:.95em}.top a{text-decoration:none}
.top .pick{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:.9em}
.top select{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px 28px 6px 10px;appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 15px) 55%,calc(100% - 10px) 55%;background-size:5px 5px;background-repeat:no-repeat;cursor:pointer}
.top .picks{display:flex;gap:10px;flex-wrap:wrap}
nav.toc{background:var(--card);border-radius:14px;padding:10px 16px;margin:16px 0}nav.toc a{display:block;padding:3px 0;text-decoration:none}
html:not(.desk) .dk,html:not(.desk) .desk-only,html.desk .ph,html.desk .phone-only{display:none}
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
HEAD_JS = ("(function(){var h=document.documentElement,m,t='auto',a='';try{m=localStorage.getItem('guideMode');t=localStorage.getItem('" + THEME_KEY + "')||'auto';a=localStorage.getItem('ricette-accent')||''}catch(e){}"
           "var w=innerWidth,d=m?m==='desk':w>=1000||(w>=700&&matchMedia('(pointer:fine)').matches);if(d)h.classList.add('desk');"
           "h.classList.add(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');if(a&&a!=='melanzana')h.dataset.accent=a})()")
BODY_JS = """<script>
document.addEventListener('click',function(e){var z=document.querySelector('.zoom');if(z){z.remove();return;}var i=e.target.closest('main img');if(!i)return;var d=document.createElement('div');d.className='zoom';var b=document.createElement('img');b.src=i.currentSrc||i.src;b.alt=i.alt;d.appendChild(b);document.body.appendChild(d);});
function setMode(m,keep){document.documentElement.classList.toggle('desk',m==='desk');var s=document.getElementById('mode');if(s)s.value=m;if(keep){try{localStorage.setItem('guideMode',m)}catch(e){}}}
setMode(document.documentElement.classList.contains('desk')?'desk':'phone',false);
document.getElementById('mode').addEventListener('change',function(e){setMode(e.target.value,true);});
document.getElementById('lang').addEventListener('change',function(e){location.href=e.target.value+location.hash;});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var z=document.querySelector('.zoom');if(z)z.remove();}});
</script>"""
# lang, back link, phone, computer, switch label, the word for "guide", the language's own name, the word for language
LANGS = [
    ('it', "← Torna all'app", 'Telefono', 'Computer', 'Mostra la guida per', 'Guida', 'Italiano', 'Lingua'),
    ('en', '← Back to the app', 'Phone', 'Computer', 'Show the guide for', 'Guide', 'English', 'Language'),
    ('de', '← Zurück zur App', 'Handy', 'Computer', 'Anleitung für', 'Anleitung', 'Deutsch', 'Sprache'),
]


def phone_to_webp():
    # (v52, handover v62) phone screenshots are WebP too: convert any PNG left by screenshots.mjs, in place
    for lang, *_ in LANGS:
        for f in sorted((root / 'app' / 'guide' / lang).glob('*.png')):
            Image.open(f).convert('RGB').save(f.with_suffix('.webp'), 'WEBP', quality=82, method=6)
            f.unlink()


def desk_to_webp(src):
    for lang, *_ in LANGS:
        out = root / 'app' / 'guide' / lang / 'desk'
        out.mkdir(parents=True, exist_ok=True)
        for f in sorted(pathlib.Path(src, lang).glob('*.png')):
            Image.open(f).convert('RGB').save(out / f'{f.stem}.webp', 'WEBP', quality=82, method=6)


if '--desk' in sys.argv:
    desk_to_webp(sys.argv[sys.argv.index('--desk') + 1])
phone_to_webp()

for lang, back, phoneL, deskL, modeLabel, word, _, langLabel in LANGS:
    md = (root / 'docs/guide' / f'{lang}.md').read_text(encoding='utf8')
    body = markdown.markdown(md, extensions=['tables', 'toc', 'md_in_html'], extension_configs={'toc': {'toc_depth': '2-2'}})
    toc = ''.join(f'<a href="#{m.group(1)}">{html.unescape(m.group(2))}</a>' for m in re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>', body))
    langs = ''.join(f'<option value="guide-{o}.html"{" selected" if o == lang else ""}>{name}</option>' for o, *_r in LANGS for name in [_r[5]])
    top = (f'<div class="top"><a href="./#/settings">{back}</a><span class="picks">'
           f'<label class="pick">{modeLabel} <select id="mode"><option value="phone">📱 {phoneL}</option><option value="desk">💻 {deskL}</option></select></label>'
           f'<label class="pick">{langLabel} <select id="lang">{langs}</select></label></span></div>')
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

    page = re.sub(r'<img [^>]*src="(guide/[^"]+\.(?:png|webp))"[^>]*>', pic, page)
    page = page.replace('</h1>', f'</h1><nav class="toc">{toc}</nav>', 1)
    (root / 'app' / f'guide-{lang}.html').write_text(page, encoding='utf8')
    print(lang, len(page))
