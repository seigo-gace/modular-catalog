"use strict";
function run({tasks,capabilities}){if(!Array.isArray(tasks)||!Array.isArray(capabilities))return{status:'BLOCKED',bindings:[],missing:[]};const have=new Set(capabilities.map(c=>c.id));const bindings=[],missing=[];for(const t of tasks){const req=t.requires||[];const miss=req.filter(x=>!have.has(x));if(miss.length)missing.push({task_id:t.id,capabilities:miss});else bindings.push({task_id:t.id,capabilities:req});}return{status:missing.length?'BLOCKED':'PASS',bindings,missing};}
module.exports={run};
