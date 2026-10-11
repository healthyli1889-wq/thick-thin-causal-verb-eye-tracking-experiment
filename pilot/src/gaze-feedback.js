function paintGazeDot(el,x,y) {
  if(!el)return;
  if(!Number.isFinite(x)||!Number.isFinite(y)){el.style.display='none';return;}
  const px=Math.min(Math.max(x,0),innerWidth-1),py=Math.min(Math.max(y,0),innerHeight-1);
  el.style.display='block';
  el.style.transform=`translate3d(${px}px,${py}px,0)`;
  el.dataset.offscreen=String(x<0||y<0||x>=innerWidth||y>=innerHeight);
}

// Same coordinates as the validation gate. Does not start a second WebGazer loop.
export function showValidationFeedback(extension) {
  const dot=document.createElement('div');
  dot.id='validation-gaze-dot';dot.setAttribute('aria-hidden','true');
  Object.assign(dot.style,{position:'fixed',left:'0',top:'0',width:'18px',height:'18px',
    marginLeft:'-9px',marginTop:'-9px',borderRadius:'50%',background:'#e00000',
    border:'2px solid #fff',boxSizing:'border-box',pointerEvents:'none',zIndex:'2147483647',display:'none'});
  document.body.append(dot);
  let expiry;
  const unsubscribe=extension.onGazeUpdate(p=>{
    clearTimeout(expiry);
    paintGazeDot(dot,p?.x,p?.y);
    if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))expiry=setTimeout(()=>{dot.style.display='none';},800);
  });
  return ()=>{clearTimeout(expiry);unsubscribe();dot.remove();};
}

export {paintGazeDot};
