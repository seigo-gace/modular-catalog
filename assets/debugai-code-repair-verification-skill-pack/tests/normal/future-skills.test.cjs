"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('../../source/index.js');

test('repo-pattern-reuse prefers matching proven pattern',()=>{
  const r=s.repoPatternReuse({patterns:[{id:'new',tags:['api'],success_count:0,refs:['N']},{id:'existing',tags:['api','wire'],success_count:7,refs:['E1']}],requiredTags:['api']});
  assert.equal(r.selected_pattern,'existing'); assert.deepEqual(r.pattern_refs,['E1']);
});

test('cross-file dependency trace closes cycle safely',()=>{
  const r=s.crossFileDependencyTrace({graph:{a:['b'],b:['c'],c:['a']},roots:['a']}); assert.deepEqual(r.closure,['a','b','c']);
});

test('multi-file planner excludes files outside dependency closure',()=>{
  const r=s.multiFileChangePlanner({requiredChanges:[{file:'a'},{file:'b'},{file:'metrics'}],dependencyClosure:['a','b']}); assert.deepEqual(r.changes.map(x=>x.file),['a','b']); assert.deepEqual(r.omitted.map(x=>x.file),['metrics']);
});

test('synchronized patchset blocks missing companion edit and contract',()=>{
  let r=s.synchronizedPatchsetGenerator({plan:{changes:[{file:'a'},{file:'b'}]},edits:[{file:'a',after:'TOKEN'}],contracts:[{file:'b',must_include:'WIRE'}]}); assert.equal(r.status,'BLOCKED'); assert.deepEqual(r.missing,['b']);
  r=s.synchronizedPatchsetGenerator({plan:{changes:[{file:'a'},{file:'b'}]},edits:[{file:'a',after:'TOKEN'},{file:'b',after:'WIRE'}],contracts:[{file:'b',must_include:'WIRE'}]}); assert.equal(r.status,'READY');
});

test('context-aware codegen enforces contract tokens',()=>{
  assert.equal(s.contextAwareContractCodegen({template:'const {{K}}={{V}};',contract:{required_tokens:['user_id']},values:{K:'user_id',V:1}}).status,'READY');
  assert.equal(s.contextAwareContractCodegen({template:'const x=1;',contract:{required_tokens:['user_id']},values:{}}).status,'BLOCKED');
});

test('compile feedback repair is scoped',()=>{
  assert.deepEqual(s.compileFeedbackRepair({feedback:'src/a.js:9 SyntaxError',candidateFiles:['src/a.js']}).status,'TARGETED');
  assert.equal(s.compileFeedbackRepair({feedback:'src/b.js:9 SyntaxError',candidateFiles:['src/a.js']}).status,'BLOCKED');
});

test('semantic diff rejects scope creep without duplicate symbol violation',()=>{
  const r=s.semanticDiffReview({changes:[{file:'metrics.js',symbol:'record',before:'x',after:'y'}],allowedFiles:['api.js'],allowedSymbols:['api.js:send']});
  assert.equal(r.status,'REJECT'); assert.equal(r.violations.length,1); assert.equal(r.violations[0].type,'OUT_OF_SCOPE_FILE');
});

test('test impact selector dedupes shared tests',()=>{
  const r=s.testImpactSelector({fileToTests:{a:['t1','shared'],b:['t2','shared']},changedFiles:['a','b']}); assert.deepEqual(r.tests,['shared','t1','t2']);
});

test('failure translator and regression generator create runnable style-shaped candidate',()=>{
  const tr=s.failureToTestTranslator({failure:{id:'x',input:{a:1},expected:2}}); assert.equal(tr.status,'READY');
  const g=s.regressionTestGenerator({style:'node:test',test:tr.test}); assert.equal(g.status,'READY'); assert.match(g.code,/regression:x/);
});

test('targeted regression expands only after previous stage passes',()=>{
  assert.equal(s.targetedRegressionStrategy({targeted:['t'],adjacent:['a'],fullRelevant:['f'],targetedPassed:false,adjacentPassed:false}).stage,'TARGETED');
  assert.equal(s.targetedRegressionStrategy({targeted:['t'],adjacent:['a'],fullRelevant:['f'],targetedPassed:true,adjacentPassed:false}).stage,'ADJACENT');
  assert.equal(s.targetedRegressionStrategy({targeted:['t'],adjacent:['a'],fullRelevant:['f'],targetedPassed:true,adjacentPassed:true}).stage,'FULL_RELEVANT');
});

test('failure interpreter separates environment before patch blame',()=>{
  assert.equal(s.testFailureInterpreter({exitCode:1,stderr:'ECONNREFUSED docker',environmentMarkers:['ECONNREFUSED']}).class,'ENVIRONMENT');
  assert.equal(s.testFailureInterpreter({exitCode:1,stderr:'AssertionError expected 2 actual 3'}).class,'PATCH_OR_CONTRACT');
});

test('false pass detector rejects skip/assert/expect/error swallow',()=>{
  for(const d of ['+ test.skip("x",()=>{})','- assert.equal(a,b)\n+ assert.equal(a,a)','- expected=2\n+ expected=3','+ try{x()}catch(e){}']) assert.equal(s.falsePassDetector({diff:d,testResults:[]}).status,'REJECT',d);
  assert.equal(s.falsePassDetector({diff:'+ const x=1',testResults:[{passed:true}]}).status,'PASS');
});
