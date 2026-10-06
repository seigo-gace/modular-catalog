"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('blocks missing expected oracle value',()=>{const r=run({failure:{id:'F1',subject:'parse',input:'x'}});a.equal(r.status,'BLOCKED');});
