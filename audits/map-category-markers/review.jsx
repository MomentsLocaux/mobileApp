// Review fixture only: real Mapbox GL JS tiles/layers, production assets and grouping.
// This is not the React Native screen and is never imported by the application.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Users } from 'lucide-react-native';
import { colors } from '../../src/constants/theme';
import { CategoryEventMarker } from '../../src/components/map/CategoryEventMarker';
import { CATEGORY_VISUALS, CATEGORY_VISUAL_SLUGS, categoryMarkerImageKey } from '../../src/constants/category-visuals';
import { CATEGORY_MAP_MARKER_ASSETS, getMapMarkerLayout, MAP_MARKER_HITBOX } from '../../src/constants/map-marker-assets';
import { groupMapMarkerFeaturesByIcon, normalizeMapMarkerIconKey } from '../../src/utils/map-marker-features';

const pilots = Object.keys(CATEGORY_MAP_MARKER_ASSETS);
createRoot(document.getElementById('sprites')).render(<>{CATEGORY_VISUAL_SLUGS.map(slug => {
  const { Icon, fallbackColor, iconColor } = CATEGORY_VISUALS[slug];
  return <div key={slug}>
    <div id={`legacy-${slug}`} className="sprite"><CategoryEventMarker Icon={Icon} color={fallbackColor} iconColor={iconColor} /></div>
    <div id={`cluster-${slug}`} className="sprite"><CategoryEventMarker Icon={Icon} color={fallbackColor} variant="cluster" /></div>
  </div>;
})}<div id="default-symbol" className="sprite"><CategoryEventMarker Icon={Users} color={colors.brand.secondary} variant="symbol" size={48} /></div><div id="legacy-default" className="sprite"><CategoryEventMarker Icon={Users} color={colors.brand.secondary} /></div><div id="cluster-default" className="sprite"><CategoryEventMarker Icon={Users} color={colors.brand.secondary} variant="cluster" /></div></>);

const center = [4.8344, 45.764];
const fixture = [
  ['g1', 'gastronomie-saveurs', -0.0012, 0.00065, 'Les saveurs du quartier'],
  ['n1', 'nature-bienetre', 0.00115, -0.0007, 'Balade botanique'],
  ['a1', 'arts-culture', -0.0012, 0.0020, 'Théâtre en plein air'],
  ['m1', 'marches-artisanat', 0.0001, 0.0020, 'Marché des artisans'],
  ['f1', 'fetes-animations', 0.0013, 0.0020, 'Fête du quartier'],
  ['e1', 'famille-enfants', 0.0001, 0.00065, 'Jeux en famille'],
  ['l1', 'vie-locale', 0.0013, 0.00065, 'Rencontre des habitants'],
  ['w1', 'ateliers-apprentissage', -0.0012, -0.0007, 'Atelier découverte'],
  ['s1', 'sport-loisirs', -0.0005, -0.0020, 'Bouger ensemble'],
  ['i1', 'insolite-ephemere', 0.0009, -0.0020, 'Une rencontre inattendue'],
];
const feature = ([id, slug, x, y, title]) => ({ type: 'Feature', geometry: {type: 'Point', coordinates: [center[0] + x, center[1] + y]}, properties: {id, icon: categoryMarkerImageKey(slug), title} });
let events = fixture.map(feature);
let map, selected = null, baseline = false, sourceIds = [], initialReadyMs;
const errors = [];
const loadImage = url => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
const idle = () => new Promise(resolve => map.once('idle', resolve));
const layout = (key, scale = 1) => {
  const style = baseline ? {iconSize:scale,iconAnchor:'bottom',iconOffset:[0,2]} : getMapMarkerLayout(key, scale);
  return {'icon-image': baseline ? `legacy-${key}` : key, 'icon-size': style.iconSize, 'icon-anchor': style.iconAnchor, 'icon-offset': style.iconOffset, 'icon-allow-overlap': true, 'icon-ignore-placement': true};
};
function applySelection(id) {
  selected = events.find(f => f.properties.id === id) ?? null;
  for (const sourceId of sourceIds) map.setFilter(`${sourceId}-events`, ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], id ?? '']]);
  map.getSource('selected').setData({type:'FeatureCollection', features:selected ? [selected] : []});
  if (selected) for (const [k,v] of Object.entries(layout(normalizeMapMarkerIconKey(selected.properties.icon), 1.45 * 1.08))) map.setLayoutProperty('selected-event',k,v);
  document.getElementById('selection').textContent = selected ? `${selected.properties.title} · sélectionné` : 'Touchez une silhouette pour la sélectionner';
}
function setEvents(next) {
  events = next;
  applySelection(null);
  for (const { sourceId, shape } of groupMapMarkerFeaturesByIcon(events)) map.getSource(sourceId).setData(shape);
}

