export const ITEMS = [
  { id:'path-break', verb:'break', outcome:'fence', distal:'green triangle', proximal:'red cube',
    thickQuestion:'Who broke the fence?', thinQuestion:'Who caused the fence to break?', centers:[[.51,.54],[.75,.54]] },
  { id:'car-bend', verb:'bend', outcome:'sign', distal:'blue car', proximal:'orange car',
    thickQuestion:'Who bent the sign?', thinQuestion:'Who caused the sign to bend?', centers:[[.53,.56],[.76,.56]] },
  { id:'painting-crack', fileId:'painting-crack-v056', verb:'crack', outcome:'mirror', distal:'yellow triangle', proximal:'purple cube',
    thickQuestion:'Who cracked the mirror?', thinQuestion:'Who caused the mirror to crack?', centers:[[.47,.58],[.69,.55]] },
  { id:'juice-split', fileId:'juice-split-v053', verb:'spill', outcome:'drink', distal:'teal capsule', proximal:'brown cube',
    thickQuestion:'Who spilled the drink?', thinQuestion:'Who caused the drink to spill?', centers:[[.48,.53],[.73,.53]] },
].map(item => ({...item,
  video:`assets/event/items/${item.fileId || item.id}.mp4`,
  tableau:`assets/event/items/${item.fileId || item.id}.png`,
  durationMs:4000, fps:24,
  geometrySource:'approximate-final-frame-centers-from-2026-10-02-audit',
  geometryValidated:false,
  audio:Object.fromEntries(['thick','thin'].map(condition => [condition, {
    file:`assets/audio/verb-${condition}-${item.verb}.mp3`,
    spoken: condition === 'thin' ? (item.thinSpoken || `cause to ${item.verb}`) : item.verb,
    wordOnsetMs:null, wordOnsetsMs:null, wordOnsetSource:null, onsetVerified:false,
    provenance:'existing-macos-say-Samantha',
  }])),
}));

export function centers(item, layout) {
  return item.centers.map(([x,y]) => [layout === 'mirrored' ? 1-x : x,y]);
}
export function geometry(item, layout, rect) {
  const c = centers(item,layout).map(([x,y]) => ({x:rect.left+x*rect.width,y:rect.top+y*rect.height}));
  const mid = (c[0].x+c[1].x)/2;
  const separation = Math.abs(c[1].x-c[0].x);
  const make = (role, index) => ({role,left:c[index].x < mid ? rect.left : mid,
    right:c[index].x < mid ? mid : rect.right,top:rect.top,bottom:rect.bottom});
  return { stage:rect, centers:c, midpoint:{x:mid,y:(c[0].y+c[1].y)/2}, separationPx:separation,
    // Coarse spatial sides, NOT verified object outlines. No video AOI attribution.
    regions:[make('distal',0),make('proximal',1)], validated:item.geometryValidated,
    radius200SupportsSeparation:separation >= 400, source:item.geometrySource };
}
export function stageHtml(item, layout, video=false) {
  return `<div id="stage" class="stimulus-stage">${video
    ? `<video id="event-video" src="${item.video}" muted playsinline preload="auto" class="${layout}"></video>`
    : `<img src="${item.tableau}" class="${layout}" alt="The event scene">`}</div>`;
}
