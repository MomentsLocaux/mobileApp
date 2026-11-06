from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent
INK, LEAF, MINT = '#1A3329', '#7CB518', '#BEDFC5'

# Original vector studies; not a raster trace of the application logo.
SHAPES = {
    'a': ('M-flèche', 'Le M reste immédiat. Sa diagonale devient une direction.',
          '<path d="M5 26V8L15 18L26 7V26" class="base"/>'
          '<path d="M15 18L26 7M19 7H26V14" class="accent"/>'),
    'b': ('Signature en mouvement', 'La boucle du logo, prolongée par une flèche ouverte.',
          '<path d="M5 26V8L12 15M26 19V26" class="base"/>'
          '<path d="M19 21C23 26 17 29 14 25C11 22 14 19 17 16L26 7M19 7H26V14" class="accent"/>'),
    'c': ('Cap local', 'Un M compact et une pointe pleine pour les petites tailles.',
          '<path d="M5 26V8L15 18L24 9M26 18V26" class="base"/>'
          '<path d="M15 18L25 8" class="accent"/>'
          '<path d="M18 5H28V15L24 11L18 5Z" class="tip"/>'),
}

def mark(key, size=64, active=True):
    content = SHAPES[key][2]
    accent = LEAF if active else INK
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 32 32" fill="none" aria-hidden="true">'
            f'<g stroke-linecap="round" stroke-linejoin="round" stroke-width="3.2">'
            f'{content.replace("class=\"base\"", f"stroke=\"{INK}\"").replace("class=\"accent\"", f"stroke=\"{accent}\"").replace("class=\"tip\"", f"fill=\"{accent}\" stroke=\"none\"")}'
            '</g></svg>')

for key in SHAPES:
    for active in (False, True):
        (ROOT / f'proposal-{key}-{"active" if active else "inactive"}.svg').write_text(mark(key, 32, active))

cards = ''
for key, (title, desc, _) in SHAPES.items():
    cards += f'''<article class="study"><div class="study-top"><span class="letter">{key.upper()}</span><span class="pill">{'Piste conseillée' if key == 'a' else 'Exploration'}</span></div>
    <div class="hero-mark">{mark(key, 132)}</div><h2>{escape(title)}</h2><p>{escape(desc)}</p>
    <div class="states"><div>{mark(key, 38, False)}<span>Inactif</span></div><div class="selected">{mark(key, 38)}<span>Actif</span></div></div>
    <div class="sizes">{''.join(f'<div>{mark(key, size)}<small>{size} px</small></div>' for size in (20,24,28,32))}</div>
    <button class="choose" data-key="{key}" aria-pressed="{'true' if key=='a' else 'false'}">Voir dans la navigation</button></article>'''

