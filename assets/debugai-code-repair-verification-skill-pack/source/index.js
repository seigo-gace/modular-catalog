"use strict";

function uniq(xs){return [...new Set(xs)];}

function repoPatternReuse({patterns, requiredTags=[]}){
  const candidates=(patterns||[]).filter(p=>requiredTags.every(t=>(p.tags||[]).includes(t)));
  candidates.sort((a,b)=>(b.success_count||0)-(a.success_count||0) || String(a.id).localeCompare(String(b.id)));
  return {selected_pattern:candidates[0]?.id||null, pattern_refs:candidates[0]?.refs||[], rejected_patterns:(patterns||[]).filter(p=>p.id!==candidates[0]?.id).map(p=>p.id)};
}

function crossFileDependencyTrace({graph, roots}){
  const seen=new Set(), order=[], q=[...(roots||[])];
  while(q.length){
    const n=q.shift(); if(seen.has(n)) continue; seen.add(n); order.push(n);
    for(const dep of (graph?.[n]||[])) if(!seen.has(dep)) q.push(dep);
  }
  return {closure:order};
}

function multiFileChangePlanner({requiredChanges, dependencyClosure}){
  const allowed=new Set(dependencyClosure||[]);
  const changes=(requiredChanges||[]).filter(c=>allowed.has(c.file));
  const omitted=(requiredChanges||[]).filter(c=>!allowed.has(c.file));
  return {changes, omitted};
}

function synchronizedPatchsetGenerator({plan, edits, contracts=[]}){
  const byFile=new Map((edits||[]).map(e=>[e.file,e]));
  const missing=(plan?.changes||[]).map(c=>c.file).filter(f=>!byFile.has(f));
  const contractErrors=[];
  for(const c of contracts){
    const e=byFile.get(c.file);
    if(!e || !String(e.after||"").includes(c.must_include)) contractErrors.push(`${c.file}:${c.must_include}`);
  }
  return {status:missing.length||contractErrors.length?"BLOCKED":"READY", edits:[...byFile.values()], missing, contract_errors:contractErrors};
}

function contextAwareContractCodegen({template, contract, values}){
  if(!template||!contract) return {status:"BLOCKED", code:null, reason:"MISSING_TEMPLATE_OR_CONTRACT"};
  let code=String(template);
  for(const [k,v] of Object.entries(values||{})) code=code.replaceAll(`{{${k}}}`,String(v));
  const missing=(contract.required_tokens||[]).filter(t=>!code.includes(t));
  return missing.length?{status:"BLOCKED",code:null,reason:`CONTRACT_TOKENS_MISSING:${missing.join(',')}`}:{status:"READY",code};
}

function compileFeedbackRepair({feedback,candidateFiles}){
  const m=String(feedback||"").match(/([^\s:]+\.(?:js|cjs|mjs|ts))(?::(\d+))?/);
  if(!m) return {status:"UNKNOWN",target:null};
  const target=m[1];
  if(!(candidateFiles||[]).includes(target)) return {status:"BLOCKED",target,reason:"OUTSIDE_CANDIDATE_SCOPE"};
  return {status:"TARGETED",target,line:m[2]?Number(m[2]):null};
}

function semanticDiffReview({changes, allowedFiles, allowedSymbols, protectedContracts=[]}){
  const violations=[];
  for(const c of changes||[]){
    const fileAllowed=(allowedFiles||[]).includes(c.file);
    if(!fileAllowed){violations.push({file:c.file,type:"OUT_OF_SCOPE_FILE"});continue;}
    if(c.symbol && !(allowedSymbols||[]).includes(`${c.file}:${c.symbol}`)) violations.push({file:c.file,type:"OUT_OF_SCOPE_SYMBOL",symbol:c.symbol});
    for(const token of protectedContracts){if(String(c.before||"").includes(token)&&!String(c.after||"").includes(token)) violations.push({file:c.file,type:"CONTRACT_REMOVED",token});}
  }
  return {status:violations.length?"REJECT":"PASS",violations};
}

function testImpactSelector({fileToTests, changedFiles}){
  return {tests:uniq((changedFiles||[]).flatMap(f=>fileToTests?.[f]||[])).sort()};
}

function failureToTestTranslator({failure}){
  if(!failure?.id||!failure?.input||failure.expected===undefined) return {status:"BLOCKED",test:null};
  return {status:"READY",test:{name:`regression:${failure.id}`,input:failure.input,expected:failure.expected}};
}

function regressionTestGenerator({style,test}){
  if(!style||!test) return {status:"BLOCKED",code:null};
  if(style==="node:test") return {status:"READY",code:`test(${JSON.stringify(test.name)},()=>{ assert.deepEqual(subject(${JSON.stringify(test.input)}), ${JSON.stringify(test.expected)}); });`};
  return {status:"BLOCKED",code:null};
}

function targetedRegressionStrategy({targeted,adjacent,fullRelevant,targetedPassed,adjacentPassed}){
  if(!targetedPassed) return {stage:"TARGETED",tests:targeted||[]};
  if(!adjacentPassed) return {stage:"ADJACENT",tests:uniq([...(targeted||[]),...(adjacent||[])])};
  return {stage:"FULL_RELEVANT",tests:uniq([...(targeted||[]),...(adjacent||[]),...(fullRelevant||[])])};
}

function testFailureInterpreter({exitCode,stderr,knownFlaky=false,environmentMarkers=[]}){
  const text=String(stderr||"");
  if(environmentMarkers.some(m=>text.includes(m))) return {class:"ENVIRONMENT"};
  if(knownFlaky) return {class:"FLAKY"};
  if(/AssertionError|expected|actual/i.test(text)) return {class:"PATCH_OR_CONTRACT"};
  if(exitCode===0) return {class:"PASS"};
  return {class:"UNKNOWN"};
}

function falsePassDetector({diff,testResults}){
  const text=String(diff||""); const reasons=[];
  const rules=[
    [/\.(skip|only)\s*\(/, "TEST_SELECTION_MUTATION"],
    [/assert\.(?:equal|deepEqual|strictEqual)\([^\n]*\)\s*;?\s*$/m, null],
    [/^[-+].*assert\./m,"ASSERTION_MUTATION"],
    [/^[-+].*(expected|toEqual|toBe)\b/m,"EXPECTATION_MUTATION"],
    [/mock(?:Implementation|ReturnValue).*always|overmock/i,"OVERMOCK"],
    [/catch\s*\([^)]*\)\s*\{\s*\}/s,"ERROR_SWALLOW"]
  ];
  for(const [re,reason] of rules) if(reason && re.test(text)) reasons.push(reason);
  if((testResults||[]).some(r=>r.skipped)) reasons.push("SKIPPED_TEST");
  return {status:reasons.length?"REJECT":"PASS",reasons:uniq(reasons)};
}

module.exports={repoPatternReuse,crossFileDependencyTrace,multiFileChangePlanner,synchronizedPatchsetGenerator,contextAwareContractCodegen,compileFeedbackRepair,semanticDiffReview,testImpactSelector,failureToTestTranslator,regressionTestGenerator,targetedRegressionStrategy,testFailureInterpreter,falsePassDetector};