async function start() {
  const started = performance.now();
  mapboxgl.accessToken = await (await fetch('/token')).text();
  const mapStyle = new URLSearchParams(location.search).has('satellite') ? 'satellite-streets-v12' : 'streets-v12';
  map = new mapboxgl.Map({ container:'map', style:`mapbox://styles/mapbox/${mapStyle}`, center, zoom:15.7, attributionControl:true, preserveDrawingBuffer:true, fadeDuration:0 });
  map.on('error', e => errors.push(e.error?.message ?? String(e)));
  await new Promise(resolve => map.once('load', resolve));
  for (const slug of CATEGORY_VISUAL_SLUGS) {
    const key = categoryMarkerImageKey(slug);
    const legacy = await loadImage(`/sprites/legacy-${slug}.png`);
    map.addImage(`legacy-${key}`, legacy, { pixelRatio: 3 });
    const asset = CATEGORY_MAP_MARKER_ASSETS[slug];
    map.addImage(key, asset ? await loadImage(`/assets/${slug}@3x.png`) : legacy, { pixelRatio:3 });
    map.addImage(`category-cluster-marker-${slug}`, await loadImage(`/sprites/cluster-${slug}.png`), {pixelRatio:3});
  }
  map.addImage('category-marker-default', await loadImage('/sprites/default-symbol.png'), {pixelRatio:3});
  map.addImage('legacy-category-marker-default', await loadImage('/sprites/legacy-default.png'), {pixelRatio:3});
  map.addImage('category-cluster-marker-default', await loadImage('/sprites/cluster-default.png'), {pixelRatio:3});
  for (const {sourceId, iconKey, clusterIconKey, shape} of groupMapMarkerFeaturesByIcon(events)) {
    sourceIds.push(sourceId);
    map.addSource(sourceId, {type:'geojson', data:shape, cluster:true, clusterRadius:42, clusterMaxZoom:15});
    map.addLayer({id:`${sourceId}-clusters`, type:'symbol', source:sourceId, filter:['has','point_count'], layout:{'icon-image':clusterIconKey,'icon-size':['step',['get','point_count'],1,10,1.08,25,1.16],'icon-allow-overlap':true,'icon-ignore-placement':true}});
    map.addLayer({id:`${sourceId}-counts`, type:'symbol', source:sourceId, filter:['has','point_count'], layout:{'text-field':['to-string',['get','point_count']],'text-size':['step',['get','point_count'],12,10,11,25,10,100,9],'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#ffffff','text-halo-color':'rgba(15,23,25,0.45)','text-halo-width':0.6}});
    map.addLayer({id:`${sourceId}-events`, type:'symbol', source:sourceId, filter:['!', ['has','point_count']], layout:layout(iconKey)});
  }
  map.addSource('selected',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'selected-event',type:'symbol',source:'selected',layout:layout('category-marker-default')});
  map.on('click', async e => {
    const {width,height} = MAP_MARKER_HITBOX;
    const hit = map.queryRenderedFeatures([[e.point.x-width/2,e.point.y-height/2],[e.point.x+width/2,e.point.y+height/2]],{layers:['selected-event',...sourceIds.flatMap(id=>[`${id}-events`,`${id}-clusters`])]})[0];
    if (hit?.properties?.cluster) {
      const zoom = await new Promise((resolve,reject)=>map.getSource(hit.source).getClusterExpansionZoom(hit.properties.cluster_id,(err,z)=>err ? reject(err) : resolve(z)));
      map.easeTo({center:hit.geometry.coordinates,zoom,duration:260});
    } else applySelection(hit?.properties?.id ?? null);
  });
  await idle(); initialReadyMs = performance.now() - started;
  window.markerReview.ready = true;
}

window.markerReview = {
  palette:Object.fromEntries(pilots.map(slug=>[slug,CATEGORY_MAP_MARKER_ASSETS[slug].primaryColor])),
  categorySlugs:CATEGORY_VISUAL_SLUGS,
  ready:false, errors, get selectedId(){return selected?.properties.id;},
  get map(){return map;}, get features(){return events;}, get initialReadyMs(){return initialReadyMs;},
  start, idle, select:applySelection,
  async reset(){setEvents(fixture.map(feature));map.jumpTo({center,zoom:15.7});await idle();},
  async setBaseline(value){baseline=value;for(const {sourceId,iconKey} of groupMapMarkerFeaturesByIcon(events))for(const [k,v] of Object.entries(layout(iconKey)))map.setLayoutProperty(`${sourceId}-events`,k,v);applySelection(selected?.properties.id);await idle();},
  async dense(){setEvents(Array.from({length:1500},(_,i)=>feature([`dense-${i}`,CATEGORY_VISUAL_SLUGS[i%10],((i%50)-25)*0.00012,(Math.floor(i/50)-15)*0.00012,'Événement test'])));map.jumpTo({center,zoom:16});await idle();},
  async regroup(){setEvents(Array.from({length:36},(_,i)=>feature([`cluster-${i}`,'gastronomie-saveurs',(i%6)*0.00001,Math.floor(i/6)*0.00001,'Cluster test'])));map.jumpTo({center,zoom:12});await idle();},
  async fallback(){setEvents([{type:'Feature',geometry:{type:'Point',coordinates:center},properties:{id:'unknown',icon:'unexpected-category',title:'Catégorie inconnue'}}]);map.jumpTo({center,zoom:16});await idle();applySelection('unknown');await idle();},
  async changeZone(){setEvents(fixture.map(feature).map(f=>({...f,geometry:{...f.geometry,coordinates:[f.geometry.coordinates[0]+0.1,f.geometry.coordinates[1]+0.1]}})));map.jumpTo({center:[center[0]+0.1,center[1]+0.1],zoom:16});await idle();},
  async panZoom(){const frames=[];let last=performance.now(),raf;const tick=now=>{frames.push(now-last);last=now;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);const done=idle();map.easeTo({center:[center[0]+0.001,center[1]-0.001],zoom:16.4,duration:1500});await done;cancelAnimationFrame(raf);frames.sort((a,b)=>a-b);return{samples:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)]};},
};