html = '''<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Propositions — étude M-flèche</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#F4FBF6;color:#1A3329;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1180px;margin:auto;padding:44px 44px 28px}.eyebrow{font-size:11px;letter-spacing:2px;font-weight:750;text-transform:uppercase;color:#5B7A6A}.intro{display:flex;justify-content:space-between;gap:30px;align-items:center;margin-bottom:28px}h1{font-size:38px;letter-spacing:-1.6px;margin:10px 0}p{color:#5B7A6A;line-height:1.5;margin:0;font-size:14px}.reference{display:flex;align-items:center;gap:12px;font-size:12px;min-width:190px}.reference img{height:72px;width:72px;object-fit:contain}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.study{background:#fff;border:1px solid #D4E6D9;border-radius:22px;padding:22px}.study-top{display:flex;justify-content:space-between;align-items:center}.letter{font-weight:800;font-size:14px}.pill{font-size:10px;padding:6px 9px;background:#E8F5E9;border-radius:30px;color:#466652}.hero-mark{height:175px;display:flex;align-items:center;justify-content:center}h2{font-size:21px;letter-spacing:-.6px;margin:0 0 8px}.study p{min-height:44px;font-size:13px}.states{display:flex;gap:12px;border-top:1px solid #E1EBE4;margin-top:20px;padding-top:18px}.states>div{display:flex;flex:1;align-items:center;justify-content:center;gap:8px;padding:10px 4px;font-size:11px;border-radius:12px}.states .selected{background:#EDF5DF}.sizes{display:flex;justify-content:space-around;align-items:end;margin:22px 0}.sizes>div{display:flex;flex-direction:column;align-items:center;gap:8px}.sizes small{font-size:10px;color:#5B7A6A}.choose{border:1px solid #B6D5BF;background:#F4FBF6;color:#1A3329;border-radius:12px;width:100%;min-height:44px;padding:9px;font-weight:650;cursor:pointer}.choose[aria-pressed=true]{background:#DCEAAB;border-color:#7CB518}.context{margin-top:26px;display:grid;grid-template-columns:1fr 430px;gap:40px;align-items:center}.context h2{font-size:23px}.context p{max-width:460px}.nav{display:flex;align-items:center;justify-content:space-around;border:1px solid #CFE2D5;background:#fff;border-radius:22px;padding:12px 8px;box-shadow:0 8px 24px #1A332908}.nav-item{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:76px;font-size:10px;color:#5B7A6A}.nav-item.active{color:#1A3329;font-weight:750}.nav-glyph{width:54px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:14px}.active .nav-glyph{background:#E4EFCB}.foot{margin-top:24px;padding-top:15px;border-top:1px solid #D4E6D9;font-size:11px;color:#5B7A6A}.demo-note{font-size:11px;margin-top:10px;text-align:right;color:#5B7A6A}button:focus-visible{outline:3px solid #7CB518;outline-offset:3px}@media(max-width:760px){main{padding:26px 20px}.intro{align-items:start}.reference{min-width:0}.reference span{display:none}h1{font-size:30px}.grid{grid-template-columns:1fr}.context{grid-template-columns:1fr;gap:18px}.study p{min-height:0}.hero-mark{height:145px}.nav{max-width:430px}.nav-item{min-width:60px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style><main><div class="intro"><div><div class="eyebrow">Moments Locaux · Étude d’icône · 06.11.2026</div><h1>Un M qui donne une direction.</h1><p>Une signature pour Propositions, issue du logo. Sans étoiles ni codes « IA ».</p></div><div class="reference"><img src="../../assets/images/logo-mark.png" alt="Logo actuel Moments Locaux"><span>Point de départ<br><b>Le logo de l’app</b></span></div></div><div class="grid">''' + cards + '''</div><section class="context"><div><div class="eyebrow">En situation · maquette</div><h2>Reconnaissable à 28 pixels.</h2><p>Le M ancre la marque. La flèche suggère une prochaine sortie. La silhouette reste identique entre les états ; seule la diagonale devient anis.</p></div><div><div class="nav"><div class="nav-item"><div class="nav-glyph"><svg width="27" height="27" viewBox="0 0 24 24" fill="#BEDFC5" stroke="#1A3329" stroke-width="1.6" stroke-linejoin="round"><path d="M3 10L12 3L21 10V21H15V14H9V21H3Z"/></svg></div>Accueil</div><div class="nav-item active"><div class="nav-glyph" id="nav-preview"></div>Propositions</div><div class="nav-item"><div class="nav-glyph"><svg width="27" height="27" viewBox="0 0 24 24" fill="#BEDFC5" stroke="#1A3329" stroke-width="1.6" stroke-linejoin="round"><path d="M3 5L9 3L15 5L21 3V19L15 21L9 19L3 21Z"/><path d="M9 3V19M15 5V21"/></svg></div>Carte</div><div class="nav-item"><div class="nav-glyph"><svg width="27" height="27" viewBox="0 0 24 24" fill="#BEDFC5" stroke="#1A3329" stroke-width="1.6"><path d="M12 21C8 18 2 13 2 8C2 2 9 1 12 6C15 1 22 2 22 8C22 13 16 18 12 21Z"/></svg></div>Favoris</div></div><div class="demo-note">Comparaison illustrative · aucune modification de l’application</div></div></section><div class="foot">PROPOSALS-ICON-001 · Déclinaison de MVP-P1-007 · SVG originaux éditables · A = lecture la plus simple ; B = filiation la plus proche du logo ; C = pointe la plus affirmée.</div></main><script>
const variants = ''' + str({key: mark(key, 28) for key in SHAPES}).replace("'a':", '"a":').replace("'b':", '"b":').replace("'c':", '"c":') + ''';
document.getElementById('nav-preview').innerHTML=variants.a;
document.querySelectorAll('.choose').forEach(b=>b.addEventListener('click',()=>{document.getElementById('nav-preview').innerHTML=variants[b.dataset.key];document.querySelectorAll('.choose').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
</script></html>'''
# Use a real JSON serializer to keep JS source valid regardless of SVG quotes.
import json
start = html.index('const variants = ')
end = html.index(';\ndocument.getElementById', start)
html = html[:start] + 'const variants = ' + json.dumps({key: mark(key, 28) for key in SHAPES}) + html[end:]
(ROOT / 'index.html').write_text(html)
print('Generated 6 SVG assets and comparison board.')
