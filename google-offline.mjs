import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const origin='http://localhost:4173',redirect=origin+'/oauth/google/callback';
const scopes='openid profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks';
const vault=new URL('./runtime/google-vault.dpapi',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function protect(text,decrypt=false){return new Promise((resolve,reject)=>{
 const command="$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$data=[Console]::In.ReadToEnd();"+(decrypt?"$plain=[System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($data),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($plain))":"$cipher=[System.Security.Cryptography.ProtectedData]::Protect([System.Text.Encoding]::UTF8.GetBytes($data),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($cipher))");
 const child=spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.resume();child.on('error',()=>reject(new Error('Windows credential protection unavailable.')));child.on('close',code=>code===0?resolve(output):reject(new Error('Windows credential protection failed.')));child.stdin.end(text);
})}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(c=>{const i=c.indexOf('=');return[c.slice(0,i).trim(),c.slice(i+1)]}));
function cookie(res,name,value,age){res.setHeader('Set-Cookie',name+'='+value+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+age)}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>65536)throw new Error('Input too large.')}return JSON.parse(text||'{}')}
export async function createGoogleOffline(){
 let saved={};try{saved=JSON.parse(await protect(await fs.readFile(vault,'utf8'),true))}catch(e){if(e.code!=='ENOENT')throw new Error('Saved Google connection could not be unlocked.');}
 let cache=null,refreshing=null,writing=Promise.resolve(),sessionVersion=0;const pending=new Map();
 function persist(){const snapshot=JSON.stringify(saved);writing=writing.catch(()=>{}).then(async()=>{const encrypted=await protect(snapshot);await fs.mkdir(new URL('.',vault),{recursive:true});const temp=new URL('./google-vault.tmp',vault);await fs.writeFile(temp,encrypted);await fs.rename(temp,vault)});return writing}
 const authorized=req=>saved.sessionHash&&equal(hash(cookies(req).daniel_google||''),saved.sessionHash);
 async function tokenRequest(params){
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(20000)});const data=await response.json();
 if(!response.ok){if(data.error==='invalid_grant'){const e=new Error('Google access expired or was revoked. Connect Google again.');e.status=401;throw e}throw new Error('Google could not renew access. Try again shortly.')}
 return data;
 }
 async function access(){
 if(cache&&cache.until>Date.now()+60000)return cache;
 if(!saved.refreshToken){const e=new Error('Connect Google to enable automatic reconnection.');e.status=401;throw e}
 if(!refreshing){const version=sessionVersion;refreshing=(async()=>{let r;try{r=await tokenRequest({client_id:saved.clientId,client_secret:saved.clientSecret,refresh_token:saved.refreshToken,grant_type:'refresh_token'})}catch(e){if(e.status===401&&version===sessionVersion){saved.refreshToken=null;cache=null;await persist()}throw e}if(version!==sessionVersion){const e=new Error('Google session changed.');e.status=401;throw e}cache={access_token:r.access_token,scope:r.scope||saved.scope,until:Date.now()+Number(r.expires_in)*1000};if(r.refresh_token){saved.refreshToken=r.refresh_token;await persist()}return cache})().finally(()=>refreshing=null)}return refreshing;
 }
 return async function handle(req,res,url){
 if(!url.pathname.startsWith('/api/google/')&&!url.pathname.startsWith('/oauth/google/'))return false;
 try{
 if(req.headers.host!=='localhost:4173'){json(res,400,{error:'Open this dashboard at http://localhost:4173/.'});return true}
 if(req.method==='POST'&&req.headers.origin!==origin){json(res,403,{error:'Request origin rejected.'});return true}
 if(req.method==='GET'&&url.pathname==='/api/google/status'){json(res,200,{configured:!!saved.clientSecret,connected:!!(authorized(req)&&saved.refreshToken),redirect_uri:redirect});return true}
 if(req.method==='POST'&&url.pathname==='/api/google/config'){
 const input=await body(req),config=input.web;
 if(!config||!/^[-\w]+\.apps\.googleusercontent\.com$/.test(config.client_id||'')||typeof config.client_secret!=='string'||!config.client_secret||config.client_secret.length>4096){json(res,400,{error:'Choose the OAuth Web application JSON file downloaded from Google Cloud.'});return true}
 if(saved.refreshToken&&!authorized(req)){json(res,403,{error:'Use the browser where Google is already connected to change its configuration.'});return true}
 sessionVersion++;saved={clientId:config.client_id,clientSecret:config.client_secret};cache=null;pending.clear();await persist();cookie(res,'daniel_google','',0);json(res,200,{client_id:saved.clientId});return true;
 }
 if(req.method==='POST'&&url.pathname==='/api/google/start'){
 if(!saved.clientSecret){json(res,409,{error:'Import your Google OAuth credentials in Settings first.'});return true}
 const state=randomBytes(32).toString('base64url'),browser=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 for(const [key,p]of pending)if(p.until<Date.now())pending.delete(key);if(pending.size>20){json(res,429,{error:'Too many pending sign-ins. Try again in a few minutes.'});return true}
 pending.set(state,{browser:hash(browser),verifier,until:Date.now()+600000});cookie(res,'daniel_google_pending',browser,600);
 const q=new URLSearchParams({client_id:saved.clientId,redirect_uri:redirect,response_type:'code',scope:scopes,access_type:'offline',prompt:'consent select_account',include_granted_scopes:'false',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});json(res,200,{url:'https://accounts.google.com/o/oauth2/v2/auth?'+q});return true;
 }
 if(req.method==='GET'&&url.pathname==='/oauth/google/callback'){
 const state=url.searchParams.get('state'),p=pending.get(state);pending.delete(state);
 if(!p||p.until<Date.now()||!equal(p.browser,hash(cookies(req).daniel_google_pending||''))){json(res,400,{error:'This Google sign-in expired. Return to the dashboard and try again.'});return true}
 if(url.searchParams.has('error')){res.writeHead(303,{Location:'/?google=denied','Cache-Control':'no-store'});res.end();return true}
 const code=url.searchParams.get('code');if(!code){json(res,400,{error:'No Google authorization code was returned.'});return true}
 const data=await tokenRequest({code,client_id:saved.clientId,client_secret:saved.clientSecret,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:p.verifier});
 if(!data.refresh_token)throw new Error('Google did not return offline access. Reconnect and allow access.');
 const session=randomBytes(32).toString('base64url');sessionVersion++;saved.refreshToken=data.refresh_token;saved.scope=data.scope||'';saved.sessionHash=hash(session);cache={access_token:data.access_token,scope:saved.scope,until:Date.now()+Number(data.expires_in)*1000};await persist();cookie(res,'daniel_google',session,31536000);res.writeHead(303,{Location:'/?google=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return true;
 }
 if(req.method==='POST'&&url.pathname==='/api/google/token'){
 if(!authorized(req)){json(res,401,{error:'Connect Google to restore your session.'});return true}
 const data=await access();json(res,200,{access_token:data.access_token,scope:data.scope,expires_in:Math.max(1,Math.floor((data.until-Date.now())/1000))});return true;
 }
 if(req.method==='POST'&&url.pathname==='/api/google/disconnect'){
 if(!authorized(req)){json(res,401,{error:'Google session not found.'});return true}
 const refresh=saved.refreshToken;sessionVersion++;saved.refreshToken=null;saved.sessionHash=null;cache=null;await persist();cookie(res,'daniel_google','',0);
 let revoked=true;try{if(refresh){const r=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:refresh}),signal:AbortSignal.timeout(10000)});revoked=r.ok}}catch{revoked=false}json(res,200,{disconnected:true,revoked});return true;
 }
 json(res,404,{error:'Not found.'});return true;
 }catch(e){json(res,e.status||503,{error:e.message||'Google connection temporarily unavailable.'});return true}
 };
}
