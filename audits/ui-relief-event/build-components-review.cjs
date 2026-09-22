const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('/private/tmp/avatar-builder-tools/node_modules/esbuild');
const root = path.resolve(__dirname, '../..');
const output = '/private/tmp/ui-relief-components';
fs.mkdirSync(output, { recursive: true });
const mocks = {
  '@/lib/supabase/client': 'export const supabase = {};',
  '@/utils/prefetch-event-media': 'export const prefetchEventMedia = () => {};',
  './EventResultCard': 'export const EventResultCard = () => null;',
  '@/services/event-card-stats.service': `export const EventCardStatsService = {
    getStatsForEvents: async ids => Object.fromEntries(ids.map(id => [id, window.__reviewStats[id]])),
    applyLikeToggle: (id, before, after, self, user, current) => ({...current, likesCount: Math.max(0, current.likesCount + Number(after) - Number(before))})
  };`,
};
const fonts = ['400Regular','500Medium','600SemiBold','700Bold'].map(name => `@font-face{font-family:PlusJakartaSans_${name};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/plus-jakarta-sans', name, `PlusJakartaSans_${name}.ttf`)).toString('base64')})}`).join('');
fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + fonts + 'html,body,#root{margin:0;width:100%;height:100%;display:flex;flex-direction:column}*{box-sizing:border-box}</style><div id="root"></div><script src="bundle.js"></script></html>');
esbuild.build({
 entryPoints: [path.join(__dirname, 'components-review.jsx')], outfile: path.join(output, 'bundle.js'),
 absWorkingDir: root, bundle: true, platform: 'browser', format: 'iife',
 alias: { 'react-native': 'react-native-web', '@': root + '/src' }, nodePaths: [root + '/node_modules'],
 resolveExtensions: ['.web.tsx','.web.ts','.web.jsx','.web.js','.tsx','.ts','.jsx','.js','.json'], loader: { '.ttf': 'dataurl', '.png': 'dataurl' },
 define: { 'process.env': '{}', global: 'globalThis', 'process.env.NODE_ENV': '"development"', __DEV__: 'true', 'process.env.EXPO_OS': '"web"' },
 plugins: [{ name: 'isolated-fixture', setup(build) {
  build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
  build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  build.onLoad({ filter: /\.[jt]sx?$/ }, async args => {
   if (!/react-native-(reanimated|worklets)|src\//.test(args.path)) return;
   const source = fs.readFileSync(args.path, 'utf8');
   const result = await require(root + '/node_modules/@babel/core').transformAsync(source, { filename: args.path, configFile: false, babelrc: false, parserOpts: { plugins: ['typescript','jsx'] }, plugins: [root + '/node_modules/react-native-worklets/plugin'] });
   return { contents: result.code, loader: /\.tsx?$/.test(args.path) ? 'tsx' : 'jsx' };
  });
 }}], logLevel: 'info',
}).catch(() => { process.exitCode = 1; });
