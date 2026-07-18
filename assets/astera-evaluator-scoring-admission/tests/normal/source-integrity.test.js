'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.ASTERA_SOURCE_ROOT||"/workspace/scratch/99a09a0b80a1/astera_v8";
const files=["src/quality-completion-evaluator/quality/quality-rule-engine.js","src/quality-completion-evaluator/completion/completion-rule-engine.js","src/quality-completion-evaluator/blocking/blocking-rule-engine.js","src/quality-completion-evaluator/score-calculator.js","src/quality-completion-evaluator/kb-admission-gate.js","src/quality-completion-evaluator/evaluation-result-builder.js"];
test('Asset Sourceは検証済みAstera Sourceと完全一致する',()=>{for(const f of files){const a=fs.readFileSync(path.join(__dirname,'../../source',f));const b=fs.readFileSync(path.join(root,f));assert.equal(crypto.createHash('sha256').update(a).digest('hex'),crypto.createHash('sha256').update(b).digest('hex'),f)}});
