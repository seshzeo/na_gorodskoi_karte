import {useEffect,useRef,useState} from "react";
import Map from "ol/Map";import View from "ol/View";import TileLayer from "ol/layer/Tile";import OSM from "ol/source/OSM";import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";import VectorSource from "ol/source/Vector";import LayerGroup from "ol/layer/Group";import Feature from "ol/Feature";import PointGeom from "ol/geom/Point";
import Style from "ol/style/Style";import CircleStyle from "ol/style/Circle";import Fill from "ol/style/Fill";import Stroke from "ol/style/Stroke";
import {fromLonLat,toLonLat} from "ol/proj";import {apply as applyMapStyle} from "ol-mapbox-style";import type {Point} from "../entities";import type {City} from "../shared/city/CityProvider";
import {usePoints} from "../entities/point/model/usePoints";import "ol/ol.css";
const CATEGORY_COLORS:Record<string,string>={"Ищу тебя":"#e34b83","MDPS":"#3478d4","Где бенз":"#e39a27"};
const createBaseSource=()=>{
 const url=(import.meta.env.VITE_MAP_TILE_URL??"").trim();
 const attributions=(import.meta.env.VITE_MAP_TILE_ATTRIBUTION??"").trim();
 return url?new XYZ({url,attributions:attributions||undefined}):new OSM();
};
const loadMapStyle=async(url:string)=>{
 if(!url.startsWith("/")&&!url.startsWith("./"))return url;
 const response=await fetch(url);
 if(!response.ok)throw new Error(`Map style request failed (${response.status})`);
 const style=await response.json();
 const apiKey=(import.meta.env.VITE_MAPTILER_API_KEY??"").trim();
 const replaceKey=(value:unknown):unknown=>{
  if(typeof value==="string"){
   if(value.includes("__MAPTILER_KEY__")&&!apiKey)throw new Error("VITE_MAPTILER_API_KEY is required for this map style");
   return value.replaceAll("__MAPTILER_KEY__",encodeURIComponent(apiKey));
  }
  if(Array.isArray(value))return value.map(replaceKey);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,replaceKey(item)]));
  return value;
 };
 return replaceKey(style);
};
export function MapWidget({categoryId,city,onSelect,onMapClick}:{categoryId?:number;city:City;onSelect:(point:Point)=>void;onMapClick:(coordinates:{latitude:number;longitude:number})=>void}){
 const el=useRef<HTMLDivElement>(null);const map=useRef<Map|null>(null);const styleRequest=useRef(0);const[bbox,setBbox]=useState<string>();
 const[theme,setTheme]=useState<"light"|"dark">(()=>document.documentElement.dataset.theme==="dark"?"dark":"light");
 useEffect(()=>{
  const observer=new MutationObserver(()=>setTheme(document.documentElement.dataset.theme==="dark"?"dark":"light"));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!el.current)return;
  const instance=new Map({target:el.current,layers:[new LayerGroup()],view:new View({center:fromLonLat([city.longitude,city.latitude]),zoom:12})});
  const update=()=>{const size=instance.getSize();if(!size)return;const extent=instance.getView().calculateExtent(size);const southwest=toLonLat([extent[0],extent[1]]);const northeast=toLonLat([extent[2],extent[3]]);setBbox([southwest[0],southwest[1],northeast[0],northeast[1]].join(","));};
  instance.on("moveend",update);map.current=instance;update();
  return()=>{instance.un("moveend",update);instance.setTarget(undefined);map.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  const request=++styleRequest.current;
  const isCurrent=()=>styleRequest.current===request&&map.current===instance;
  const lightUrl=(import.meta.env.VITE_MAP_STYLE_URL??"").trim();
  const darkUrl=(import.meta.env.VITE_MAP_STYLE_URL_DARK??"").trim();
  const styleUrl=theme==="dark"?darkUrl||lightUrl:lightUrl;
  const fallbackGroup=()=>{const group=new LayerGroup();group.getLayers().push(new TileLayer({source:createBaseSource(),className:"base-map-layer"}));return group;};
  if(!styleUrl){instance.setLayerGroup(fallbackGroup());return;}
  const group=new LayerGroup();
  void loadMapStyle(styleUrl)
   .then(style=>applyMapStyle(group,style))
   .then(()=>{if(isCurrent())instance.setLayerGroup(group);})
   .catch(error=>{
    if(!isCurrent())return;
    console.error("Failed to load map style; using the fallback tile layer.",error);
    instance.setLayerGroup(fallbackGroup());
   });
  return()=>{styleRequest.current++;};
 },[theme]);
 useEffect(()=>{const instance=map.current;if(!instance)return;instance.getView().animate({center:fromLonLat([city.longitude,city.latitude]),zoom:12,duration:350});},[city.id,city.latitude,city.longitude]);
 const query=usePoints(bbox,categoryId);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  const source=new VectorSource();
  const layer=new VectorLayer({source,style:feature=>{
   const category=String(feature?.get("categoryName")??"");
   const permanent=feature?.get("pointType")==="permanent";
   return new Style({image:new CircleStyle({radius:permanent?10:8,fill:new Fill({color:permanent?"#16856b":CATEGORY_COLORS[category]??"#64748b"}),stroke:new Stroke({color:"#ffffff",width:2})})});
  }});
  (query.data??[]).forEach(point=>source.addFeature(new Feature({geometry:new PointGeom(fromLonLat([point.longitude,point.latitude])),pointId:point.id,categoryName:point.category_name,pointType:point.point_type})));
  const click=(event:any)=>{
   const hit=instance.forEachFeatureAtPixel(event.pixel,feature=>feature);
   if(hit){const point=(query.data??[]).find(item=>item.id===hit.get("pointId"));if(point)onSelect(point);return;}
   const [longitude,latitude]=toLonLat(event.coordinate);onMapClick({latitude,longitude});
  };
  instance.addLayer(layer);instance.on("singleclick",click);
  return()=>{instance.un("singleclick",click);instance.removeLayer(layer);};
 },[query.data,onSelect,onMapClick]);
 return <div className="map"><div ref={el} className="map-canvas"/>{query.isFetching&&<div className="status">Загрузка…</div>}{query.isError&&<div className="status error">Ошибка загрузки точек</div>}</div>;
}
