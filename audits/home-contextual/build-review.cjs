const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('/private/tmp/avatar-builder-tools/node_modules/esbuild');
const root = path.resolve(__dirname, '../..');
const output = '/private/tmp/home-contextual-review';
fs.mkdirSync(output, { recursive: true });
const mocks = {
  '@/lib/supabase/client': 'export const supabase = {};',
  '@/utils/prefetch-event-media': 'export const prefetchEventMedia = e => window.review.prefetch.push(e.id);',
  '@/hooks': `import {useSyncExternalStore} from 'react'; const sub = cb => {window.review.listeners.add(cb); return ()=>window.review.listeners.delete(cb)}; export const useAuth=()=>({profile:useSyncExternalStore(sub,()=>window.review.profile)}); export const useLocation=()=>useSyncExternalStore(sub,()=>window.review.location);`,
  '@/hooks/useLumiaTourTarget': 'export const useLumiaTourTarget = () => undefined;',
  'expo-router': 'const router={push: route=>window.review.routes.push(route)}; export const useRouter=()=>router;',
  '@react-navigation/native': `import {useEffect} from 'react'; export const useFocusEffect=fn=>useEffect(fn,[fn]);`,
  'react-native-safe-area-context': 'export const useSafeAreaInsets=()=>({top:20,bottom:0,left:0,right:0});',
  '@/store': `export {useDiscoveryFiltersStore} from '@/store/discoveryFiltersStore'; export {useFavoritesStore} from '@/store/favoritesStore'; export {useLikesStore} from '@/store/likesStore'; export {useMapTransferStore} from '@/store/mapTransferStore';`,
  './persistStorage': 'export const persistStorage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};',
  '@/components/ui': `export {UserAvatar} from '@/components/ui/UserAvatar'; export {EmptyState} from '@/components/ui/EmptyState';`,
  '@/services/agenda.service': `export const AgendaService={listInterestedEventIds:async()=>window.review.saved.map(e=>e.id),listParticipatingEventIds:async()=>[],getEventsByIds:async ids=>window.review.events.filter(e=>ids.includes(e.id))};`,
  '@/services/preferences.service': `export const PreferencesService={getMine:async()=>({preferred_category_slugs:['nature']})};`,
  '@/services/notifications.service': `export const NotificationsService={getUnreadCount:async()=>2};`,
  '@/services/event-card-stats.service': `export const EventCardStatsService={getStatsForEvents:async ids=>Object.fromEntries(ids.map(id=>[id,{friendsGoingCount:id==='social'?2:0,likers:[]}]))};`,
  '@/utils/bbox-event-fetch': `export const listMapViewportForMap=async params=>{window.review.requests.push(params);const events=window.review.events;const failure=window.review.fail;const delay=window.review.delay;await new Promise(r=>setTimeout(r,delay));if(failure)throw Error('fixture offline');return {events};};`,
  '@/services/social.service': `export const SocialService={like:async()=>{window.review.likes++;await new Promise(r=>setTimeout(r,150));if(window.review.failLike)throw Error('fixture failure');window.review.serverLiked=!window.review.serverLiked;return window.review.serverLiked},toggleFavorite:async()=>window.review.serverLiked,unlike:async()=>{window.review.serverLiked=false},removeFavorite:async()=>{}};`,
};
const fonts = ['400Regular','500Medium','600SemiBold','700Bold'].map(name => `@font-face{font-family:PlusJakartaSans_${name};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/plus-jakarta-sans', name, `PlusJakartaSans_${name}.ttf`)).toString('base64')})}`).join('');
fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + fonts + 'html,body,#root{margin:0;width:100%;height:100%;display:flex;flex-direction:column}*{box-sizing:border-box}</style><div id="root"></div><script src="bundle.js"></script></html>');
esbuild.build({
 entryPoints: [path.join(__dirname, 'review.jsx')], outfile: path.join(output, 'bundle.js'),
 jsx: 'automatic', absWorkingDir: root, bundle: true, platform: 'browser', format: 'iife',
 alias: { 'react-native': 'react-native-web', '@': root + '/src' }, nodePaths: [root + '/node_modules'],
 resolveExtensions: ['.web.tsx','.web.ts','.web.jsx','.web.js','.tsx','.ts','.jsx','.js','.json'], loader: { '.js': 'jsx', '.ttf': 'dataurl', '.png': 'dataurl' },
 define: { 'process.env': '{}', global: 'globalThis', 'process.env.NODE_ENV': '"development"', __DEV__: 'true', 'process.env.EXPO_OS': '"web"', 'process.env.EXPO_PUBLIC_FEATURE_LUMIA_CHAT': '"true"' },
 plugins: [{ name: 'isolated-fixture', setup(build) {
  build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
  build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: root }));
  build.onLoad({ filter: /\.[jt]sx?$/ }, async args => {
   if (!/react-native-(reanimated|worklets)|src\//.test(args.path)) return;
   let source = fs.readFileSync(args.path, 'utf8');
   if (args.path.endsWith('/hooks/useHomeFeed.ts')) source = source.replace('  return {\n    profile,', '  return window.review.feed = {\n    profile,');
   const result = await require(root + '/node_modules/@babel/core').transformAsync(source, { filename: args.path, configFile: false, babelrc: false, parserOpts: { plugins: ['typescript','jsx'] }, plugins: [root + '/node_modules/react-native-worklets/plugin'] });
   return { contents: result.code, loader: /\.tsx?$/.test(args.path) ? 'tsx' : 'jsx' };
  });
 }}], logLevel: 'info',
}).catch(() => { process.exitCode = 1; });
