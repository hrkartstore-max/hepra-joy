"use server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createRepository,putFile,verifyInstallation} from "@/lib/github/app";
import {revalidatePath} from "next/cache";
import {z} from "zod";

const text=(f:FormData,n:string)=>String(f.get(n)||"").trim();
const connectSchema=z.object({storeId:z.string().uuid(),installationId:z.coerce.number().int().positive()});
const repoSchema=z.object({storeId:z.string().uuid(),connectionId:z.string().uuid(),name:z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),isPrivate:z.enum(["true","false"])});

async function currentAdmin(storeId:string){
 const s=await createSupabaseServerClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user) throw new Error("AUTH_REQUIRED");
 const {data}=await s.from("store_members").select("role").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();
 if(!data||!["owner","admin"].includes(data.role)) throw new Error("FORBIDDEN");
 return s;
}
export async function connectGithub(f:FormData){
 const storeId=text(f,"store_id"),installationId=text(f,"installation_id");
 connectSchema.parse({storeId,installationId});
 const s=await currentAdmin(storeId);
 const checked=await verifyInstallation(Number(installationId));
 const {error}=await s.from("github_connections").upsert({
   store_id:storeId,installation_id:checked.id,account_login:checked.login,account_type:checked.type==="Organization"?"Organization":"User",
   external_account_id:checked.accountId,status:"connected",permissions:checked.permissions,verified_at:new Date().toISOString(),
   last_error:null,updated_at:new Date().toISOString()
 },{onConflict:"store_id"});
 if(error) throw new Error("GITHUB_CONNECTION_SAVE_FAILED");
 revalidatePath("/dashboard/github");
}
export async function createGithubRepository(f:FormData){
 const storeId=text(f,"store_id"),connectionId=text(f,"connection_id"),name=text(f,"name"),isPrivate=text(f,"private")||"true";
 repoSchema.parse({storeId,connectionId,name,isPrivate});
 const s=await currentAdmin(storeId);
 const {data:connection}=await s.from("github_connections").select("id,installation_id,account_login,status").eq("id",connectionId).eq("store_id",storeId).maybeSingle();
 if(!connection||connection.status!=="connected") throw new Error("GITHUB_NOT_CONNECTED");
 const idem="create-repository:"+name.toLowerCase();
 const {data:existingOp}=await s.from("github_operations").select("id,status,response").eq("store_id",storeId).eq("idempotency_key",idem).maybeSingle();
 if(existingOp?.status==="completed") {revalidatePath("/dashboard/github");return;}
 const {data:op}=await s.from("github_operations").upsert({store_id:storeId,operation_type:"create_repository",idempotency_key:idem,status:"processing",request:{name,isPrivate:isPrivate==="true"}},{onConflict:"store_id,idempotency_key"}).select("id").single();
 try{
   const r=await createRepository(connection.installation_id,connection.account_login,name,isPrivate==="true");
   const {error:repoError}=await s.from("github_repositories").upsert({
     store_id:storeId,connection_id:connection.id,repository_id:r.id,full_name:r.full_name,default_branch:r.default_branch||"main",
     private:Boolean(r.private),html_url:r.html_url,updated_at:new Date().toISOString()
   },{onConflict:"store_id"});
   if(repoError) throw new Error("GITHUB_REPOSITORY_SAVE_FAILED");
   await s.from("github_operations").update({status:"completed",external_id:String(r.id),response:{full_name:r.full_name,html_url:r.html_url},updated_at:new Date().toISOString()}).eq("id",op.id);
 }catch(e){
   await s.from("github_operations").update({status:"failed",error_code:e instanceof Error?e.message:"GITHUB_PROVIDER_ERROR",updated_at:new Date().toISOString()}).eq("id",op.id);
   throw e;
 }
 revalidatePath("/dashboard/github");
}
export async function generateStoreProject(f:FormData){
 const storeId=text(f,"store_id"),repoId=text(f,"repository_id");
 if(!z.string().uuid().safeParse(storeId).success||!z.string().uuid().safeParse(repoId).success) throw new Error("INVALID_REQUEST");
 const s=await currentAdmin(storeId);
 const {data:repo}=await s.from("github_repositories").select("id,full_name,connection_id,github_connections!inner(installation_id,status)").eq("id",repoId).eq("store_id",storeId).maybeSingle();
 if(!repo||repo.github_connections.status!=="connected") throw new Error("GITHUB_NOT_CONNECTED");
 const idem="generate-project:"+repoId;
 const {data:old}=await s.from("github_operations").select("id,status").eq("store_id",storeId).eq("idempotency_key",idem).maybeSingle();
 if(old?.status==="completed"){revalidatePath("/dashboard/github");return;}
 const {data:op}=await s.from("github_operations").upsert({store_id:storeId,operation_type:"generate_project",idempotency_key:idem,status:"processing",request:{repository_id:repoId}},{onConflict:"store_id,idempotency_key"}).select("id").single();
 try{
   const {data:store}=await s.from("stores").select("id,name,slug").eq("id",storeId).single();
   const config=JSON.stringify({platform:"HEPRA JOY",storeId:storeId,name:store?.name||"",slug:store?.slug||"",generatedAt:new Date().toISOString(),source:"HEPRA store configuration" },null,2);
   const files=[["hepra/store.config.json",config],["README.md","# HEPRA JOY Store\n\nThis repository is managed by HEPRA JOY. Store configuration is generated from the merchant workspace.\n"]];
   const shas:string[]=[];
   for(const [path,content] of files) {
     const r=await putFile(repo.github_connections.installation_id,repo.full_name,path,content,"chore: sync HEPRA store project");
     shas.push(String(r.commit?.sha||r.content?.sha||""));
   }
   await s.from("github_operations").update({status:"completed",response:{files:files.map(x=>x[0]),commits:shas},updated_at:new Date().toISOString()}).eq("id",op.id);
 }catch(e){
   await s.from("github_operations").update({status:"failed",error_code:e instanceof Error?e.message:"GITHUB_PROVIDER_ERROR",updated_at:new Date().toISOString()}).eq("id",op.id);
   throw e;
 }
 revalidatePath("/dashboard/github");
}
