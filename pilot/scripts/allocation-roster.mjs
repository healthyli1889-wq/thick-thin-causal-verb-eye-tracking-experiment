import fs from 'node:fs';import {makeAssignment} from '../src/assignment.js';import {ITEMS} from '../src/stimuli.js';
const [out='allocation-roster.csv',n='32']=process.argv.slice(2);if(!Number.isSafeInteger(Number(n))||Number(n)<1)throw new Error('Positive allocation count required');
const rows=['allocation,cell,list,layout,probe_pattern,video_order,first_probes,start_url,participant_code,session_id,status'];
for(let i=1;i<=Number(n);i++){const a=makeAssignment(i,ITEMS);rows.push([i,a.cell,a.list,a.layout,a.probe_pattern,a.items.map(x=>x.id).join('|'),a.items.map(x=>x.conditions[0]).join('|'),`http://localhost:8765/?allocation=${i}`,'','','pending'].join(','));}
fs.writeFileSync(out,rows.join('\n')+'\n',{flag:'wx'});console.log(out);
