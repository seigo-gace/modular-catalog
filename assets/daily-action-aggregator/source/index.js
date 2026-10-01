"use strict";
function run({items=[],now_at}={}){
  if(!Array.isArray(items)||!now_at) return {status:"BLOCKED",actions:[],reason:"INVALID_INPUT"};
  const now=Date.parse(now_at); if(Number.isNaN(now)) return {status:"BLOCKED",actions:[],reason:"INVALID_NOW"};
  const rank={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};
  const actions=items.filter(x=>x&&x.id&&x.requires_action===true&&x.status!=="DONE").map(x=>{
    const due=x.due_at?Date.parse(x.due_at):null;
    return {...x,overdue:Number.isFinite(due)?due<now:false};
  }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)-( (rank[b.priority]||0)-(rank[a.priority]||0) ) || String(a.id).localeCompare(String(b.id)));
  return {status:"PASS",actions};
}
module.exports={run};
