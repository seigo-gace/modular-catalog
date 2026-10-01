"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('builds integration plan',()=>{const r=run({producer:'api',consumer:'worker',contract:'v1',transport:'http',failurePolicy:'fail-closed',verification:['e2e','contract']});a.equal(r.status,'READY');a.deepEqual(r.plan.verification,['contract','e2e']);});
