"use strict";
function run({commands=[],results=[]}){if(!Array.isArray(commands)||!Array.isArray(results)||!commands.length)return{status:"BLOCKED",missing:commands||[]};const by=new Map(results.map(r=>[r.command,r]));const missing=commands.filter(c=>!by.has(c));if(missing.length)return{status:"BLOCKED",missing};const failed=commands.filter(c=>by.get(c).exit_code!==0||by.get(c).executed!==true);return{status:failed.length?"FAIL":"PASS",missing:[],failed};}
module.exports={run};
