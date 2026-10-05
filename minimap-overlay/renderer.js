'use strict';

const canvas=document.getElementById('mapCanvas'),ctx=canvas.getContext('2d'),mapImage=document.getElementById('mapImage'),capture=document.getElementById('capture'),captureCanvas=document.getElementById('captureCanvas'),captureCtx=captureCanvas.getContext('2d',{willReadFrequently:true}),statusEl=document.getElementById('status'),arrow=document.getElementById('playerArrow'),panel=document.getElementById('panel');
const MAP_W=3734,MAP_H=5600,WORLD_X_MIN=-4140,WORLD_X_MAX=4860,WORLD_Y_MIN=-5100,WORLD_Y_MAX=8400,FIRST_POINT={x:485.45220947266,y:-1378.0570068359,z:29.284469604492},TRACK_POINT={x:150,y:140},ROI_SIZE=900,INDEX_REBUILD_DISTANCE=130,MATCH_INTERVAL=380;
let userCorrection=readCorrection(),coords={...FIRST_POINT},targetPoint,displayPoint,targetHeading=0,displayHeading=0,zoom=1.6,panelVisible=true,calibrationMode=false,calibrationViewport=null,autoTrack=true,streamReady=false,cvReady=false,mapReady=false,orb,matcher,roiMat,roiKeypoints,roiDescriptors,roiOrigin={x:0,y:0},roiCenter=null,lastGoodMatch=0,trackingAcquired=false,matchBusy=false,lastFrame=performance.now();

function baseWorldToMap(x,y){return{x:(x-WORLD_X_MIN)/(WORLD_X_MAX-WORLD_X_MIN)*MAP_W,y:(WORLD_Y_MAX-y)/(WORLD_Y_MAX-WORLD_Y_MIN)*MAP_H}}
function readCorrection(){try{const value=JSON.parse(localStorage.getItem('ad-atlas-calibration-v3')||'null');if(Number.isFinite(value?.x)&&Number.isFinite(value?.y))return value}catch(_error){}return{x:0,y:0}}
function worldToMap(x,y){const point=baseWorldToMap(x,y);return{x:point.x+userCorrection.x,y:point.y+userCorrection.y}}
targetPoint=worldToMap(coords.x,coords.y);displayPoint={...targetPoint};
function resizeCanvas(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio))}

