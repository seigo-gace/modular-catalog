"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('calculates provider model cost',()=>{const r=run({prices:{'p:m':{inputPer1k:1,outputPer1k:2}},usage:[{provider:'p',model:'m',inputTokens:1000,outputTokens:500}]});a.equal(r.status,'PASS');a.equal(r.total,2);});
