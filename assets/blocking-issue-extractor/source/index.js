"use strict";
function run({issues=[]}){if(!Array.isArray(issues))return{status:"BLOCKED",blocking:[]};const blocking=issues.filter(i=>i&&(i.blocking===true||i.status==='UNKNOWN_REQUIRED'||i.severity==='CRITICAL'));return{status:blocking.length?'BLOCKED':'PASS',blocking};}
module.exports={run};
