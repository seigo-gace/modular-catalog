"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('blocks missing ownership contract',()=>{const r=run({module:'x',inputs:['a'],outputs:['b']});a.equal(r.status,'BLOCKED');a.ok(r.missing.includes('stateOwner'));});