function draw(){
  if(!mapReady)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(calibrationMode){
    const scale=Math.min(canvas.width/MAP_W,canvas.height/MAP_H),w=MAP_W*scale,h=MAP_H*scale,x=(canvas.width-w)/2,y=(canvas.height-h)/2;
    calibrationViewport={x,y,w,h};ctx.fillStyle='#090706';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(mapImage,x,y,w,h);
    const markerX=x+(targetPoint.x/MAP_W)*w,markerY=y+(targetPoint.y/MAP_H)*h;ctx.strokeStyle='#ff5a1f';ctx.lineWidth=Math.max(2,canvas.width/210);ctx.beginPath();ctx.arc(markerX,markerY,Math.max(5,canvas.width/70),0,Math.PI*2);ctx.moveTo(markerX-12,markerY);ctx.lineTo(markerX+12,markerY);ctx.moveTo(markerX,markerY-12);ctx.lineTo(markerX,markerY+12);ctx.stroke();return;
  }
  calibrationViewport=null;
  const cssW=canvas.clientWidth||420,cssH=canvas.clientHeight||320,sourceW=Math.min(MAP_W,cssW*3.5/zoom),sourceH=Math.min(MAP_H,cssH*3.5/zoom),sx=Math.max(0,Math.min(MAP_W-sourceW,displayPoint.x-sourceW/2)),sy=Math.max(0,Math.min(MAP_H-sourceH,displayPoint.y-sourceH/2));
  ctx.drawImage(mapImage,sx,sy,sourceW,sourceH,0,0,canvas.width,canvas.height);arrow.style.transform=`translate(-50%,-50%) rotate(${displayHeading}deg)`;
}
function animate(now){const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;const a=1-Math.exp(-dt/.22),ha=1-Math.exp(-dt/.14);displayPoint.x+=(targetPoint.x-displayPoint.x)*a;displayPoint.y+=(targetPoint.y-displayPoint.y)*a;const delta=((targetHeading-displayHeading+540)%360)-180;displayHeading+=delta*ha;draw();requestAnimationFrame(animate)}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function updateCoordinates(value,source='буфер'){if(!Number.isFinite(value.x)||!Number.isFinite(value.y))return;coords=value;targetPoint=worldToMap(value.x,value.y);if(source==='первая точка')displayPoint={...targetPoint};trackingAcquired=false;clearLocalIndex();document.getElementById('xValue').textContent=value.x.toFixed(2);document.getElementById('yValue').textContent=value.y.toFixed(2);statusEl.textContent=`${source}: ${value.x.toFixed(1)}, ${value.y.toFixed(1)}`;arrow.classList.remove('lost')}
function applyHomography(H,x,y){const h=H.data64F?.length?H.data64F:H.data32F,a=h[0]*x+h[1]*y+h[2],b=h[3]*x+h[4]*y+h[5],c=h[6]*x+h[7]*y+h[8];return{x:a/c,y:b/c}}
function clearLocalIndex(){roiMat?.delete?.();roiMat=null;roiKeypoints?.delete?.();roiKeypoints=null;roiDescriptors?.delete?.();roiDescriptors=null;roiCenter=null}
function initMatcher(){if(!cvReady||!mapReady||orb)return;try{orb=new cv.ORB();matcher=new cv.BFMatcher(cv.NORM_HAMMING,true);statusEl.textContent='Распознавание готово'}catch(error){statusEl.textContent='OpenCV: '+error.message}}
function rebuildLocalIndex(){
  if(roiCenter&&distance(roiCenter,targetPoint)<INDEX_REBUILD_DISTANCE&&roiDescriptors&&!roiDescriptors.empty())return;
  clearLocalIndex();const size=Math.min(ROI_SIZE,MAP_W,MAP_H),x=Math.round(Math.max(0,Math.min(MAP_W-size,targetPoint.x-size/2))),y=Math.round(Math.max(0,Math.min(MAP_H-size,targetPoint.y-size/2))),temp=document.createElement('canvas');temp.width=size;temp.height=size;temp.getContext('2d').drawImage(mapImage,x,y,size,size,0,0,size,size);roiMat=cv.imread(temp);cv.cvtColor(roiMat,roiMat,cv.COLOR_RGBA2GRAY);cv.equalizeHist(roiMat,roiMat);roiKeypoints=new cv.KeyPointVector();roiDescriptors=new cv.Mat();const emptyMask=new cv.Mat();orb.detectAndCompute(roiMat,emptyMask,roiKeypoints,roiDescriptors);emptyMask.delete();roiOrigin={x,y};roiCenter={...targetPoint};
}
async function startCapture(){try{const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:10,max:15}},audio:false});capture.srcObject=stream;await capture.play();streamReady=true;statusEl.textContent='Окно FiveM найдено';setInterval(matchMinimap,MATCH_INTERVAL)}catch(_error){statusEl.textContent='Не удалось захватить FiveM';arrow.classList.add('lost')}}

function matchMinimap(){
  if(!autoTrack||calibrationMode||!streamReady||!cvReady||!orb||matchBusy||!capture.videoWidth)return;matchBusy=true;
  let src,gray,keypoints,descriptors,emptyMask,matches,srcPts,dstPts,inlierMask,H;
  try{
    rebuildLocalIndex();if(!roiDescriptors||roiDescriptors.empty())throw Error('нет ориентиров рядом');
    const vw=capture.videoWidth,vh=capture.videoHeight,x=Math.round(vw*.014),y=Math.round(vh*.808),w=Math.round(vw*.145),h=Math.round(vh*.163);captureCanvas.width=300;captureCanvas.height=188;captureCtx.drawImage(capture,x,y,w,h,0,0,300,188);
    src=cv.imread(captureCanvas);gray=new cv.Mat();cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.equalizeHist(gray,gray);keypoints=new cv.KeyPointVector();descriptors=new cv.Mat();emptyMask=new cv.Mat();orb.detectAndCompute(gray,emptyMask,keypoints,descriptors);if(descriptors.empty()||keypoints.size()<14)throw Error('мало ориентиров');
    matches=new cv.DMatchVector();matcher.match(descriptors,roiDescriptors,matches);const good=[];for(let i=0;i<matches.size();i++){const match=matches.get(i);if(match.distance<66)good.push(match)}good.sort((a,b)=>a.distance-b.distance);const selected=good.slice(0,80);if(selected.length<12)throw Error('карта не распознана');
    const srcData=[],dstData=[];for(const match of selected){const from=keypoints.get(match.queryIdx).pt,to=roiKeypoints.get(match.trainIdx).pt;srcData.push(from.x,from.y);dstData.push(to.x,to.y)}srcPts=cv.matFromArray(selected.length,1,cv.CV_32FC2,srcData);dstPts=cv.matFromArray(selected.length,1,cv.CV_32FC2,dstData);inlierMask=new cv.Mat();H=cv.findHomography(srcPts,dstPts,cv.RANSAC,3.5,inlierMask);
    let inliers=0;for(let i=0;i<inlierMask.rows;i++)inliers+=inlierMask.ucharPtr(i,0)[0]?1:0;const inlierRatio=inliers/selected.length;if(H.empty()||inliers<9||inlierRatio<.34)throw Error('низкая точность');
    const player=applyHomography(H,TRACK_POINT.x,TRACK_POINT.y),north=applyHomography(H,TRACK_POINT.x,TRACK_POINT.y-48),detected={x:player.x+roiOrigin.x,y:player.y+roiOrigin.y};if(detected.x<0||detected.x>MAP_W||detected.y<0||detected.y>MAP_H)throw Error('точка вне карты');
    const jump=distance(detected,targetPoint),elapsed=Math.min(3,Math.max(0,(Date.now()-lastGoodMatch)/1000)),maxJump=trackingAcquired?70+elapsed*35:230;if(jump>maxJump)throw Error(`ложный скачок ${Math.round(jump)} px`);
    const correction=trackingAcquired ? .42 : .72;targetPoint={x:targetPoint.x*(1-correction)+detected.x*correction,y:targetPoint.y*(1-correction)+detected.y*correction};targetHeading=Math.atan2(north.x-player.x,-(north.y-player.y))*180/Math.PI;trackingAcquired=true;lastGoodMatch=Date.now();statusEl.textContent=`Слежение: ${inliers}/${selected.length} · ошибка ${Math.round(jump)} px`;arrow.classList.remove('lost');
  }catch(error){if(Date.now()-lastGoodMatch>2500){statusEl.textContent=`Позиция удерживается: ${error.message}`;arrow.classList.add('lost')}}finally{for(const item of [src,gray,keypoints,descriptors,emptyMask,matches,srcPts,dstPts,inlierMask,H])item?.delete?.();matchBusy=false}
}

