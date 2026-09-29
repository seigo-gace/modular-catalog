"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('allows within budget',()=>{const r=run({budget:10,spent:3,reserved:2,nextCost:4});a.equal(r.status,'ALLOW');a.equal(r.remaining,5);});
