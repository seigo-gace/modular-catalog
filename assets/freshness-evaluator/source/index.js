"use strict";
function evaluateFreshness(input={}){
 const asOf=Date.parse(input.as_of||''); const published=Date.parse(input.published_at||''); const max=Number(input.max_age_days);
 if(!Number.isFinite(asOf)||!Number.isFinite(published)||!Number.isFinite(max)||max<0) return {status:'BLOCKED',reason:'INVALID_FRESHNESS_INPUT'};
 const ageDays=(asOf-published)/86400000;
 if(ageDays<0) return {status:'BLOCKED',reason:'SOURCE_FROM_FUTURE'};
 return {status:'READY',age_days:ageDays,fresh:ageDays<=max};
}
module.exports={evaluateFreshness};
