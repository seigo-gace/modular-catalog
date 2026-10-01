"use strict";
function planParallelSearch(input={}){
 const qs=Array.isArray(input.questions)?input.questions:[]; const routes=Array.isArray(input.routes)?input.routes:[]; const max=Math.max(1,Math.floor(Number(input.max_parallel)||1));
 if(!qs.length||!routes.length) return {status:'BLOCKED',reason:'MISSING_QUESTION_OR_ROUTE',waves:[]};
 const tasks=[]; for(const q of qs){ for(const r of routes){ if(r&&r.id) tasks.push({question_id:q.question_id||q.id,route_id:r.id}); }}
 const waves=[]; for(let i=0;i<tasks.length;i+=max) waves.push(tasks.slice(i,i+max));
 return {status:'READY',waves,total_tasks:tasks.length,max_parallel:max};
}
module.exports={planParallelSearch};
