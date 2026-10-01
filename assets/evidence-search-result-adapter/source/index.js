"use strict";
function run({claim_id,results=[]}={}){if(!claim_id||!Array.isArray(results))return{status:"BLOCKED",records:[]};const seen=new Set(),records=[];for(const r of results){if(!r||!r.source_id||!r.url)continue;const k=`${r.source_id}|${r.url}|${r.snippet??''}`;if(seen.has(k))continue;seen.add(k);records.push({claim_id,source_id:r.source_id,url:r.url,title:r.title??null,snippet:r.snippet??null,authority_level:r.authority_level??'unknown',search_status:r.status??'UNKNOWN'});}return{status:'PASS',records};}
module.exports={run};
