import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='http://localhost:3000';
const setupKey=fs.readFileSync('.env.local','utf8').trim().split('=')[1];
let cookie='';
async function post(path,body,authenticated=true){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(authenticated?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
async function state(authenticated=true){const r=await fetch(base+'/api/state',{headers:authenticated?{Cookie:cookie}:{}});assert.equal(r.status,200);return r.json();}
const initial=await state();assert.equal((await post('/api/state',{action:'player',value:{name:'Unauthorized'},version:0},false)).status,401);
let login=await post('/api/auth',{action:initial.needsSetup?'create':'login',username:'local_test_manager',password:'x',setupKey});assert.equal(login.status,200,JSON.stringify(login.data));cookie=login.cookie.split(';')[0];
let d=await state();assert.equal(d.manager,'local_test_manager');
for(const password of ['', '   '])assert.equal((await post('/api/auth',{action:'create',username:'blank_password',password})).status,400);
assert.equal((await post('/api/auth',{action:'create',username:'long_password',password:'a'.repeat(250)})).status,200);
let save=await post('/api/state',{action:'player',value:{name:'Local test player',info:'Public info',notes:'Private note'},version:d.version});assert.equal(save.status,200);
const stale=await post('/api/state',{action:'player',value:{name:'Stale overwrite'},version:d.version});assert.equal(stale.status,409);
d=await state();assert.equal(d.state.players.at(-1).notes,'Private note');const publicState=await state(false);assert.equal(publicState.state.players.at(-1).notes,'');assert.equal(publicState.manager,null);
assert.equal((await post('/api/auth',{action:'logout'})).status,200);assert.equal((await post('/api/state',{action:'player',value:{name:'Expired session'},version:d.version})).status,401);
console.log('PASS: database persistence, manager setup/login/logout, anonymous read-only access, private notes, conflict protection. Local test data only.');

