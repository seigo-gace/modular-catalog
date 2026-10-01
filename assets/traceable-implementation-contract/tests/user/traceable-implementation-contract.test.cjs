"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('blocks unknown authority',()=>{a.equal(run({authorityIds:['A1'],requirements:[{id:'R1',authorityId:'A2'}]}).status,'BLOCKED');});
