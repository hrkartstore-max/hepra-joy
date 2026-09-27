"use server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {applyMigration,configureAuth,configureStorage,createProject,getApiKeys,getHealth,isConfigured,listMigrations} from "@/lib/supabase/management";
import {revalidatePath} from "next/cache";
import {promises as fs} from "node:fs";
import path from "node:path";
import {z} from "zod";

const input=z.object({storeId:z.string().uuid(),organizationSlug:z.string().min(1).max(80),regionGroup:z.enum(["americas","emea","apac"]),dbPassword:z.string().min(24).max(128)});
const text=(f:FormData,n:string)=>String(f.get(n)||"").trim();
async function admin(storeId:string){
 const s=await createSupabaseServerClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user) throw new Error("AUTH_REQUIRED");
 const {data}=await s.from("store_members").select("role").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();
 if(!data||!["owner","admin"].includes(data.role)) throw new Error("FORBIDDEN");
 return s;
}
function safeName(name:string){return name.replace(/[^a-zA-Z0-9 -]/g,"").trim().slice(0,60)||"HEPRA Store"}
function delay(attempt:number){return Math.min(60,5*Math.pow(2,Math.max(0,attempt-1)))}
async function migrationFiles(){
 const dir=path.join(process.cwd(),"supabase","migrations");
 const names=(await fs.readdir(dir)).filter(x=>/^\d+_.+\.sql$/.test(x)).sort();
 return Promise.all(names.map(async name=>({name,sql:await fs.readFile(path.join(dir,name),"utf8")})));
}
async function failJob(s:any,jobId:string,projectId:string,attempt:number,code:string){
 const terminal=attempt>=5; const next=terminal?null:new Date(Date.now()+delay(attempt)*1000).toISOString();
 await s.from("supabase_projects").update({status:terminal?"failed":"retrying",attempt_count:attempt,last_error:code,next_retry_at:next,updated_at:new Date().toISOString()}).eq("id",projectId);
 await s.from("supabase_provisioning_jobs").update({state:terminal?"failed":"retrying",attempt_count:attempt,error_code:code,next_retry_at:next,updated_at:new Date().toISOString()}).eq("id",jobId);
}
export async function startSupabaseProvisioning(f:FormData){
 const storeId=text(f,"store_id"),organizationSlug=text(f,"organization_slug"),regionGroup=text(f,"region_group")||"apac",dbPassword=text(f,"db_password");
 input.parse({storeId,organizationSlug,regionGroup,dbPassword});
 const s=await admin(storeId);
 if(!isConfigured()) throw new Error("CONFIGURATION REQUIRED: SUPABASE_MANAGEMENT_API_TOKEN");
 const idem="supabase-provision:"+storeId;
 const {data:existing}=await s.from("supabase_provisioning_jobs").select("id,state").eq("store_id",storeId).eq("idempotency_key",idem).maybeSingle();
 if(existing?.state==="completed") return;
 const {data:project,error:pe}=await s.from("supabase_projects").upsert({store_id:storeId,status:"provisioning",project_name:safeName(organizationSlug),region:regionGroup,updated_at:new Date().toISOString()},{onConflict:"store_id"}).select("id").single();
 if(pe||!project) throw new Error("SUPABASE_PROJECT_RECORD_FAILED");
 const {data:job,error:je}=await s.from("supabase_provisioning_jobs").upsert({store_id:storeId,project_id:project.id,idempotency_key:idem,state:"processing",step:"create_project",request:{organization_slug:organizationSlug,region_group:regionGroup}},{onConflict:"store_id,idempotency_key"}).select("id,attempt_count").single();
 if(je||!job) throw new Error("SUPABASE_JOB_CREATE_FAILED");
 const attempt=Number(job.attempt_count||0)+1;
 try{
   const created=await createProject({name:safeName(organizationSlug),organizationSlug,regionGroup,dbPassword,idempotencyKey:String(job.id)+":create"});
   await s.from("supabase_projects").update({project_ref:created.ref,project_id:created.id,organization_id:created.organization_id||null,status:"provisioning",attempt_count:attempt,last_error:null,updated_at:new Date().toISOString()}).eq("id",project.id);
   await s.from("supabase_provisioning_jobs").update({state:"queued",step:"wait_ready",attempt_count:attempt,external_id:created.ref,result:{created:true},updated_at:new Date().toISOString()}).eq("id",job.id);
 }catch(e){const code=e instanceof Error?e.message:"SUPABASE_PROVIDER_ERROR";await failJob(s,job.id,project.id,attempt,code);throw new Error(code)}
 revalidatePath("/dashboard/supabase");
}
export async function processSupabaseProvisioning(f:FormData){
 const storeId=text(f,"store_id"),organizationSlug=text(f,"organization_slug"),dbPassword=text(f,"db_password");
 if(!z.string().uuid().safeParse(storeId).success) throw new Error("INVALID_REQUEST");
 const s=await admin(storeId);
 const {data:job}=await s.from("supabase_provisioning_jobs").select("id,project_id,step,attempt_count,supabase_projects(*)").eq("store_id",storeId).in("state",["queued","retrying"]).order("created_at",{ascending:true}).limit(1).maybeSingle();
 if(!job) throw new Error("NO_PROVISIONING_JOB");
 const project=Array.isArray(job.supabase_projects)?job.supabase_projects[0]:job.supabase_projects;
 const ref=project?.project_ref as string|undefined;
 const attempt=Number(job.attempt_count||0)+1;
 await s.from("supabase_provisioning_jobs").update({state:"processing",attempt_count:attempt,updated_at:new Date().toISOString()}).eq("id",job.id);
 try{
   if(job.step==="create_project"){
     if(!organizationSlug||!dbPassword) throw new Error("RETRY_REQUIRES_ORGANIZATION_AND_DB_PASSWORD");
     const created=await createProject({name:safeName(organizationSlug),organizationSlug,regionGroup:String(project?.region||"apac"),dbPassword,idempotencyKey:String(job.id)+":create-retry"});
     await s.from("supabase_projects").update({project_ref:created.ref,project_id:created.id,status:"provisioning",updated_at:new Date().toISOString()}).eq("id",job.project_id);
     await s.from("supabase_provisioning_jobs").update({state:"queued",step:"wait_ready",external_id:created.ref,updated_at:new Date().toISOString()}).eq("id",job.id);
   } else if(!ref) throw new Error("SUPABASE_PROJECT_REF_MISSING");
   else if(job.step==="wait_ready"){
     const health=await getHealth(ref);
     const statuses=Object.values(health).map(x=>String(x?.status||"").toUpperCase());
     if(statuses.some(x=>x&&x!=="ACTIVE_HEALTHY")) throw new Error("SUPABASE_PROJECT_NOT_READY");
     await s.from("supabase_provisioning_jobs").update({state:"queued",step:"migrations",result:{health},updated_at:new Date().toISOString()}).eq("id",job.id);
   } else if(job.step==="migrations"){
     const applied=await listMigrations(ref); const appliedNames=new Set(applied.map(x=>String(x.name||x.version||"")));
     for(const m of await migrationFiles()) if(!appliedNames.has(m.name)) await applyMigration(ref,m.name,m.sql,String(job.id)+":"+m.name);
     await s.from("supabase_provisioning_jobs").update({state:"queued",step:"configure_auth",updated_at:new Date().toISOString()}).eq("id",job.id);
   } else if(job.step==="configure_auth"){
     await configureAuth(ref,{site_url:process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000"});
     await s.from("supabase_provisioning_jobs").update({state:"queued",step:"configure_storage",updated_at:new Date().toISOString()}).eq("id",job.id);
   } else if(job.step==="configure_storage"){
     await configureStorage(ref,{file_size_limit:52428800});
     await s.from("supabase_provisioning_jobs").update({state:"queued",step:"verify",updated_at:new Date().toISOString()}).eq("id",job.id);
   } else if(job.step==="verify"){
     const health=await getHealth(ref); const keys=await getApiKeys(ref);
     const publishable=keys.find(k=>k.type==="publishable"&&k.api_key)?.api_key||null;
     const statuses=Object.values(health).map(x=>String(x?.status||"").toUpperCase());
     if(statuses.some(x=>x&&x!=="ACTIVE_HEALTHY")) throw new Error("SUPABASE_PROJECT_NOT_HEALTHY");
     await s.from("supabase_projects").update({status:"ready",project_url:"https://"+ref+".supabase.co",publishable_key:publishable,last_verified_at:new Date().toISOString(),last_error:null,next_retry_at:null,updated_at:new Date().toISOString()}).eq("id",job.project_id);
     await s.from("supabase_provisioning_jobs").update({state:"completed",step:"verify",result:{project_ref:ref,has_publishable_key:Boolean(publishable)},updated_at:new Date().toISOString()}).eq("id",job.id);
   }
 }catch(e){const code=e instanceof Error?e.message:"SUPABASE_PROVIDER_ERROR";await failJob(s,job.id,job.project_id,attempt,code);throw new Error(code)}
 revalidatePath("/dashboard/supabase");
}