"use strict";
function get(o,path){return String(path).split(".").reduce((v,k)=>v==null?undefined:v[k],o);}
function run({canonical,provider,fields=[]}={}){
  if(!canonical||!provider||!Array.isArray(fields)||fields.length===0) return {status:"BLOCKED",mismatches:[],reason:"INVALID_INPUT"};
  const mismatches=[];
  for(const field of fields){const a=get(canonical,field),b=get(provider,field); if(JSON.stringify(a)!==JSON.stringify(b)) mismatches.push({field,canonical:a,provider:b});}
  return {status:mismatches.length?"MISMATCH":"PASS",mismatches};
}
module.exports={run};
