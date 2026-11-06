import {useState} from "react";import {useMutation,useQueryClient} from "@tanstack/react-query";
import type {Category,Point,PointRequest} from "../../entities";import {useCategories} from "../../entities/category/model/useCategories";
import {CategoryFilter} from "../../features/filter-points/ui/CategoryFilter";import {useCity} from "../../shared/city/CityProvider";
import {api,ApiError} from "../../shared/api";import {MapWidget} from "../../widgets/MapWidget";
type Coordinates={latitude:number;longitude:number};
export function MapPage(){
 const [cat,setCat]=useState<number>();const [selected,setSelected]=useState<Point>();const [open,setOpen]=useState(false);const [initialCoordinates,setInitialCoordinates]=useState<Coordinates>();
 const categories=useCategories();const {city}=useCity();
 const openCreate=(coordinates:Coordinates)=>{setSelected(undefined);setInitialCoordinates(coordinates);setOpen(true);};
 return <section className="map-page">
  <div className="map-toolbar"><div><span className="page-kicker">Исследуйте город</span><h1>Карта города · {city.name}</h1></div>
   <div className="map-toolbar-actions"><CategoryFilter value={cat} onChange={setCat}/><button className="button button-primary" onClick={()=>openCreate({latitude:city.latitude,longitude:city.longitude})}><span>＋</span> Добавить точку</button></div>
  </div>
  <div className="map-stage"><MapWidget categoryId={cat} city={city} onSelect={point=>{setOpen(false);setSelected(point);}} onMapClick={openCreate}/>
   {selected&&<aside className="point-card" aria-label="Выбранная точка"><div className="point-card-head"><span className="category-chip">{selected.category_name}</span><button className="icon-button close-card" onClick={()=>setSelected(undefined)} aria-label="Закрыть карточку">×</button></div>
    <h2>{selected.title}</h2><div className="point-date">◷ {new Intl.DateTimeFormat("ru-RU",{dateStyle:"medium",timeStyle:"short"}).format(new Date(selected.event_at))}</div><p>{selected.description}</p><div className="point-author">Добавил: {selected.author_name}</div>
   </aside>}
  </div>
  {open&&<CreateModal key={`${initialCoordinates?.latitude},${initialCoordinates?.longitude}`} categories={categories.data??[]} initialCoordinates={initialCoordinates??city} onClose={()=>setOpen(false)}/>}
 </section>;
}
function CreateModal({categories,initialCoordinates,onClose}:{categories:Category[];initialCoordinates:Coordinates;onClose:()=>void}){
 const qc=useQueryClient();const [f,setF]=useState({author_name:"",title:"",description:"",category_id:"",latitude:String(initialCoordinates.latitude),longitude:String(initialCoordinates.longitude),event_at:""});
 const mutation=useMutation({mutationFn:(payload:PointRequest)=>api("/point-requests",{method:"POST",body:JSON.stringify(payload)}),onSuccess:()=>{qc.invalidateQueries({queryKey:["points"]});onClose();}});
 const set=(key:keyof typeof f,value:string)=>setF(current=>({...current,[key]:value}));
 const error=mutation.error instanceof ApiError?String(mutation.error.detail):mutation.isError?"Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.":"";
 return <div className="dialog-backdrop" onMouseDown={onClose}><form className="dialog form-dialog" onSubmit={event=>{event.preventDefault();mutation.mutate({author_name:f.author_name.trim(),title:f.title.trim(),description:f.description.trim(),category_id:Number(f.category_id),latitude:Number(f.latitude),longitude:Number(f.longitude),event_at:new Date(f.event_at).toISOString()});}} onMouseDown={event=>event.stopPropagation()}>
  <div className="dialog-heading"><div><span className="page-kicker">Новая публикация</span><h2>Предложить точку</h2><p>Заявка появится на карте после проверки модератором.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></div>
  <div className="form-grid">
   <label className="form-field"><span>Название <b>*</b></span><input required maxLength={160} value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Например, городское событие"/></label>
   <label className="form-field"><span>Категория <b>*</b></span><select required value={f.category_id} onChange={e=>set("category_id",e.target.value)}><option value="">Выберите категорию</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
   <label className="form-field form-field-wide"><span>Описание <b>*</b></span><textarea required maxLength={5000} value={f.description} onChange={e=>set("description",e.target.value)} placeholder="Расскажите, почему эта точка будет полезна горожанам."/></label>
   <div className="form-field form-field-wide"><span>Местоположение <b>*</b></span><div className="coordinate-grid">
    <label className="form-field"><span>Широта</span><input required type="number" min="-90" max="90" step="any" value={f.latitude} onChange={e=>set("latitude",e.target.value)}/></label>
    <label className="form-field"><span>Долгота</span><input required type="number" min="-180" max="180" step="any" value={f.longitude} onChange={e=>set("longitude",e.target.value)}/></label>
   </div><small className="field-hint">Координаты автоматически заполнены по выбранному месту на карте. Их можно уточнить вручную.</small></div>
   <label className="form-field"><span>Дата и время события <b>*</b></span><input required type="datetime-local" max={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} value={f.event_at} onChange={e=>set("event_at",e.target.value)}/><small className="field-hint">Указывайте только дату и время уже прошедшего события.</small></label>
   <label className="form-field"><span>Ваше имя <b>*</b></span><input required maxLength={120} value={f.author_name} onChange={e=>set("author_name",e.target.value)} placeholder="Как к вам обращаться"/></label>
  </div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="dialog-footer"><button type="button" className="button button-secondary" onClick={onClose}>Отмена</button><button className="button button-primary" disabled={mutation.isPending||!f.category_id}>{mutation.isPending?"Отправляем…":"Отправить заявку"}</button></div>
 </form></div>;
}
