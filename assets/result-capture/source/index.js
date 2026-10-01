"use strict";
function run({task_id,tool,exit_code,stdout="",stderr="",started_at,ended_at}){if(!task_id||!tool||!Number.isInteger(exit_code)||!started_at||!ended_at)return{status:"BLOCKED",result:null};return{status:"PASS",result:{task_id,tool,exit_code,stdout,stderr,started_at,ended_at,success:exit_code===0}};}
module.exports={run};
