"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('denies overspend',()=>{a.equal(run({budget:5,spent:4,nextCost:2}).status,'DENY');});
