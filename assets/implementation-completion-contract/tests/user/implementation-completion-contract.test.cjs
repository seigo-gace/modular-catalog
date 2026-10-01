"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('not executed test stays incomplete',()=>{const r=run({required:['source','test'],evidence:{source:{status:'PASS'},test:{status:'NOT_EXECUTED'}}});a.equal(r.status,'INCOMPLETE');});
