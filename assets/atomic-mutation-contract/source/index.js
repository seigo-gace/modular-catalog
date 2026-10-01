"use strict";
function run({target,expected_before,after,rollback,approval_ref}={}){if(!target||expected_before===undefined||after===undefined||!rollback||!approval_ref)return{status:"BLOCKED",reason:"INCOMPLETE_MUTATION"};if(JSON.stringify(expected_before)===JSON.stringify(after))return{status:"BLOCKED",reason:"NO_OP_MUTATION"};return{status:"READY",mutation:{target,expected_before,after,rollback,approval_ref}};}
module.exports={run};
