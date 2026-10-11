import fs from 'node:fs';import {calibrationReport} from '../src/calibration-report.js';
const input=process.argv[2];if(!input)throw Error('Usage: node analysis/calibration-report.mjs session-or-recovery.json');
console.log(JSON.stringify(calibrationReport(JSON.parse(fs.readFileSync(input,'utf8'))),null,2));
