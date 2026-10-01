"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('blocks self integration',()=>{a.equal(run({producer:'x',consumer:'x',contract:'v1',transport:'http',failurePolicy:'stop'}).status,'BLOCKED');});
