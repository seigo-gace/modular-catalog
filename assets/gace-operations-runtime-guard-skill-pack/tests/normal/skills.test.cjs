"use strict";const test=require('node:test');const a=require('node:assert/strict');const s=require('../../source/index.js');
test('cost budget blocks overspend',()=>a.equal(s.enforceCostBudget({spent:8,estimatedNext:3,budget:10}).status,'BLOCK'));
test('retry only transient and bounded',()=>{a.equal(s.planRetry({attempt:1,maxAttempts:3,errorClass:'TIMEOUT'}).retry,true);a.equal(s.planRetry({attempt:3,maxAttempts:3,errorClass:'TIMEOUT'}).retry,false);a.equal(s.planRetry({attempt:1,maxAttempts:3,errorClass:'PERMANENT'}).retry,false);});
test('rate limit fail closed',()=>a.equal(s.guardRateLimit({used:10,limit:10,requested:1}).allowed,false));
test('circuit opens at threshold',()=>a.equal(s.circuitBreakerDecision({recentFailures:3,threshold:3}).state,'OPEN'));
test('backpressure throttles at high watermark',()=>a.equal(s.backpressureDecision({queueDepth:5,highWatermark:5}).status,'THROTTLE'));
test('checkpoint requires identity and avoids completed effects on resume',()=>{const c=s.buildCheckpoint({runId:'r',step:'s',state:{x:1},effects:['a','b']});a.equal(c.status,'READY');a.deepEqual(s.resumeFromCheckpoint({checkpoint:c.checkpoint,completedEffects:['a']}).pendingEffects,['b']);});
test('availability fails required only',()=>{a.equal(s.assessAvailability({checks:[{id:'a',status:'FAIL',required:false},{id:'b',status:'PASS'}]}).status,'AVAILABLE');a.equal(s.assessAvailability({checks:[{id:'b',status:'FAIL'}]}).status,'DEGRADED');});
test('dead letter only after attempts exhausted',()=>{a.equal(s.classifyDeadLetter({errorClass:'X',attempt:2,maxAttempts:3}).deadLetter,false);a.equal(s.classifyDeadLetter({errorClass:'X',attempt:3,maxAttempts:3}).deadLetter,true);});
