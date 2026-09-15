import assert from 'node:assert/strict';
import {empty,apply,schedule,stats,adjustment,standings} from '../lib/pong.ts';
function club(count){let s=empty();for(let i=0;i<count;i++)apply(s,'player',{name:`Player ${i+1}`,notes:'private'});apply(s,'night',{members:s.players.slice(0,count).map(p=>({id:p.id,table:1}))});return s;}
for(let count=4;count<=14;count++){
 for(let repeat=0;repeat<8;repeat++){
 const s=club(count),n=s.nights[0],pairs=new Set(),games={};
 for(const m of n.matches){assert.equal(new Set([...m.a,...m.b]).size,4);for(const team of [m.a,m.b]){pairs.add([...team].sort().join('|'));for(const id of team)games[id]=(games[id]||0)+1;}}
 assert.equal(pairs.size,count*(count-1)/2,`partnership coverage for ${count}`);
 assert.ok(Math.max(...Object.values(games))-Math.min(...Object.values(games))<=1,`fair games for ${count}: ${JSON.stringify(games)}`);
 if(count===4)assert.equal(n.matches.length,3);
 }
}
const s=club(4),n=s.nights[0],m=n.matches[0];
for(const [diff,favorite,upset] of [[0,20,20],[50,20,20],[51,10,20],[100,10,20],[101,5,25],[200,5,25],[201,1,30],[300,1,30]]){n.ranks=Object.fromEntries(s.players.map(p=>[p.id,500]));n.ranks[m.a[0]]+=diff;m.score=[21,10];assert.equal(adjustment(m,n).points,favorite);m.score=[10,21];assert.equal(adjustment(m,n).points,upset);}
n.ranks=Object.fromEntries(s.players.map(p=>[p.id,500]));m.score=null;
apply(s,'score',{nightId:n.id,matchId:m.id,score:[21,18]});assert.equal(stats(s)[m.a[0]].pr,520);
apply(s,'score',{nightId:n.id,matchId:m.id,score:[18,21]});assert.equal(stats(s)[m.a[0]].pr,480);assert.equal(stats(s)[m.a[0]].games,1);
assert.throws(()=>apply(s,'score',{nightId:n.id,matchId:m.id,score:[21,21]}));
apply(s,'player',{name:'Replacement'});const incoming=s.players.at(-1).id,out=m.a[0];apply(s,'attendance',{nightId:n.id,out,in:incoming,replace:true,table:1});assert.equal(n.members.find(p=>p.id===incoming).credit,1);assert.equal(stats(s)[incoming].games,0);assert.equal(stats(s)[out].games,1);assert.equal(n.matches.find(x=>x.id===m.id).score[0],18);
const ids=n.members.filter(p=>p.active).map(p=>p.id);apply(s,'championship',{nightId:n.id,ids,bestOf:3});const finals=n.matches.filter(m=>m.champ);for(const f of finals.slice(0,2))apply(s,'score',{nightId:n.id,matchId:f.id,score:[21,8]});assert.throws(()=>apply(s,'score',{nightId:n.id,matchId:finals[2].id,score:[21,8]}));assert.throws(()=>apply(s,'score',{nightId:n.id,matchId:finals[0].id,score:null}));assert.equal(standings(n,1).find(p=>p.id===incoming).wins,0);
console.log('PASS: schedules 4–14 players, complete partner coverage, equal games, PR boundaries/upsets, score edits, replacement attribution, championship clinch.');
