const API=(import.meta.env.VITE_API_URL||"/api/v1").replace(/\/$/,"");
export class ApiError extends Error{constructor(public status:number,public code:string,public detail:unknown){super(typeof detail==="string"?detail:code)}}
export async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch(API+path,{...init,headers:{Accept:"application/json",...(init?.body?{"Content-Type":"application/json"}:{}),...init?.headers}});
 if(!r.ok){let p:any={};try{p=await r.json()}catch{}throw new ApiError(r.status,p.code||"http_error",p.detail||r.statusText)}
 return r.status===204?undefined as T:r.json();
}