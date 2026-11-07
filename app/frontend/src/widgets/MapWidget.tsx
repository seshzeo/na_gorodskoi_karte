import {useEffect,useRef,useState} from "react";
import Map from "ol/Map";import View from "ol/View";import TileLayer from "ol/layer/Tile";import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";import VectorSource from "ol/source/Vector";import Feature from "ol/Feature";import PointGeom from "ol/geom/Point";
import Style from "ol/style/Style";import CircleStyle from "ol/style/Circle";import Fill from "ol/style/Fill";import Stroke from "ol/style/Stroke";
import {fromLonLat,toLonLat} from "ol/proj";import type {Point} from "../entities";import type {City} from "../shared/city/CityProvider";
import {usePoints} from "../entities/point/model/usePoints";import "ol/ol.css";
const CATEGORY_COLORS:Record<string,string>={"Ищу тебя":"#e34b83","MDPS":"#3478d4","Где бенз":"#e39a27"};
export function MapWidget({categoryId,city,onSelect,onMapClick}:{categoryId?:number;city:City;onSelect:(point:Point)=>void;onMapClick:(coordinates:{latitude:number;longitude:number})=>void}){
 const el=useRef<HTMLDivElement>(null);const map=useRef<Map|null>(null);const[bbox,setBbox]=useState<string>();
 useEffect(()=>{
  if(!el.current)return;
  const instance=new Map({target:el.current,layers:[new TileLayer({source:new OSM(),className:"base-map-layer"})],view:new View({center:fromLonLat([city.longitude,city.latitude]),zoom:12})});
  const update=()=>{const size=instance.getSize();if(!size)return;const extent=instance.getView().calculateExtent(size);const southwest=toLonLat([extent[0],extent[1]]);const northeast=toLonLat([extent[2],extent[3]]);setBbox([southwest[0],southwest[1],northeast[0],northeast[1]].join(","));};
  instance.on("moveend",update);map.current=instance;update();
  return()=>{instance.un("moveend",update);instance.setTarget(undefined);map.current=null;};
 },[]);
 useEffect(()=>{const instance=map.current;if(!instance)return;instance.getView().animate({center:fromLonLat([city.longitude,city.latitude]),zoom:12,duration:350});},[city.id,city.latitude,city.longitude]);
 const query=usePoints(bbox,categoryId);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  const source=new VectorSource();
  const layer=new VectorLayer({source,style:feature=>{
   const category=String(feature?.get("categoryName")??"");
   return new Style({image:new CircleStyle({radius:8,fill:new Fill({color:CATEGORY_COLORS[category]??"#64748b"}),stroke:new Stroke({color:"#ffffff",width:2})})});
  }});
  (query.data??[]).forEach(point=>source.addFeature(new Feature({geometry:new PointGeom(fromLonLat([point.longitude,point.latitude])),pointId:point.id,categoryName:point.category_name})));
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
