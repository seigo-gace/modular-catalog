'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.ASTERA_SOURCE_ROOT||"/workspace/scratch/99a09a0b80a1/astera_v8";
const files=["src/llm/adapter-base.js","src/llm/adapters.js","src/llm/http-client.js","src/llm/providers/anthropic.js","src/llm/providers/null.js","src/llm/providers/ollama.js","src/llm/providers/openai-compatible.js","src/llm/providers/openai.js"];
test('Asset Sourceは検証済みAstera Sourceと完全一致する',()=>{for(const f of files){const a=fs.readFileSync(path.join(__dirname,'../../source',f));const b=fs.readFileSync(path.join(root,f));assert.equal(crypto.createHash('sha256').update(a).digest('hex'),crypto.createHash('sha256').update(b).digest('hex'),f)}});
