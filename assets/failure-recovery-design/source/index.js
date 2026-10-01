"use strict";
function run({failures=[],recovery_catalog=[]}){if(!Array.isArray(failures)||!Array.isArray(recovery_catalog))return{status:"BLOCKED",plans:[],uncovered:[]};const plans=[],uncovered=[];for(const f of failures){const c=recovery_catalog.find(r=>(r.failure_types||[]).includes(f.type)&&(!f.requires|| (r.capabilities||[]).includes(f.requires)));if(c)plans.push({failure_id:f.id,recovery_id:c.id,steps:c.steps||[]});else uncovered.push(f.id);}return{status:uncovered.length?'PARTIAL':'PASS',plans,uncovered};}
module.exports={run};
