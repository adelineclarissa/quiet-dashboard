import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../quiet-dashboard.html',import.meta.url),'utf8');
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
if(!html.includes('id="greeting"')||!html.includes('id="calendarDisclosure"'))throw Error('Dashboard markup missing');
console.log('Dashboard JavaScript and markup checks passed.');
