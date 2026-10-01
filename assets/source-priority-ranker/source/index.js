"use strict";
const W={primary:3,secondary:2,unknown:1};
function rankSources(input={}){
 const xs=Array.isArray(input.sources)?input.sources:[];
 if(!xs.length) return {status:'BLOCKED',reason:'NO_SOURCES',ranked:[]};
 const ranked=xs.map((s,i)=>({...s,_i:i,_score:(W[s.authority_level]||0)*100+(Number(s.direct_record)||0)*20+(Number(s.official)||0)*10})).sort((a,b)=>b._score-a._score||a._i-b._i).map(({_i,_score,...s},rank)=>({...s,rank:rank+1,score:_score}));
 return {status:'READY',ranked};
}
module.exports={rankSources};
