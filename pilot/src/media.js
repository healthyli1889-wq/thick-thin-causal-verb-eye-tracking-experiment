export function rectOf(el) {
  const r=el.getBoundingClientRect();return Object.fromEntries(['left','right','top','bottom','width','height','x','y'].map(k=>[k,r[k]]));
}

// Can also be exercised on the camera-free QA page. No synthetic gaze here.
export function observeVideo(video,{timeoutMs=20000,onDone}) {
  const created=performance.now();
  const log={events:[],frames:[],play_request_ms:null,first_playing_ms:null,ended_ms:null,
    dropped_frames:null,total_frames:null,timeout:false,error:null};
  let stopped=false, frameHandle=null;
  const listeners=[];
  const finish=reason=>{
    if(stopped)return; stopped=true;clearTimeout(timer);
    if(frameHandle!==null)video.cancelVideoFrameCallback?.(frameHandle);
    for(const [name,fn] of listeners)video.removeEventListener(name,fn);
    const q=video.getVideoPlaybackQuality?.();
    log.dropped_frames=q?.droppedVideoFrames ?? null;log.total_frames=q?.totalVideoFrames ?? null;
    log.media_duration_s=Number.isFinite(video.duration)?video.duration:null;
    log.final_media_time_s=video.currentTime;log.finish_reason=reason;
    log.wall_playback_ms=log.first_playing_ms===null||log.ended_ms===null?null:log.ended_ms-log.first_playing_ms;
    log.startup_ms=log.first_playing_ms===null?null:log.first_playing_ms-log.play_request_ms;
    log.load_to_finish_ms=performance.now()-created;
    video.pause();onDone(log);
  };
  for(const name of ['loadedmetadata','loadeddata','play','playing','waiting','stalled','pause','ended','error']) {
    const fn=()=>{
      const now=performance.now();log.events.push({event:name,performance_ms:now,media_time_s:video.currentTime,ready_state:video.readyState});
      if(name==='playing'&&log.first_playing_ms===null)log.first_playing_ms=now;
      if(name==='ended'){log.ended_ms=now;finish('ended');}
      if(name==='error'){log.error={code:video.error?.code,message:video.error?.message};finish('media-error');}
    };listeners.push([name,fn]);video.addEventListener(name,fn);
  }
  const frame=(now,m)=>{
    log.frames.push({callback_performance_ms:now,media_time_s:m.mediaTime,presented_frames:m.presentedFrames,
      expected_display_time_ms:m.expectedDisplayTime,presentation_time_ms:m.presentationTime,processing_duration_s:m.processingDuration});
    if(!stopped)frameHandle=video.requestVideoFrameCallback(frame);
  };
  if(video.requestVideoFrameCallback)frameHandle=video.requestVideoFrameCallback(frame);
  const timer=setTimeout(()=>{log.timeout=true;finish('timeout');},timeoutMs);
  video.muted=true;video.playsInline=true;log.play_request_ms=performance.now();
  video.play().catch(e=>{log.error={name:e.name,message:e.message};finish('play-rejected');});
  return {log,cancel:()=>finish('canceled')};
}

export function observeAudio(audio,onEvent) {
  const events=[];const handlers=[];
  for(const name of ['play','playing','waiting','stalled','ended','error']) {
    const fn=()=>{const event={event:name,performance_ms:performance.now(),media_time_s:audio.currentTime};events.push(event);onEvent?.(event);};
    handlers.push([name,fn]);audio.addEventListener(name,fn);
  }
  return {events,cleanup:()=>{for(const [name,fn]of handlers)audio.removeEventListener(name,fn);audio.pause();}};
}
