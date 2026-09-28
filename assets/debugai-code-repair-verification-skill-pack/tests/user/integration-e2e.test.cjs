"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const s=require('../../source/index.js');

function write(p,c){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);}
function run(cwd,args=null){if(args)return cp.spawnSync(process.execPath,args,{cwd,encoding:'utf8'});const files=fs.readdirSync(path.join(cwd,'test')).filter(x=>x.endsWith('.test.cjs')).sort();let out='';for(const f of files){const r=cp.spawnSync(process.execPath,[path.join('test',f)],{cwd,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:''}});out+=r.stdout+r.stderr;if(r.status!==0)return{...r,stdout:out};}return{status:0,stdout:out,stderr:''};}
function makeWireRepo(root){
 write(path.join(root,'src/contract.js'),`"use strict"; module.exports={WIRE_ID_KEY:"user_id"};\n`);
 write(path.join(root,'src/serializer.js'),`"use strict"; function serialize(user){return {userId:user.id,name:user.name};} module.exports={serialize};\n`);
 write(path.join(root,'src/validator.js'),`"use strict"; function valid(p){return Number.isInteger(p.userId)&&typeof p.name==="string";} module.exports={valid};\n`);
 write(path.join(root,'test/wire.test.cjs'),`"use strict"; const test=require('node:test'); const assert=require('node:assert/strict'); const {serialize}=require('../src/serializer'); const {valid}=require('../src/validator'); const {WIRE_ID_KEY}=require('../src/contract'); test('wire id follows contract and validator agrees',()=>{const p=serialize({id:7,name:'A'}); assert.equal(WIRE_ID_KEY,'user_id'); assert.deepEqual(p,{user_id:7,name:'A'}); assert.equal(valid(p),true); assert.equal(Object.hasOwn(p,'userId'),false);});\n`);
}
function copyDir(src,dst){fs.cpSync(src,dst,{recursive:true});}

test('real repo: Skill ON multi-file repair passes where single-file OFF repair remains broken',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'debugai-wire-base-')); makeWireRepo(base);
 const baseline=run(base); assert.notEqual(baseline.status,0,'baseline must reproduce failure');
 const off=base+'-off', on=base+'-on'; copyDir(base,off); copyDir(base,on);
 write(path.join(off,'src/serializer.js'),`"use strict"; function serialize(user){return {user_id:user.id,name:user.name};} module.exports={serialize};\n`);
 const offRun=run(off); assert.notEqual(offRun.status,0,'single-file repair should expose unsynchronized validator');
 const traced=s.crossFileDependencyTrace({graph:{'src/serializer.js':['src/validator.js','src/contract.js'],'src/validator.js':['src/contract.js'],'src/contract.js':[]},roots:['src/serializer.js']});
 assert.deepEqual(traced.closure,['src/serializer.js','src/validator.js','src/contract.js']);
 const plan=s.multiFileChangePlanner({requiredChanges:[{file:'src/serializer.js',reason:'wire key'},{file:'src/validator.js',reason:'validation key'}],dependencyClosure:traced.closure});
 const edits=[
  {file:'src/serializer.js',after:`"use strict"; function serialize(user){return {user_id:user.id,name:user.name};} module.exports={serialize};\n`},
  {file:'src/validator.js',after:`"use strict"; function valid(p){return Number.isInteger(p.user_id)&&typeof p.name==="string";} module.exports={valid};\n`}
 ];
 const patch=s.synchronizedPatchsetGenerator({plan,edits,contracts:[{file:'src/serializer.js',must_include:'user_id'},{file:'src/validator.js',must_include:'user_id'}]});
 assert.equal(patch.status,'READY'); for(const e of patch.edits) write(path.join(on,e.file),e.after);
 const review=s.semanticDiffReview({changes:patch.edits.map(e=>({file:e.file,before:'userId',after:e.after})),allowedFiles:['src/serializer.js','src/validator.js'],allowedSymbols:[]});
 assert.equal(review.status,'PASS');
 const onRun=run(on); assert.equal(onRun.status,0,`ON failed:\n${onRun.stdout}\n${onRun.stderr}`);
});

test('real compile feedback: target is localized, repaired, syntax and runtime regression pass',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'debugai-compile-'));
 write(path.join(root,'src/math.js'),`"use strict"; function add(a,b){ return a+b; module.exports={add};\n`);
 write(path.join(root,'test/math.test.cjs'),`"use strict"; const test=require('node:test'); const assert=require('node:assert/strict'); const {add}=require('../src/math'); test('add',()=>assert.equal(add(2,3),5));\n`);
 const chk=run(root,['--check','src/math.js']); assert.notEqual(chk.status,0);
 const feedback=`src/math.js:1 SyntaxError: Unexpected end of input`;
 const loc=s.compileFeedbackRepair({feedback,candidateFiles:['src/math.js']}); assert.equal(loc.status,'TARGETED');
 write(path.join(root,'src/math.js'),`"use strict"; function add(a,b){ return a+b; } module.exports={add};\n`);
 const chk2=run(root,['--check','src/math.js']); assert.equal(chk2.status,0,chk2.stderr);
 const tests=run(root); assert.equal(tests.status,0,tests.stderr);
});

test('real false-pass guard: cheating test edits are rejected even if reported test status is PASS',()=>{
 const cheatingDiff=`- test('wire',()=>{ assert.equal(actual, expected); })\n+ test.skip('wire',()=>{ assert.equal(actual, actual); })`;
 const r=s.falsePassDetector({diff:cheatingDiff,testResults:[{name:'suite',passed:true,skipped:true}]});
 assert.equal(r.status,'REJECT'); assert.ok(r.reasons.includes('TEST_SELECTION_MUTATION')); assert.ok(r.reasons.includes('ASSERTION_MUTATION')); assert.ok(r.reasons.includes('SKIPPED_TEST'));
});

test('fail-closed: incomplete multi-file patch is blocked before application',()=>{
 const plan={changes:[{file:'a.js'},{file:'b.js'}]};
 const p=s.synchronizedPatchsetGenerator({plan,edits:[{file:'a.js',after:'const user_id=1;'}],contracts:[{file:'b.js',must_include:'user_id'}]});
 assert.equal(p.status,'BLOCKED'); assert.deepEqual(p.missing,['b.js']);
});
