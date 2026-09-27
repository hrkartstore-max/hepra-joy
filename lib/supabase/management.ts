import "server-only";

const BASE="https://api.supabase.com/v1";
type Json=Record<string,unknown>;

function token(){
 const value=process.env.SUPABASE_MANAGEMENT_API_TOKEN;
 if(!value) throw new Error("CONFIGURATION REQUIRED: SUPABASE_MANAGEMENT_API_TOKEN");
 return value;
}
async function request<T=Json>(path:string,init:RequestInit={},idempotencyKey?:string):Promise<T>{
 const headers=new Headers(init.headers);
 headers.set("Authorization","Bearer "+token());
 headers.set("Accept","application/json");
 if(init.body) headers.set("Content-Type","application/json");
 if(idempotencyKey) headers.set("Idempotency-Key",idempotencyKey);
 const r=await fetch(BASE+path,{...init,headers,cache:"no-store"});
 const body=await r.text();
 let data:unknown=null; try{data=body?JSON.parse(body):null}catch{}
 if(!r.ok){
   const message=typeof data==="object"&&data&&"message" in data?String((data as {message?:unknown}).message):"provider request failed";
   throw new Error("SUPABASE_PROVIDER_ERROR:"+r.status+":"+message.slice(0,180));
 }
 return data as T;
}
export function isConfigured(){return Boolean(process.env.SUPABASE_MANAGEMENT_API_TOKEN)}
export async function createProject(input:{name:string;organizationSlug:string;regionGroup:string;dbPassword:string;idempotencyKey:string}){
 return request<{id:string;ref:string;name:string;region?:string;status?:string;organization_id?:string}>("/projects",{method:"POST",body:JSON.stringify({
   name:input.name,organization_slug:input.organizationSlug,db_pass:input.dbPassword,
   region_selection:{type:"smartGroup",code:input.regionGroup},desired_instance_size:"micro"
 })},input.idempotencyKey);
}
export async function getProject(ref:string){return request<{id:string;ref:string;name:string;region?:string;status?:string}>(`/projects/${encodeURIComponent(ref)}`)}
export async function getHealth(ref:string){return request<Record<string,{status?:string}>>(`/projects/${encodeURIComponent(ref)}/health?services=auth,db,storage`)}
export async function getApiKeys(ref:string){return request<Array<{type:string;api_key?:string;prefix?:string}>>(`/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`)}
export async function applyMigration(ref:string,name:string,query:string,idempotencyKey:string){
 return request(`/projects/${encodeURIComponent(ref)}/database/migrations`,{method:"POST",body:JSON.stringify({name,query})},idempotencyKey);
}
export async function listMigrations(ref:string){return request<Array<{version?:string;name?:string}>>(`/projects/${encodeURIComponent(ref)}/database/migrations`)}
export async function configureAuth(ref:string,config:Json){return request(`/projects/${encodeURIComponent(ref)}/config/auth`,{method:"PATCH",body:JSON.stringify(config)})}
export async function configureStorage(ref:string,config:Json){return request(`/projects/${encodeURIComponent(ref)}/config/storage`,{method:"PATCH",body:JSON.stringify(config)})}
export async function verifyProject(ref:string){
 const health=await getHealth(ref);
 const statuses=Object.values(health).map(x=>String(x?.status||"").toUpperCase());
 if(statuses.some(x=>x&&x!=="ACTIVE_HEALTHY")) throw new Error("SUPABASE_PROJECT_NOT_HEALTHY");
 return health;
}