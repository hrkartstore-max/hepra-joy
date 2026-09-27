import "server-only";
import crypto from "node:crypto";

const API="https://api.github.com";
const API_VERSION="2026-03-10";

type GithubConfig={appId:string;privateKey:string};
type GithubInstallation={id:number;account?:{id:number;login:string;type:string};permissions?:Record<string,string>;suspended_at?:string|null};

function config():GithubConfig{
 const appId=process.env.GITHUB_APP_ID;
 const privateKey=process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g,"\n");
 if(!appId||!privateKey) throw new Error("CONFIGURATION REQUIRED: GITHUB_APP_ID and GITHUB_PRIVATE_KEY");
 return {appId,privateKey};
}
const b64=(s:string)=>Buffer.from(s).toString("base64url");
function appJwt(){
 const {appId,privateKey}=config();
 const now=Math.floor(Date.now()/1000);
 const header=b64(JSON.stringify({alg:"RS256",typ:"JWT"}));
 const payload=b64(JSON.stringify({iat:now-60,exp:now+540,iss:appId}));
 const input=header+"."+payload;
 const sig=crypto.sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
 return input+"."+sig;
}
async function request(path:string,init:RequestInit={},token?:string){
 const r=await fetch(API+path,{...init,headers:{
   Accept:"application/vnd.github+json",
   "X-GitHub-Api-Version":API_VERSION,
   ...(init.body?{"Content-Type":"application/json"}:{}),
   ...(token?{Authorization:"Bearer "+token}:{Authorization:"Bearer "+appJwt()}),
   ...(init.headers||{})
 },cache:"no-store"});
 const body=await r.text();
 let data:any=null; try{data=body?JSON.parse(body):null}catch{}
 if(!r.ok) throw new Error("GITHUB_PROVIDER_ERROR:"+r.status+":"+String(data?.message||"request failed").slice(0,180));
 return data;
}
export async function verifyInstallation(installationId:number){
 const data=await request("/app/installations/"+encodeURIComponent(String(installationId)));
 const i=data as GithubInstallation;
 if(!i.account?.login) throw new Error("GITHUB_PROVIDER_ERROR:INVALID_INSTALLATION");
 return {id:i.id,accountId:i.account.id,login:i.account.login,type:i.account.type,permissions:i.permissions||{},suspendedAt:i.suspended_at||null};
}
async function installationToken(installationId:number){
 const data=await request("/app/installations/"+encodeURIComponent(String(installationId))+"/access_tokens",{method:"POST",body:JSON.stringify({
   permissions:{contents:"write",administration:"write",metadata:"read"}
 })});
 return {token:String(data.token),expiresAt:String(data.expires_at)};
}
export async function createRepository(installationId:number,owner:string,accountType:"Organization"|"User",name:string,isPrivate:boolean){
 const {token}=await installationToken(installationId);
 const path=accountType==="Organization"?"/orgs/"+encodeURIComponent(owner)+"/repos":"/user/repos";
 return request(path,{method:"POST",body:JSON.stringify({name,private:isPrivate,auto_init:true})},token);
}
export async function putFile(installationId:number,fullName:string,path:string,content:string,message:string){
 const {token}=await installationToken(installationId);
 const encoded=Buffer.from(content,"utf8").toString("base64");
 const existing=await (async()=>{try{return await request("/repos/"+fullName+"/contents/"+path,{},token)}catch{return null}})();
 const body:any={message,content:encoded};
 if(existing?.sha) body.sha=existing.sha;
 return request("/repos/"+fullName+"/contents/"+path,{method:"PUT",body:JSON.stringify(body)},token);
}
