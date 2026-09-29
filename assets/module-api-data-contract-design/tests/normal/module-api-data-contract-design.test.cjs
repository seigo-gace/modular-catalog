"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('builds deterministic public contract',()=>{const r=run({module:'billing',inputs:['req'],outputs:['res'],stateOwner:'db',dependencies:['vault','db','db']});a.equal(r.status,'READY');a.deepEqual(r.contract.dependencies,['db','vault']);});
