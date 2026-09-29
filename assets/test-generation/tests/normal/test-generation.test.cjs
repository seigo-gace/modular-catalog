"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('builds regression test spec',()=>{const r=run({failure:{id:'F1',subject:'parse',input:'x',expected:'y'}});a.equal(r.status,'READY');a.equal(r.test.name,'regression:F1');});
