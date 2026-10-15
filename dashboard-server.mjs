import http from 'node:http';
import fs from 'node:fs';
import {createGoogleOffline} from './google-offline.mjs';
const googleOffline=await createGoogleOffline();
const page=new URL('./quiet-dashboard.html',import.meta.url);
const server=http.createServer(async(request,response)=>{
 if(!['localhost:4173','127.0.0.1:4173'].includes(request.headers.host)){response.writeHead(403);response.end();return}
 const url=new URL(request.url,'http://localhost:4173');
 if(await googleOffline(request,response,url))return;
 if(request.url!=='/'&&request.url!=='/quiet-dashboard.html'){response.writeHead(404);response.end();return}
 try{
 const content=fs.readFileSync(page);
 response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
 response.end(content);
 }catch{response.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});response.end('Dashboard file unavailable. Restore quiet-dashboard.html beside dashboard-server.mjs.');}
});
server.on('error',error=>{if(error.code==='EADDRINUSE')process.exit(0);process.stderr.write('Dashboard could not start: '+error.message+'\n');process.exit(1)});
server.listen(4173,'127.0.0.1');
