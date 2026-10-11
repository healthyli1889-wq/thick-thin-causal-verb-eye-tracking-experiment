import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {ITEMS} from '../src/stimuli.js';
const root=path.resolve(import.meta.dirname,'..');let errors=[];
if(ITEMS.length!==4||new Set(ITEMS.map(i=>i.verb)).size!==4||!['bend','break','crack','spill'].every(v=>ITEMS.some(i=>i.verb===v)))errors.push('Expected exactly bend, break, crack, spill');
for(const item of ITEMS)if(item.audio.thick.spoken!==item.verb||item.audio.thin.spoken!==(item.thinSpoken||`cause to ${item.verb}`))errors.push(`Phrase contract ${item.id}`);
for(const file of ['assets/audio/speech-check.wav',...ITEMS.flatMap(i=>Object.values(i.audio).map(a=>a.file))]) {
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',path.join(root,file)],{encoding:'utf8'}));
 if(!(Number(info.format?.duration)>0.1))errors.push(`Empty/invalid audio: ${file}`);
 execFileSync('ffmpeg',['-v','error','-i',path.join(root,file),'-f','null','-']);
}
for(const item of ITEMS){for(const file of [item.video,item.tableau,...Object.values(item.audio).map(a=>a.file)])if(!fs.existsSync(path.join(root,file)))errors.push(`Missing ${file}`);
 const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type','-of','json',path.join(root,item.video)],{encoding:'utf8'})).streams;
 if(streams.some(s=>s.codec_type==='audio'))errors.push(`Expected a silent video-only asset: ${item.id}`);
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=duration,r_frame_rate,nb_read_frames,width,height','-of','json',path.join(root,item.video)],{encoding:'utf8'})).streams[0];
 const [num,den]=info.r_frame_rate.split('/').map(Number);
 if(Math.abs(Number(info.duration)*1000-item.durationMs)>1||Number(info.nb_read_frames)!==Math.round(item.durationMs/1000*item.fps)||num/den!==item.fps)errors.push(`Video contract ${item.id}: ${JSON.stringify(info)}`);
 execFileSync('ffmpeg',['-v','error','-xerror','-i',path.join(root,item.video),'-f','null','-']);
 execFileSync('ffmpeg',['-v','error','-xerror','-i',path.join(root,item.tableau),'-f','null','-']);
 console.log(`${item.id}: ${info.duration}s, ${info.nb_read_frames} frames, ${info.r_frame_rate} fps`);
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'build-manifest.json')));
for(const entry of manifest.files){const p=path.join(root,entry.path);if(!fs.existsSync(p)||crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==entry.sha256)errors.push(`Changed since build: ${entry.path}`);}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Assets and build manifest verified. Scientific readiness remains false.');
