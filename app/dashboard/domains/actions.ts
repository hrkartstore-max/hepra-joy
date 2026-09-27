"use server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {addVercelDomain,getVercelDomain,isConfigured,probeHttps,removeVercelDomain,updateVercelDomain,verifyVercelDomain} from "@/lib/domains/vercel";
import {revalidatePath} from "next/cache";
import {z} from "zod";

const text=(f:FormData,n:string)=>String(f.get(n)||"").trim();
const domainSchema=z.string().min(3).max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i);
async function admin(storeId:string){const s=await createSupabaseServerClient();const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("AUTH_REQUIRED");const {data}=await s.from("store_members").select("role").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();if(!data||!["owner","admin"].includes(data.role))throw new Error("FORBIDDEN");return s}
export async function addDomain(f:FormData){
 const storeId=text(f,"store_id"),domain=domainSchema.parse(text(f,"domain").toLowerCase().replace(/\.$/,""));
 const s=await admin(storeId);if(!isConfigured())throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");
 const {data:vp}=await s.from("vercel_projects").select("vercel_project_id").eq("store_id",storeId).maybeSingle();if(!vp?.vercel_project_id)throw new Error("VERCEL_PROJECT_NOT_READY");
 const existing=await s.from("domains").select("id").eq("store_id",storeId).eq("domain",domain).maybeSingle();if(existing.data)throw new Error("DOMAIN_ALREADY_EXISTS");
 const provider=await addVercelDomain(vp.vercel_project_id,domain);
 const verified=provider?.verified===true;
 const {error}=await s.from("domains").insert({store_id:storeId,domain,kind:domain.split(".").length>2?"subdomain":"custom",status:verified?"verified":"verifying",vercel_project_id:vp.vercel_project_id,provider_verified:verified,dns_status:verified?"configured":"pending",ssl_status:"pending",verification:provider?.verification||{},last_provider_response:provider||{},last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()});
 if(error)throw new Error("DOMAIN_CREATE_FAILED");
 revalidatePath("/dashboard/domains");
}
export async function syncDomain(f:FormData){
 const storeId=text(f,"store_id"),domainId=text(f,"domain_id");if(!z.string().uuid().safeParse(storeId).success||!z.string().uuid().safeParse(domainId).success)throw new Error("INVALID_REQUEST");
 const s=await admin(storeId);if(!isConfigured())throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");
 const {data:d}=await s.from("domains").select("id,domain,vercel_project_id,is_primary,status").eq("id",domainId).eq("store_id",storeId).maybeSingle();if(!d||!d.vercel_project_id)throw new Error("DOMAIN_NOT_FOUND");
 let provider=await getVercelDomain(d.vercel_project_id,d.domain);
 if(provider?.verified!==true)try{provider=await verifyVercelDomain(d.vercel_project_id,d.domain)}catch{}
 const verified=provider?.verified===true;
 const ssl=verified?(await probeHttps(d.domain)).ssl:false;
 await s.from("domains").update({status:verified?(ssl?"active":"verified"):"verifying",provider_verified:verified,dns_status:verified?"configured":"pending",ssl_status:verified?(ssl?"issued":"pending"):"pending",verification:provider?.verification||{},last_provider_response:provider||{},last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",d.id);
 revalidatePath("/dashboard/domains");
}
export async function setPrimaryDomain(f:FormData){
 const storeId=text(f,"store_id"),domainId=text(f,"domain_id");if(!z.string().uuid().safeParse(storeId).success||!z.string().uuid().safeParse(domainId).success)throw new Error("INVALID_REQUEST");
 const s=await admin(storeId);if(!isConfigured())throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");
 const {data:target}=await s.from("domains").select("id,domain,vercel_project_id,provider_verified,status").eq("id",domainId).eq("store_id",storeId).maybeSingle();if(!target||!target.vercel_project_id)throw new Error("DOMAIN_NOT_FOUND");if(!target.provider_verified||!["verified","active"].includes(target.status))throw new Error("DOMAIN_NOT_VERIFIED");
 const {data:others}=await s.from("domains").select("id,domain,vercel_project_id").eq("store_id",storeId).eq("vercel_project_id",target.vercel_project_id).neq("id",domainId).in("status",["verified","active"]);
 for(const other of others||[])await updateVercelDomain(target.vercel_project_id,other.domain,{redirect:target.domain,redirectStatusCode:308});
 await updateVercelDomain(target.vercel_project_id,target.domain,{redirect:null});
 await s.from("domains").update({is_primary:false,redirect_target:target.domain,redirect_status_code:308,updated_at:new Date().toISOString()}).eq("store_id",storeId).eq("vercel_project_id",target.vercel_project_id);
 await s.from("domains").update({is_primary:true,redirect_target:null,redirect_status_code:null,status:"active",updated_at:new Date().toISOString()}).eq("id",target.id);
 revalidatePath("/dashboard/domains");
}
export async function removeDomain(f:FormData){
 const storeId=text(f,"store_id"),domainId=text(f,"domain_id");if(!z.string().uuid().safeParse(storeId).success||!z.string().uuid().safeParse(domainId).success)throw new Error("INVALID_REQUEST");
 const s=await admin(storeId);if(!isConfigured())throw new Error("CONFIGURATION REQUIRED: VERCEL_TOKEN");
 const {data:d}=await s.from("domains").select("id,domain,vercel_project_id,is_primary").eq("id",domainId).eq("store_id",storeId).maybeSingle();if(!d)throw new Error("DOMAIN_NOT_FOUND");if(d.is_primary)throw new Error("PRIMARY_DOMAIN_CANNOT_BE_REMOVED");
 if(d.vercel_project_id)await removeVercelDomain(d.vercel_project_id,d.domain);
 await s.from("domains").update({status:"removed",updated_at:new Date().toISOString()}).eq("id",d.id);revalidatePath("/dashboard/domains");
}
