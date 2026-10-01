"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('passes only all required evidence',()=>{a.equal(run({required:['source','test'],evidence:{source:{status:'PASS'},test:{status:'PASS'}}}).status,'PASS');});
