import "server-only";

const BASE="https://api.vercel.com";
function auth(){
 const token=process.env.VERCEL_TOKEN;
 if(!token) throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");
 return {Authorization:"Bearer "+token,"Content-Type":"application/json"};
}
async function request<T=Record<string,unknown>>(path:string,init:RequestInit={}):Promise<T>{
 const r=await fetch(BASE+path,{...init,headers:{...auth(),...(init.headers||{})},cache:"no-store"});
 const raw=await r.text(); let data:unknown=null; try{data=raw?JSON.parse(raw):null}catch{}
 if(!r.ok) throw new Error("VERCEL_PROVIDER_ERROR:"+r.status);
 return data as T;
}
export function isConfigured(){return Boolean(process.env.VERCEL_TOKEN)}
export async function getProject(projectId:string){
 return request<{id:string,name:string,framework?:string,link?:Record<string,unknown>}>("/v9/projects/"+encodeURIComponent(projectId));
}
export async function createProject(input:{name:string;repo:string;framework?:string}){
 return request<{id:string,name:string,framework?:string,link?:Record<string,unknown>}>("/v10/projects",{
  method:"POST",body:JSON.stringify({name:input.name,framework:input.framework||"nextjs",gitRepository:{type:"github",repo:input.repo}})
 });
}
export async function addEnvironmentVariables(projectId:string,variables:Array<{key:string;value:string;target:string[];type?:string}>){
 return request("/v10/projects/"+encodeURIComponent(projectId)+"/env",{method:"POST",body:JSON.stringify(variables.map(v=>({key:v.key,value:v.value,target:v.target,type:v.type||"encrypted"})))});
}
export async function createDeployment(input:{projectId:string;repo:string;ref:string;sha?:string;target?:string}){
 const parts=input.repo.split("/");
 return request<{id:string;url?:string;readyState?:string}>("/v13/deployments",{
  method:"POST",body:JSON.stringify({name:input.projectId,project:input.projectId,target:input.target||"production",gitSource:{type:"github",org:parts[0],repo:parts[1],ref:input.ref,...(input.sha?{sha:input.sha}:{})}})
 });
}
export async function getDeployment(deploymentId:string){
 return request<{id:string;url?:string;readyState?:string;state?:string;createdAt?:number;ready?:number}>("/v13/deployments/"+encodeURIComponent(deploymentId));
}
export async function verifyDeployment(deploymentId:string){
 const d=await getDeployment(deploymentId);
 const state=String(d.readyState||d.state||"").toUpperCase();
 if(state!=="READY") throw new Error("VERCEL_DEPLOYMENT_NOT_READY");
 return d;
}
export async function listDeployments(projectId:string){
 return request<Array<{uid?:string;id?:string;url?:string;readyState?:string}>>("/v6/deployments?projectId="+encodeURIComponent(projectId)+"&limit=10");
}
