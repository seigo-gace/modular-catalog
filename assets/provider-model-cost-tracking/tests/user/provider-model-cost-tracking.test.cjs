"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('unknown price stays partial not zero-cost pass',()=>{const r=run({prices:{},usage:[{provider:'p',model:'x',inputTokens:1}]});a.equal(r.status,'PARTIAL');a.deepEqual(r.unknown,['p:x']);});
