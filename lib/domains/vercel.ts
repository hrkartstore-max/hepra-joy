import "server-only";
const base="https://api.vercel.com";
function headers(){const t=process.env.VERCEL_TOKEN;if(!t)throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");return{Authorization:"Bearer "+t,"Content-Type":"application/json"}}
async function req<T=unknown>(path:string,init:RequestInit={}):Promise<T>{const r=await fetch(base+path,{...init,headers:{...headers(),...(init.headers||{})},cache:"no-store"});const raw=await r.text();let data:any=null;try{data=raw?JSON.parse(raw):null}catch{}if(!r.ok)throw new Error("VERCEL_DOMAIN_PROVIDER_ERROR:"+r.status);return data as T}
export function isConfigured(){return Boolean(process.env.VERCEL_TOKEN)}
export async function addVercelDomain(projectId:string,domain:string){return req("/v9/projects/"+encodeURIComponent(projectId)+"/domains",{method:"POST",body:JSON.stringify({name:domain})})}
export async function getVercelDomain(projectId:string,domain:string){return req("/v9/projects/"+encodeURIComponent(projectId)+"/domains/"+encodeURIComponent(domain))}
export async function verifyVercelDomain(projectId:string,domain:string){return req("/v9/projects/"+encodeURIComponent(projectId)+"/domains/"+encodeURIComponent(domain)+"/verify",{method:"POST",body:JSON.stringify({})})}
export async function updateVercelDomain(projectId:string,domain:string,input:{redirect?:string|null;redirectStatusCode?:301|302|307|308;gitBranch?:string|null}){return req("/v9/projects/"+encodeURIComponent(projectId)+"/domains/"+encodeURIComponent(domain),{method:"PATCH",body:JSON.stringify(input)})}
export async function removeVercelDomain(projectId:string,domain:string){return req("/v9/projects/"+encodeURIComponent(projectId)+"/domains/"+encodeURIComponent(domain),{method:"DELETE"})}
export async function probeHttps(domain:string){try{const r=await fetch("https://"+domain,{method:"HEAD",redirect:"manual",cache:"no-store"});return {ok:true,status:r.status,ssl:true}}catch{return {ok:false,status:0,ssl:false}}}
