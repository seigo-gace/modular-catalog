"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('preserves authority trace',()=>{const r=run({authorityIds:['A1'],requirements:[{id:'R1',authorityId:'A1',target:'src/a.js'}]});a.equal(r.status,'READY');a.equal(r.tasks[0].authorityId,'A1');});
