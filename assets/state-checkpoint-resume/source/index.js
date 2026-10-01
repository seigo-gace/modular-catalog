"use strict";
function run({run_id,role_execution_id,attempt_id,completed_units=[],next_unit,generation}){if(!run_id||!role_execution_id||!attempt_id||!Number.isInteger(generation)||generation<0)return{status:'BLOCKED',checkpoint:null};const done=[...new Set(completed_units)];if(next_unit&&done.includes(next_unit))return{status:'BLOCKED',checkpoint:null,reason:'NEXT_ALREADY_COMPLETED'};return{status:'PASS',checkpoint:{run_id,role_execution_id,attempt_id,generation,completed_units:done,next_unit:next_unit||null}};}
module.exports={run};
