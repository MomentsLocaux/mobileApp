// Temporary review tools: npm install --prefix /private/tmp/scrum-290-tools --no-package-lock esbuild playwright-core
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const agenda = process.argv.includes('--agenda');
const output = agenda ? '/private/tmp/ui-agenda-fixture' : '/private/tmp/ui-categories-fixture';
fs.mkdirSync(output, { recursive: true });
require('/private/tmp/scrum-290-tools/node_modules/esbuild').buildSync({
  entryPoints: [path.join(__dirname, agenda ? 'agenda-fixture.jsx' : 'fixture.jsx')], bundle: true, outfile: path.join(output, 'bundle.js'),
  platform: 'browser', jsx: 'automatic', define: { 'process.env': '{}', global: 'globalThis', 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
  alias: { 'react-native-reanimated': path.join(__dirname, 'motion-stubs.jsx'), 'react-native-safe-area-context': path.join(__dirname, 'motion-stubs.jsx'), '@/hooks/useReduceMotion': path.join(__dirname, 'motion-stubs.jsx'), '@/components/DateRangePicker': path.join(__dirname, 'motion-stubs.jsx'), '@/hooks': path.join(__dirname, 'card-stubs.jsx'), '@/components/ui/UserAvatar': path.join(__dirname, 'card-stubs.jsx'), '@/components/events/EventCoverImage': path.join(__dirname, 'card-stubs.jsx'), '@/components/events/EventHeartButton': path.join(__dirname, 'card-stubs.jsx'), '@/utils/prefetch-event-media': path.join(__dirname, 'card-stubs.jsx'), '@/store/taxonomyStore': path.join(__dirname, 'taxonomy.js'), 'react-native': path.join(root, 'node_modules/react-native-web'), '@': path.join(root, 'src'), 'react-native-svg': path.join(root, 'node_modules/react-native-svg/src/ReactNativeSVG.web.ts') },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  loader: { '.js': 'jsx', '.ttf': 'dataurl' },
});
fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI-CATEGORIES-001 — revue des sélecteurs</title><style>body{margin:0}</style><div id="root"></div><script src="bundle.js"></script></html>');
