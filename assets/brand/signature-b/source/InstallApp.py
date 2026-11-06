"""Install Signature B in active app/native resources. macOS, standard library + Swift.

Uses Generate.swift's vector geometry directly; never resizes an existing bitmap.
Run from any directory. --check validates the installed files against the manifest.
"""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import subprocess
import sys
import tempfile
from xml.etree import ElementTree as ET

repo = Path(__file__).resolve().parents[4]
pack = repo / 'assets/brand/signature-b'
manifest_path = repo / 'audits/brand-signature-native/installed-assets.json'

if '--check' in sys.argv:
    manifest = json.loads(manifest_path.read_text())
    for asset in manifest['files']:
        path = repo / asset['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256'], path
    print(f"Verified {len(manifest['files'])} installed Signature B resources")
    sys.exit(0)

installed = []


def copy(source, destination):
    target = repo / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(pack / source, target)
    installed.append(destination)


for target in ['assets/images/icon.png', 'assets/images/icon-meta-1024.png',
               'ios/MomentsLocaux/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png']:
    copy('app-icons/app-icon-mint-1024.png', target)
copy('symbols/mark-color-1024.png', 'assets/images/logo-mark.png')
copy('web/favicon-48.png', 'assets/images/favicon.png')

definitions = (pack / 'source/Generate.swift').read_text().split('\nlet styles:')[0]
native_writer = '''
func writeNative(_ scene: Scene, _ relative: String, _ size: Int) throws {
    let url = repo.appendingPathComponent(relative)
    try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let bitmap = scene.opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue
    let context = CGContext(data:nil,width:size,height:size,bitsPerComponent:8,bytesPerRow:size*4,
        space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:bitmap)!
    draw(scene,context,size,size)
    let output = CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil)!
    CGImageDestinationAddImage(output,context.makeImage()!,nil)
    guard CGImageDestinationFinalize(output) else { fatalError("Native PNG") }
}
let square = Scene(width:1024,height:1024,shapes:[rect(0,0,1024,1024,mint)] + symbol(ink,leaf,x:136,y:136,size:752),opaque:true)
let round = Scene(width:1024,height:1024,shapes:[Shape(path:CGPath(ellipseIn:CGRect(x:0,y:0,width:1024,height:1024),transform:nil),fill:mint,stroke:nil,width:0)] + symbol(ink,leaf,x:136,y:136,size:752),opaque:false)
let splash = Scene(width:288,height:288,shapes:symbol(ink,leaf,x:96,y:96,size:96),opaque:false)
let mark = Scene(width:32,height:32,shapes:symbol(ink,leaf),opaque:false)
'''
jobs = []
for density, size, splash_size in [('mdpi', 48, 288), ('hdpi', 72, 432),
                                  ('xhdpi', 96, 576), ('xxhdpi', 144, 864),
                                  ('xxxhdpi', 192, 1152)]:
    for suffix, scene in [('', 'square'), ('_round', 'round')]:
        jobs.append((scene, f'android/app/src/main/res/mipmap-{density}/ml_launcher_b{suffix}.png', size))
    jobs.append(('splash', f'android/app/src/main/res/drawable-{density}/splashscreen_logo.png', splash_size))
for scale in [1, 2, 3]:
    jobs.append(('mark', f'ios/MomentsLocaux/Images.xcassets/SplashScreenLogo.imageset/mark-{scale}x.png', 96 * scale))
for scene, path, size in jobs:
    native_writer += f'try writeNative({scene},"{path}",{size})\n'
    installed.append(path)
with tempfile.TemporaryDirectory(prefix='ml-signature-install-') as temporary:
    source = Path(temporary) / 'Native.swift'
    source.write_text(definitions + native_writer)
    subprocess.run(['swift', '-module-cache-path', '/private/tmp/brand-b-swift-cache', str(source)], cwd=repo, check=True)


def write(relative, content):
    target = repo / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    installed.append(relative)


write('ios/MomentsLocaux/Images.xcassets/SplashScreenLogo.imageset/Contents.json', json.dumps({
    'images': [{'filename': f'mark-{scale}x.png', 'idiom': 'universal', 'scale': f'{scale}x'} for scale in [1, 2, 3]],
    'info': {'version': 1, 'author': 'expo'},
}, indent=2) + '\n')

svg_paths = ET.parse(pack / 'symbols/mark-color.svg').getroot().findall('{http://www.w3.org/2000/svg}path')
for name, monochrome in [('foreground', False), ('monochrome', True)]:
    paths = '\n'.join(f'    <path android:pathData="{path.attrib["d"]}" android:fillColor="#00000000" '
                      f'android:strokeColor="{"#000000" if monochrome else path.attrib["stroke"]}" '
                      'android:strokeWidth="3.2" android:strokeLineCap="round" android:strokeLineJoin="round"/>'
                      for path in svg_paths)
    write(f'android/app/src/main/res/drawable/ml_launcher_b_{name}.xml',
          '<?xml version="1.0" encoding="utf-8"?>\n'
          '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n'
          '  <group android:scaleX="2.0625" android:scaleY="2.0625" android:translateX="21" android:translateY="21">\n'
          + paths + '\n  </group>\n</vector>\n')
for version in [26, 33]:
    mono = '  <monochrome android:drawable="@drawable/ml_launcher_b_monochrome"/>\n' if version >= 33 else ''
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '  <background android:drawable="@color/iconBackground"/>\n'
           '  <foreground android:drawable="@drawable/ml_launcher_b_foreground"/>\n'
           + mono + '</adaptive-icon>\n')
    for suffix in ['', '_round']:
        write(f'android/app/src/main/res/mipmap-anydpi-v{version}/ml_launcher_b{suffix}.xml', xml)

records = []
for relative in installed:
    path = repo / relative
    data = path.read_bytes()
    record = {'file': relative, 'sha256': hashlib.sha256(data).hexdigest()}
    if path.suffix == '.png':
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        record.update(zip(['width', 'height'], struct.unpack('>II', data[16:24])))
        record['transparent'] = data[25] in (4, 6)
    if path.suffix == '.xml':
        ET.fromstring(data)
    records.append(record)
manifest_path.parent.mkdir(parents=True, exist_ok=True)
manifest_path.write_text(json.dumps({'reference': 'BRAND-SIGNATURE-B-003', 'files': records}, indent=2) + '\n')
print(f'Installed {len(records)} Signature B resources; no original file removed')
