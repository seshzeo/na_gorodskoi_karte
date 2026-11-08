import {createContext,useContext,useMemo,useState,type ReactNode} from "react";
export type City={id:string;name:string;latitude:number;longitude:number};
export const CITIES:City[]=[
{id:"balakovo",name:"Балаково",latitude:52.033,longitude:47.783},
{id:"volsk",name:"Вольск",latitude:52.045,longitude:47.387},
{id:"moscow",name:"Москва",latitude:55.751,longitude:37.618},
{id:"saint-petersburg",name:"Санкт-Петербург",latitude:59.938,longitude:30.316},
{id:"saratov",name:"Саратов",latitude:51.533,longitude:46.034},
{id:"samara",name:"Самара",latitude:53.195,longitude:50.106},
{id:"kazan",name:"Казань",latitude:55.796,longitude:49.108},
{id:"nizhny-novgorod",name:"Нижний Новгород",latitude:56.326,longitude:44.006},
{id:"volgograd",name:"Волгоград",latitude:48.708,longitude:44.514},
{id:"rostov-on-don",name:"Ростов-на-Дону",latitude:47.222,longitude:39.718},
{id:"krasnodar",name:"Краснодар",latitude:45.035,longitude:38.975},
{id:"ufa",name:"Уфа",latitude:54.738,longitude:55.972},
{id:"yekaterinburg",name:"Екатеринбург",latitude:56.838,longitude:60.605},
{id:"chelyabinsk",name:"Челябинск",latitude:55.160,longitude:61.402},
{id:"perm",name:"Пермь",latitude:58.010,longitude:56.234},
{id:"novosibirsk",name:"Новосибирск",latitude:55.008,longitude:82.935},
{id:"omsk",name:"Омск",latitude:54.989,longitude:73.368},
{id:"voronezh",name:"Воронеж",latitude:51.660,longitude:39.200},
{id:"tyumen",name:"Тюмень",latitude:57.153,longitude:65.534},
{id:"orenburg",name:"Оренбург",latitude:51.768,longitude:55.097},
];
type CityContextValue={city:City;setCity:(id:string)=>void};
const CityContext=createContext<CityContextValue|null>(null);
export function CityProvider({children}:{children:ReactNode}){
 const [cityId,setCityId]=useState("balakovo");
 const city=CITIES.find(item=>item.id===cityId)??CITIES[0];
 const value=useMemo(()=>({city,setCity:setCityId}),[city]);
 return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}
export function useCity(){const context=useContext(CityContext);if(!context)throw new Error("useCity must be used inside CityProvider");return context;}
