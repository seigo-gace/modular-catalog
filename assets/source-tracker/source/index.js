"use strict";
function trackSource(input={}){
 const source=input.source||{}; const event=input.event||{};
 if(!source.source_id) return {status:'BLOCKED',reason:'MISSING_SOURCE_ID'};
 if(!event.type||!event.at) return {status:'BLOCKED',reason:'MISSING_EVENT'};
 const t=Date.parse(event.at); if(Number.isNaN(t)) return {status:'BLOCKED',reason:'INVALID_EVENT_TIME'};
 const history=Array.isArray(source.history)?source.history.slice():[];
 history.push({type:event.type,at:new Date(t).toISOString(),ref:event.ref??null}); history.sort((a,b)=>a.at.localeCompare(b.at));
 return {status:'READY',source:{...source,history}};
}
module.exports={trackSource};
