"""Finish and verify exports after Generate.swift; Python standard library only."""
from pathlib import Path
from xml.etree import ElementTree
import json
import shutil
import struct
import zipfile

root = Path(__file__).resolve().parents[1]
repo = root.parents[2]
manifest = json.loads((root / 'manifest.json').read_text())
for asset in manifest['files']:
    path = root / asset['file']
    assert path.exists(), path
    if path.suffix == '.svg':
        ElementTree.parse(path)
        assert '<text' not in path.read_text(), f'Live text rather than outlines: {path}'
    if path.suffix == '.png':
        content = path.read_bytes()
        assert content[:8] == b'\x89PNG\r\n\x1a\n'
        width, height = struct.unpack('>II', content[16:24])
        assert (width, height) == (asset['width'], asset['height']), path
        alpha = content[25] in (4, 6)
        assert alpha == asset['transparent'], (path, alpha, asset['transparent'])

images = [(size, (root / f'web/favicon-{size}.png').read_bytes()) for size in (16, 32, 48)]
offset = 6 + 16 * len(images)
ico = struct.pack('<HHH', 0, 1, len(images))
for size, data in images:
    ico += struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(data), offset)
    offset += len(data)
ico += b''.join(data for _, data in images)
(root / 'web/favicon.ico').write_bytes(ico)
manifest['files'].append({'file': 'web/favicon.ico', 'sizes': [16,32,48], 'transparent': True})
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False)+'\n')

license_path = repo / 'node_modules/@expo-google-fonts/plus-jakarta-sans/LICENSE_FONT'
shutil.copyfile(license_path, root / 'source/Plus-Jakarta-Sans-LICENSE.txt')
variants = ['color','reverse','ink','white','black','leaf']
gallery = ''.join(f'<article class="{v}"><h2>{v}</h2><img src="logos/logo-horizontal-{v}.svg" alt="Logo horizontal {v}"><div class="samples"><img src="symbols/mark-{v}.svg" alt="Symbole {v}"><img src="logos/logo-stacked-{v}.svg" alt="Logo empile {v}"></div></article>' for v in variants)
(root / 'index.html').write_text('''<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moments Locaux — Signature B</title><style>*{box-sizing:border-box}body{margin:0;padding:40px;background:#F4FBF6;color:#1A3329;font-family:system-ui,sans-serif}main{max-width:1100px;margin:auto}h1{font-size:36px}p{max-width:750px;line-height:1.6}section{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{padding:24px;border:1px solid #BDD6C4;border-radius:20px;background:white}article.reverse,article.white{background:#1A3329;color:#F4FBF6}article>img{width:100%;height:120px;object-fit:contain}.samples{display:flex;align-items:center;gap:50px}.samples img{width:100px;height:125px;object-fit:contain}.samples img+img{width:180px}.cover{width:100%;max-width:800px;border-radius:20px}a{color:inherit}footer{margin-top:30px}@media(max-width:700px){body{padding:20px}section{grid-template-columns:1fr}.samples{gap:20px}}</style><main><h1>Signature en mouvement.</h1><p>Le dessin B choisi : M arrondi, boucle et fleche montante. Palette encre / anis, six traitements, texte Plus Jakarta Sans converti en traces. Aucun asset actif de l’application n’a ete remplace.</p><p><a href="README.md">Guide des fichiers</a> · <a href="manifest.json">Inventaire</a> · <a href="motion/index.html">Voir les animations ↗</a></p><section>'''+gallery+'''</section><h2>Icones d’application</h2><section><article><img class="cover" src="app-icons/app-icon-mint-1024.png" alt="Icone fond menthe"></article><article class="reverse"><img class="cover" src="app-icons/app-icon-dark-1024.png" alt="Icone fond sombre"></article></section><h2>Partage</h2><img class="cover" src="social/share-card-1200.png" alt="Visuel de partage Moments Locaux"><footer>BRAND-SIGNATURE-B-001 · 06.11.2026 · Assets exportes, integration a realiser separement.</footer></main></html>''')

archive = root.parent / 'moments-locaux-signature-b.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            z.write(path, 'signature-b/'+str(path.relative_to(root)))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(f"Verified {len(manifest['files'])} exports; archive: {archive}")
