"use strict";
function normalizeSourceMetadata(input={}){
 const sourceId=String(input.source_id||'').trim();
 const url=String(input.url||'').trim();
 const authority=String(input.authority_level||'').trim().toLowerCase();
 const published=input.published_at==null?null:String(input.published_at).trim();
 if(!sourceId) return {status:'BLOCKED',reason:'MISSING_SOURCE_ID'};
 if(!url) return {status:'BLOCKED',reason:'MISSING_URL'};
 if(!['primary','secondary','unknown'].includes(authority)) return {status:'BLOCKED',reason:'INVALID_AUTHORITY_LEVEL'};
 let publishedAt=null;
 if(published){ const t=Date.parse(published); if(Number.isNaN(t)) return {status:'BLOCKED',reason:'INVALID_PUBLISHED_AT'}; publishedAt=new Date(t).toISOString(); }
 return {status:'READY',source:{source_id:sourceId,url,authority_level:authority,published_at:publishedAt,scope:input.scope??null}};
}
module.exports={normalizeSourceMetadata};
