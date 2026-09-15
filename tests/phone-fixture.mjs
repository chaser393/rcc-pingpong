import assert from 'node:assert/strict';
const origin='http://localhost:3000';let cookie='';
async function post(path,body){const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
const login=await post('/api/auth',{action:'login',username:'local_test_manager',password:'x'});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
async function state(){return (await fetch(origin+'/api/state',{headers:{Cookie:cookie}})).json();}
async function act(action,value){const s=await state();const r=await post('/api/state',{version:s.version,action,value});assert.equal(r.status,200,JSON.stringify(r.data));return state();}
const names=['Alex Demo','Bailey Demo','Chris Demo','Dana Demo','Evan Demo','Frankie Demo','Gray Demo','Harper Demo'];
let s=await state();for(const name of names)if(!s.state.players.some(p=>p.name===name)){s=await act('player',{name});}
const current=s.state.nights.find(n=>!n.closed);if(!current){s=await act('night',{name:'Phone preview · demo night',members:names.map((name,i)=>({id:s.state.players.find(p=>p.name===name).id,table:i<4?1:2}))});}
console.log('Local phone-preview fixture ready. Production data unchanged.');
