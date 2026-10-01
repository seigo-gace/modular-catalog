const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({impact:2,urgency:2,policy:{sev1_min:12,sev2_min:8,sev3_min:4}}).severity,'SEV3');
