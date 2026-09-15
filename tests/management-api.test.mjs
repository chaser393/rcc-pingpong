import assert from 'node:assert/strict';
const origin='http://localhost:3000';let cookie='';
async function post(path,body){const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
async function read(){const r=await fetch(origin+'/api/state',{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();}
const login=await post('/api/auth',{action:'login',username:'local_test_manager',password:'x'});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
let state=await read();
async function action(action,value){const result=await post('/api/state',{action,value,version:state.version});if(result.status===200)state=await read();return result;}
const suffix=Date.now();const names=Array.from({length:4},(_,i)=>`Management test ${suffix} ${i}`);
for(const name of names)assert.equal((await action('player',{name})).status,200);
const ids=state.state.players.filter(p=>names.includes(p.name)).map(p=>p.id);
const version=state.version;
const duplicate=await action('player',{name:names[0].toUpperCase()});assert.equal(duplicate.status,400);assert.match(duplicate.data.error,/already exists/);assert.equal((await read()).version,version);
assert.equal((await action('hidePlayer',{id:ids[0],hidden:true})).status,200);assert.equal(state.state.players.find(p=>p.id===ids[0]).hidden,true);
assert.equal((await action('hidePlayer',{id:ids[0],hidden:false})).status,200);
assert.equal((await action('night',{name:'Management test night',members:ids.map(id=>({id,table:1}))})).status,200);
let n=state.state.nights.at(-1);assert.equal(n.changes[0].actor,'local_test_manager');
assert.equal((await action('score',{nightId:n.id,matchId:n.matches[0].id,score:[21,8],actor:'spoofed'})).status,200);
n=state.state.nights.at(-1);assert.equal(n.changes.at(-1).actor,'local_test_manager');assert.match(n.changes.at(-1).details.join(' '),/21–8/);
assert.equal((await action('finish',{nightId:n.id})).status,200);
assert.equal((await action('renameNight',{nightId:n.id,name:'Renamed archived test night'})).status,200);
const originalMatches=JSON.stringify(state.state.nights.at(-1).matches);
assert.equal((await action('deletePlayer',{id:ids[0]})).status,200);assert.equal(state.state.players.find(p=>p.id===ids[0]).deleted,true);assert.equal(JSON.stringify(state.state.nights.at(-1).matches),originalMatches);
console.log('PASS: authenticated roster management, rejected duplicate without data writes, server-attributed night audit, archived renaming and historical results preserved. Local data only.');
