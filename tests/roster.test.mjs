import assert from 'node:assert/strict';
import {empty,apply,stats,sortedRoster,defaultNightName,assignTables} from '../lib/pong.ts';
const s=empty();
for(const name of ['Zoe Last','Amy First','Ben Middle','Cara Four','David Five']) apply(s,'player',{name},'travis');
const ids=s.players.map(p=>p.id);
for(const name of ['amy first','  AMY   FIRST  ','Ａｍｙ First'])assert.throws(()=>apply(s,'player',{name}),/already exists/);
assert.equal(s.players.length,5);
assert.throws(()=>apply(s,'player',{id:ids[2],name:'Amy First'}),/already exists/);
apply(s,'hidePlayer',{id:ids[1],hidden:true});
assert.ok(!sortedRoster(s).some(p=>p.id===ids[1]));assert.ok(sortedRoster(s,'name',true).some(p=>p.id===ids[1]));
assert.throws(()=>apply(s,'player',{name:'Amy First'}),/hidden players/);
apply(s,'hidePlayer',{id:ids[1],hidden:false});assert.equal(sortedRoster(s,'name')[0].id,ids[1]);
for(let n=4;n<=14;n++){const attendees=Array.from({length:n},(_,i)=>String(i));for(const tables of [1,2]){const assigned=assignTables(attendees,tables,true);assert.deepEqual(Object.keys(assigned).sort(),attendees.sort());const counts=[1,2].slice(0,tables).map(t=>Object.values(assigned).filter(v=>v===String(t)).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);}}
assert.equal(defaultNightName(new Date(2026,8,9,12)), 'September 9, 2026');
apply(s,'night',{name:'September 9, 2026',members:ids.slice(0,4).map(id=>({id,table:1}))},'travis');
const n=s.nights[0],m=n.matches[0];assert.equal(n.changes[0].actor,'travis');assert.equal(n.changes[0].summary,'Night started');
assert.throws(()=>apply(s,'deletePlayer',{id:ids[0]}),/Attendance/);
apply(s,'score',{nightId:n.id,matchId:m.id,score:[21,15]},'scorer');
assert.equal(n.changes.at(-1).actor,'scorer');assert.match(n.changes.at(-1).details.join(' '),/unscored → 21–15/);
const oldLog=JSON.stringify(n.changes);
apply(s,'score',{nightId:n.id,matchId:m.id,score:[15,21]},'travis');
assert.match(n.changes.at(-1).details.join(' '),/21–15 → 15–21/);
assert.equal(JSON.stringify(n.changes.slice(0,-1)),oldLog);
for(const key of ['wins','losses','games','pr']){const totals=stats(s);const rows=sortedRoster(s,key);for(let i=1;i<rows.length;i++)assert.ok(totals[rows[i-1].id][key]>=totals[rows[i].id][key]);}
apply(s,'finish',{nightId:n.id},'travis');
apply(s,'renameNight',{nightId:n.id,name:'Fall pong night'},'travis');assert.equal(n.name,'Fall pong night');assert.match(n.changes.at(-1).details[0],/September 9, 2026 → Fall pong night/);
const beforeStats=structuredClone(stats(s));const beforeMatches=JSON.stringify(n.matches);
apply(s,'deletePlayer',{id:ids[0]},'travis');assert.ok(!sortedRoster(s,'name',true).some(p=>p.id===ids[0]));assert.equal(s.players.find(p=>p.id===ids[0]).name,'Zoe Last');assert.deepEqual(stats(s),beforeStats);assert.equal(JSON.stringify(n.matches),beforeMatches);
assert.throws(()=>apply(s,'hidePlayer',{id:ids[0],hidden:false}),/not found/);
// An older saved night without an audit field stays readable and gains history on its next edit.
delete n.changes;apply(s,'renameNight',{nightId:n.id,name:'Legacy night renamed'},'travis');assert.equal(n.changes.length,1);
console.log('PASS: all roster sorts, duplicate normalization/hidden duplicates, hide/unhide, safe deletion with history, balanced table assignments, date default, audit attribution and legacy compatibility.');
