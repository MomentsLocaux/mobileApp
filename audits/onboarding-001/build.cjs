const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('/private/tmp/scrum-290-tools/node_modules/esbuild');
const root = path.resolve(__dirname, '../..');
const output = '/private/tmp/onboarding-001-review';
fs.mkdirSync(output, { recursive: true });
const mocks = {
  '../../components/ui': `export {AppBackground} from '@/components/ui/AppBackground'; export {Button} from '@/components/ui/Button'; export {UserAvatar} from '@/components/ui/UserAvatar';`,
  '../../hooks': `const profile={id:'review',display_name:'',role:'particulier'}; const user={id:'review'}; const refreshProfile=async()=>profile; export const useAuth=()=>({profile,user,refreshProfile});`,
  'expo-router': `const router={replace:r=>window.review.routes.push(r),back:()=>window.review.routes.push('back'),canGoBack:()=>true}; export const useRouter=()=>router; export const useLocalSearchParams=()=>({replay:new URLSearchParams(location.search).get('replay')});`,
  'react-native-safe-area-context': 'export const useSafeAreaInsets=()=>({top:20,bottom:20,left:0,right:0});',
  '@/utils/haptics': 'export const haptics={selection(){},light(){},success(){}};',
  '@/hooks/useImagePicker': 'export const useImagePicker=()=>({pickImage:async()=>null,takePhoto:async()=>null});',
  '@/hooks/useTaxonomy': 'export const useTaxonomy=()=>({});',
  '@/store/taxonomyStore': 'const state={categoriesMap:{}}; export const useTaxonomyStore=fn=>fn(state); useTaxonomyStore.getState=()=>state;',
  '@/store': 'export const useDiscoveryFiltersStore={getState:()=>({setPlace:place=>window.review.place=place,addPlaceHistory(){}})};',
  '@/services/settings-tour-reminder.service': 'export const rememberAppFirstOpen=async()=>{};',
  '@/services/profile.service': 'export const ProfileService={updateProfile:async(id,p)=>{window.review.profiles.push(p)}};',
  '@/services/preferences.service': 'export const PreferencesService={updateMine:async(id,p)=>window.review.preferences.push(p)};',
  '@/services/mapbox.service': `export const MapboxService={search:async query=>query==='zzz'?[]:[{label:'Nyons, Drôme, France',city:'Nyons',region:'Drôme',latitude:44.36,longitude:5.14}]};`,
  '@/services/push.service': 'export const setHomeLocationFromCoords=async()=>true; export const requestNotificationPermission=async()=>false; export const registerForPushNotificationsAsync=async()=>{};',
  '@/services/subscription.service': 'export const PREMIUM_PLANS={monthly:{label:"Mois"},annual:{label:"Année"}}; export const ECLAIREUR_PLANS=PREMIUM_PLANS; export const HABITUE_PLANS=PREMIUM_PLANS;',
  '@/services/analytics.service': 'export const AnalyticsService={track(){}};',
  '@/lib/supabase/client': 'export const supabase={};',
  '@/hooks/useProximityAlerts': 'export const requestProximityLocationPermissions=async()=>false;',
  '@/services/proximity-alert.service': 'export const ProximityAlertService={clearLocalThrottle:async()=>{}};',
  '@/tasks/proximity-location': 'export const startProximityBackgroundAlerts=async()=>{};',
  'expo-location': 'export const getForegroundPermissionsAsync=async()=>({status:"denied"}); export const requestForegroundPermissionsAsync=getForegroundPermissionsAsync;',
  'expo-notifications': 'export const getPermissionsAsync=async()=>({status:"denied"});',
  'react-native-toast-message': 'export default {show(){}};',
};
const fonts = ['400Regular','500Medium','600SemiBold','700Bold'].map(name => `@font-face{font-family:PlusJakartaSans_${name};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(root, 'node_modules/@expo-google-fonts/plus-jakarta-sans', name, `PlusJakartaSans_${name}.ttf`)).toString('base64')})}`).join('');
fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + fonts + 'html,body,#root{margin:0;width:100%;height:100%;display:flex;flex-direction:column}*{box-sizing:border-box}</style><div id="root"></div><script src="bundle.js"></script></html>');
esbuild.build({
 entryPoints: [path.join(__dirname,'review.jsx')], outfile: path.join(output,'bundle.js'),
 jsx:'automatic',absWorkingDir:root,bundle:true,platform:'browser',format:'iife',
 alias:{'react-native':'react-native-web','@':root+'/src'},nodePaths:[root+'/node_modules'],
 resolveExtensions:['.web.tsx','.web.ts','.web.jsx','.web.js','.tsx','.ts','.jsx','.js','.json'],loader:{'.js':'jsx','.ttf':'dataurl','.png':'dataurl'},
 define:{'process.env':'{}',global:'globalThis','process.env.NODE_ENV':'"development"',__DEV__:'true','process.env.EXPO_OS':'"web"'},
 plugins:[{name:'isolated-fixture',setup(build){
  build.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:'mock'}:undefined);
  build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:root}));
  build.onLoad({filter:/\.[jt]sx?$/},async args=>{
   if(!/react-native-(reanimated|worklets)|src\//.test(args.path))return;
   const result=await require(root+'/node_modules/@babel/core').transformAsync(fs.readFileSync(args.path,'utf8'),{filename:args.path,configFile:false,babelrc:false,parserOpts:{plugins:['typescript','jsx']},plugins:[root+'/node_modules/react-native-worklets/plugin']});
   return {contents:result.code,loader:/\.tsx?$/.test(args.path)?'tsx':'jsx'};
  });
 }}],logLevel:'info',
}).catch(()=>{process.exitCode=1});
