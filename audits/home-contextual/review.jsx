import React from 'react';
import {createRoot} from 'react-dom/client';
import {View, Text, Alert} from 'react-native';
import HomeScreen from '@/screens/home/HomeScreen';
import {BrandIcon} from '@/components/ui/BrandIcon';
import {useDiscoveryFiltersStore} from '@/store/discoveryFiltersStore';
import {useDiscoverySnapshotStore} from '@/store/discoverySnapshotStore';
import {useEventPreviewStore} from '@/store/eventPreviewStore';
import {useMapTransferStore} from '@/store/mapTransferStore';
import {applyTaxonomyCache} from '@/store/taxonomyStore';
import {colors} from '@/constants/theme';

applyTaxonomyCache({categories:[{id:'culture',slug:'arts-culture',label:'Arts & culture',color:'#7c3aed'},{id:'nature',slug:'nature-bienetre',label:'Nature & bien-être',color:'#22c55e'},{id:'musique',slug:'fetes-animations',label:'Fêtes & animations',color:'#f97316'},{id:'gastronomie',slug:'gastronomie-saveurs',label:'Gastronomie & saveurs',color:'#facc15'}],subcategories:[],tags:[]});
const date=(day,hour)=>new Date(2026,8,day,hour).toISOString();
const event=(id,title,day,hour,category='culture')=>({id,title,status:'published',visibility:'public',starts_at:date(day,hour),ends_at:date(day,hour+2),created_at:date(24,9),category,city:'Thionville',venue_name:'Parc Napoléon',latitude:49.36,longitude:6.16,likes_count:4,interests_count:8,media:[]});
const events=[event('next','Balade au fil de la Moselle',26,10,'nature'),event('music','Concert au bord de l’eau',25,19,'musique'),event('market','Les saveurs du marché nocturne',25,18,'gastronomie'),event('craft','Atelier céramique au jardin',25,18,'culture'),event('live','Promenade des remparts',25,14,'nature'),event('social','Festival des petites découvertes',26,16,'culture'),event('brunch','Le brunch des voisins',27,11,'gastronomie')];
window.review={events,saved:[events[0]],profile:{id:'me',display_name:'Camille'},location:{currentLocation:{coords:{latitude:49.36,longitude:6.16}},isLoading:false,error:null,requestPermission:()=>{}},listeners:new Set(),routes:[],requests:[],prefetch:[],delay:150,fail:false,failLike:false,likes:0,serverLiked:false};
window.review.update=(values)=>{Object.assign(window.review,values);window.review.listeners.forEach(cb=>cb())};
window.review.stores={filters:useDiscoveryFiltersStore,snapshots:useDiscoverySnapshotStore,preview:useEventPreviewStore,transfer:useMapTransferStore};
Alert.alert=(...args)=>{window.review.alert=args};
const cover=`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#E7DDD1"/><circle cx="200" cy="145" r="67" fill="#BA805B"/><ellipse cx="200" cy="110" rx="67" ry="30" fill="#6D4330"/><ellipse cx="200" cy="110" rx="49" ry="21" fill="#C99B74"/><text x="200" y="40" text-anchor="middle" fill="#432E24" font-size="22" font-family="sans-serif">ATELIER CÉRAMIQUE</text></svg>')}`;
const scenario=new URLSearchParams(location.search).get('scenario');
if(scenario==='images'){events.find(e=>e.id==='craft').cover_url=cover;events.find(e=>e.id==='market').cover_url='https://fixture.invalid/broken.jpg'}
if(scenario==='guest')window.review.profile=null;
if(scenario==='empty')window.review.events=[];
if(scenario==='offline')window.review.fail=true;
if(scenario==='no-location')window.review.location={...window.review.location,currentLocation:null};
if(scenario==='cache') {window.review.delay=1000;useEventPreviewStore.getState().rememberEvents(events);useDiscoverySnapshotStore.getState().setHomeSnapshot({center:{latitude:49.36,longitude:6.16},radiusKm:20,eventIds:events.map(e=>e.id),storedAt:Date.now(),queryKey:'fixture'});}
useDiscoverySnapshotStore.getState().markHydrated();
// Static tab chrome for framing; navigation assertions use the real Home actions and stores.
function Tabs(){return <View style={{height:64,backgroundColor:colors.brand.page,flexDirection:'row',justifyContent:'space-around',borderTopWidth:1,borderColor:colors.primary[100]}}>{[['home','Accueil'],['map','Carte'],['calendar','Agenda'],['user','Profil']].map(([name,label])=><View key={name} style={{alignItems:'center',paddingTop:6,gap:3}}><BrandIcon name={name} active={name==='home'} size={24}/><Text style={{fontSize:10,color:colors.brand.text}}>{label}</Text></View>)}</View>}
createRoot(document.getElementById('root')).render(<><HomeScreen/><Tabs/></>);
