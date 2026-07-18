'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=process.env.ASTERA_SOURCE_ROOT||"/workspace/scratch/99a09a0b80a1/astera_v8";
test('実際のAstera利用経路が全件合格する',()=>{const r=spawnSync('npm',['test'],{cwd:root,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);const out=r.stdout+r.stderr;assert.match(out,/tests 52/);assert.match(out,/tests 29/);assert.match(out,/tests 4/);assert.doesNotMatch(out,/fail [1-9]/)});
