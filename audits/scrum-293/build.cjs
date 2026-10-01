// Temporary review tools: npm install --prefix /private/tmp/scrum-290-tools --no-package-lock esbuild playwright-core
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const output = '/private/tmp/scrum-293-fixture';
fs.mkdirSync(output, { recursive: true });
require('/private/tmp/scrum-290-tools/node_modules/esbuild').buildSync({
  entryPoints: [path.join(__dirname, 'fixture.jsx')], bundle: true, outfile: path.join(output, 'bundle.js'),
  platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true', global: 'globalThis' },
  alias: { 'react-native': path.join(root, 'node_modules/react-native-web'), '@': path.join(root, 'src'), 'react-native-svg': path.join(root, 'node_modules/react-native-svg/src/ReactNativeSVG.web.ts') },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  loader: { '.js': 'jsx', '.ttf': 'dataurl' },
});
fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SCRUM-293 — glissement Agenda</title><style>body{margin:0}</style><div id="root"></div><script src="bundle.js"></script></html>');