function setCalibrationMode(value){calibrationMode=value;document.body.classList.toggle('calibrating',value);panelVisible=!value;panel.classList.toggle('hidden',!panelVisible);arrow.hidden=value;statusEl.textContent=value?'Кликните по своему месту на полной карте':'Калибровка сохранена'}
canvas.addEventListener('click',event=>{if(!calibrationMode||!calibrationViewport)return;const px=event.offsetX*(canvas.width/canvas.clientWidth),py=event.offsetY*(canvas.height/canvas.clientHeight),view=calibrationViewport;if(px<view.x||px>view.x+view.w||py<view.y||py>view.y+view.h)return;const selected={x:(px-view.x)/view.w*MAP_W,y:(py-view.y)/view.h*MAP_H},withoutUser=baseWorldToMap(coords.x,coords.y);userCorrection={x:selected.x-withoutUser.x,y:selected.y-withoutUser.y};localStorage.setItem('ad-atlas-calibration-v3',JSON.stringify(userCorrection));targetPoint=worldToMap(coords.x,coords.y);displayPoint={...targetPoint};trackingAcquired=false;clearLocalIndex();setCalibrationMode(false)});
mapImage.onload=()=>{mapReady=true;resizeCanvas();initMatcher()};window.addEventListener('resize',resizeCanvas);window.addEventListener('opencv-ready',()=>{cvReady=true;initMatcher()});setInterval(()=>{if(window.cv?.Mat&&!cvReady){cvReady=true;initMatcher()}},500);
window.atlas.onCoordinates(value=>updateCoordinates(value));window.atlas.onLockState(locked=>{document.getElementById('lockButton').textContent=locked?'🔓 Разблокировать (F9)':'🔒 Закрепить поверх игры (F9)'});window.atlas.onTogglePanel(()=>{if(calibrationMode)setCalibrationMode(false);else{panelVisible=!panelVisible;panel.classList.toggle('hidden',!panelVisible)}});
document.getElementById('settingsButton').onclick=()=>{if(calibrationMode)setCalibrationMode(false);else{panelVisible=!panelVisible;panel.classList.toggle('hidden',!panelVisible)}};document.getElementById('zoom').oninput=event=>zoom=Number(event.target.value);document.getElementById('autoTrack').onchange=event=>autoTrack=event.target.checked;document.getElementById('calibrateButton').onclick=()=>setCalibrationMode(true);document.getElementById('resetCalibration').onclick=()=>{userCorrection={x:0,y:0};localStorage.removeItem('ad-atlas-calibration-v3');updateCoordinates(coords,'калибровка сброшена')};document.getElementById('lockButton').onclick=()=>window.atlas.setLock(true);document.getElementById('close').onclick=()=>window.atlas.close();document.getElementById('minimize').onclick=()=>window.atlas.minimize();
updateCoordinates(FIRST_POINT,'первая точка');requestAnimationFrame(animate);startCapture();
