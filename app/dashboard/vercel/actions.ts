"use server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createDeployment,createProject,isConfigured,addEnvironmentVariables,getDeployment} from "@/lib/vercel";
import {revalidatePath} from "next/cache";
import {z} from "zod";

const text=(f:FormData,n:string)=>String(f.get(n)||"").trim();
const schema=z.object({storeId:z.string().uuid(),repositoryId:z.string().uuid()});
async function admin(storeId:string){
 const s=await createSupabaseServerClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user) throw new Error("AUTH_REQUIRED");
 const {data}=await s.from("store_members").select("role").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();
 if(!data||!["owner","admin"].includes(data.role)) throw new Error("FORBIDDEN");
 return s;
}
export async function deployToVercel(f:FormData){
 const storeId=text(f,"store_id"),repositoryId=text(f,"repository_id");
 schema.parse({storeId,repositoryId});
 const s=await admin(storeId);
 if(!isConfigured()) throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");
 const {data:store}=await s.from("stores").select("id,name,slug").eq("id",storeId).single();
 const {data:repo}=await s.from("github_repositories").select("id,full_name,default_branch").eq("id",repositoryId).eq("store_id",storeId).maybeSingle();
 if(!store||!repo) throw new Error("STORE_OR_REPOSITORY_NOT_FOUND");
 const {data:supabaseProject}=await s.from("supabase_projects").select("project_ref,project_url,publishable_key,status").eq("store_id",storeId).maybeSingle();
 if(!supabaseProject||supabaseProject.status!=="ready"||!supabaseProject.project_ref||!supabaseProject.publishable_key) throw new Error("SUPABASE_PROJECT_NOT_READY");
 const name=(store.slug||"hepra-store").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,50)||"hepra-store";
 const {data:vp}=await s.from("vercel_projects").upsert({store_id:storeId,project_name:name,git_repo:repo.full_name,framework:"nextjs",status:"queued",updated_at:new Date().toISOString()},{onConflict:"store_id"}).select("id,vercel_project_id").single();
 if(!vp) throw new Error("VERCEL_PROJECT_RECORD_FAILED");
 try{
   let vercelProjectId=vp.vercel_project_id as string|undefined;
   if(!vercelProjectId){
     const p=await createProject({name,repo:repo.full_name,framework:"nextjs"});
     vercelProjectId=p.id;
     await s.from("vercel_projects").update({vercel_project_id:p.id,status:"queued",last_error:null,updated_at:new Date().toISOString()}).eq("id",vp.id);
   }
   if(!vp.vercel_project_id) await addEnvironmentVariables(vercelProjectId,[
     {key:"NEXT_PUBLIC_SUPABASE_URL",value:String(supabaseProject.project_url),target:["production","preview","development"],type:"plain"},
     {key:"NEXT_PUBLIC_SUPABASE_ANON_KEY",value:String(supabaseProject.publishable_key),target:["production","preview","development"],type:"plain"},
     {key:"NEXT_PUBLIC_SITE_URL",value:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000",target:["production","preview","development"],type:"plain"}
   ]);
   const d=await createDeployment({projectId:vercelProjectId,repo:repo.full_name,ref:repo.default_branch||"main",target:"production"});
   await s.from("deployments").insert({store_id:storeId,vercel_project_id:vercelProjectId,provider_deployment_id:d.id,state:"queued",target:"production",url:d.url||null,branch:repo.default_branch||"main",started_at:new Date().toISOString()});
   await s.from("vercel_projects").update({vercel_project_id:vercelProjectId,status:"building",last_deployment_id:d.id,last_deployment_url:d.url||null,attempt_count:1,updated_at:new Date().toISOString()}).eq("id",vp.id);
 }catch(e){
   const code=e instanceof Error?e.message:"VERCEL_PROVIDER_ERROR";
   await s.from("vercel_projects").update({status:"failed",last_error:code,updated_at:new Date().toISOString()}).eq("id",vp.id);
   throw new Error(code);
 }
 revalidatePath("/dashboard/vercel");
}
export async function refreshVercelDeployment(f:FormData){
 const storeId=text(f,"store_id"),deploymentId=text(f,"deployment_id");
 if(!z.string().uuid().safeParse(storeId).success||!deploymentId) throw new Error("INVALID_REQUEST");
 const s=await admin(storeId);
 const {data:deployment}=await s.from("deployments").select("id,vercel_project_id,provider_deployment_id").eq("id",deploymentId).eq("store_id",storeId).maybeSingle();
 if(!deployment) throw new Error("DEPLOYMENT_NOT_FOUND");
 const d=await getDeployment(String(deployment.provider_deployment_id||deploymentId));
 const state=String(d.readyState||d.state||"").toUpperCase();
 const normalized=state==="READY"?"ready":state==="ERROR"||state==="CANCELED"||state==="CANCELLED"?"failed":state==="BUILDING"||state==="INITIALIZING"?"building":"queued";
 await s.from("deployments").update({state:normalized,url:d.url||null,ready_at:normalized==="ready"?new Date().toISOString():null,error_code:normalized==="failed"?state:null,updated_at:new Date().toISOString()}).eq("id",deployment.id);
 if(normalized==="ready") await s.from("vercel_projects").update({status:"ready",production_url:d.url?("https://"+d.url.replace(/^https?:\/\//,"")):null,last_deployment_url:d.url||null,last_verified_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("vercel_project_id",deployment.vercel_project_id);
 else if(normalized==="failed") await s.from("vercel_projects").update({status:"failed",last_error:state,updated_at:new Date().toISOString()}).eq("vercel_project_id",deployment.vercel_project_id);
 else await s.from("vercel_projects").update({status:"building",updated_at:new Date().toISOString()}).eq("vercel_project_id",deployment.vercel_project_id);
 revalidatePath("/dashboard/vercel");
}
