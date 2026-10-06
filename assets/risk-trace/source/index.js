"use strict";
function run({risks=[]}){if(!Array.isArray(risks))return{status:"BLOCKED",items:[]};const items=risks.map(r=>{const score=(Number(r.impact)||0)*(Number(r.likelihood)||0);return{...r,score,severity:score>=16?'CRITICAL':score>=9?'HIGH':score>=4?'MEDIUM':'LOW',blocking:score>=16||r.blocking===true};}).sort((a,b)=>b.score-a.score);return{status:items.some(x=>x.blocking)?'BLOCKED':'PASS',items};}
module.exports={run};
