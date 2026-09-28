"use strict";
function run({tool,args,reason,authority_ref,mutation=false,approval_ref=null}){if(!tool||!reason||!authority_ref||args===undefined)return{status:'BLOCKED',request:null};if(mutation&&!approval_ref)return{status:'BLOCKED',request:null,reason:'APPROVAL_REQUIRED'};return{status:'PASS',request:{tool,args,reason,authority_ref,mutation,approval_ref}};}
module.exports={run};
