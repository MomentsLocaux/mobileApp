// Standalone QA entry, never a product route. Load its Metro .bundle in the dev client.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, Pressable, StyleSheet, NativeModules } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MapWrapper } from '../../src/components/map/MapWrapper';
import { CATEGORY_VISUAL_SLUGS, categoryMarkerImageKey } from '../../src/constants/category-visuals';
import { colors } from '../../src/constants/theme';

const region = {longitude:4.8344, latitude:45.764, zoom:15.7};
const reviewMode = NativeModules.SourceCode?.scriptURL?.match(/[?&]reviewMode=([a-z]+)/)?.[1] ?? 'pilots';
const makeFeature = (id, slug, x, y) => ({type:'Feature',properties:{id,icon:categoryMarkerImageKey(slug)},geometry:{type:'Point',coordinates:[region.longitude+x,region.latitude+y]}});
const pilots = [
  makeFeature('g1','gastronomie-saveurs',-.0012,.00065),
  makeFeature('n1','nature-bienetre',.00115,-.0007),
  makeFeature('a1','arts-culture',-.0012,.0020),
  makeFeature('m1','marches-artisanat',.0001,.0020),
  makeFeature('f1','fetes-animations',.0013,.0020),
  makeFeature('e1','famille-enfants',.0001,.00065),
  makeFeature('l1','vie-locale',.0013,.00065),
  makeFeature('w1','ateliers-apprentissage',-.0012,-.0007),
  makeFeature('s1','sport-loisirs',-.0005,-.0020),
  makeFeature('i1','insolite-ephemere',.0009,-.0020),
];

function App() {
  const map = useRef(null);
  const [ready,setReady] = useState(false);
  const [mode,setMode] = useState(['dense','clusters'].includes(reviewMode)?reviewMode:'pilots');
  const [selected,setSelected] = useState(reviewMode==='selected'?'g1':undefined);
  const [taps,setTaps] = useState(0);
  const satellite = reviewMode==='satellite';
  const onPress = useCallback(id=>{setSelected(id);setTaps(n=>n+1);},[]);
  useEffect(()=>{
    if(!ready)return;
    const features = mode==='dense' ? Array.from({length:1500},(_,i)=>makeFeature(`d${i}`,CATEGORY_VISUAL_SLUGS[i%10],((i%50)-25)*.00012,(Math.floor(i/50)-15)*.00012)) : mode==='clusters' ? Array.from({length:36},(_,i)=>makeFeature(`c${i}`,'gastronomie-saveurs',(i%6)*.00001,Math.floor(i/6)*.00001)) : pilots;
    map.current?.setShape({type:'FeatureCollection',features});
    map.current?.recenter({...region,zoom:mode==='clusters'?12:mode==='dense'?16:15.7});
  },[ready,mode]);
  return <View style={styles.page}>
    <View style={styles.header}><Text style={styles.title}>Moments Locaux</Text><Text style={styles.caption}>Carte native iOS · données de test</Text></View>
    <View style={styles.map}><MapWrapper ref={map} initialRegion={region} onMapReady={()=>setReady(true)} onFeaturePress={onPress} activeEventId={selected} onMapBackgroundPress={()=>setSelected(undefined)} styleURL={satellite?Mapbox.StyleURL.SatelliteStreet:Mapbox.StyleURL.Street} /></View>
    <View style={styles.footer}><Text style={styles.caption}>{ready?'Carte prête':'Chargement'} · {selected?`Sélection : ${selected}`:'Aucune sélection'} · taps natifs : {taps}</Text><View style={styles.row}>{[['pilots','10 catégories'],['dense','1 500 points'],['clusters','Clusters']].map(([value,label])=><Pressable key={value} onPress={()=>{setSelected(undefined);setMode(value);}} style={styles.button}><Text style={styles.caption}>{label}</Text></Pressable>)}</View><Text style={styles.caption}>10 silhouettes · couleurs de catégorie conservées</Text></View>
  </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.brand.page},header:{paddingTop:64,paddingBottom:18,paddingHorizontal:20},title:{fontSize:24,fontWeight:'700',color:colors.brand.text},caption:{fontSize:12,color:colors.brand.textSecondary},map:{flex:1},footer:{padding:16,paddingBottom:32,gap:12},row:{flexDirection:'row',gap:8},button:{padding:12,borderRadius:12,backgroundColor:colors.brand.surfaceMuted}});
registerRootComponent(App);
