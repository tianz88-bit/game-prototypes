import Phaser from 'phaser';
import {draft,mountDraft,mountStats,remember,download,message} from './draft';
import {advancePreview,resetPreview} from './preview';
import {TiltFFD} from './ffd.mjs';
import {flightSeed,advanceFlight,recoilPose} from './flight-motion.mjs';

import {drawDepth,layerBrightness} from './depth-effects.mjs';
import {modules,directions,seed,validate,pose,sector,blendOffsets,stackOffset,depth} from './rig.mjs';
const $=s=>document.querySelector(s),P=Phaser,DPR=Math.min(window.devicePixelRatio||1,2);
mountDraft();mountStats();
const initialCalibration=structuredClone(draft.calibration);
let calibration=draft.calibration,selected='canopy',direction='up',angle=0,spinning=false,lastAngle=0,recoilAt=-1e6,dirty=0,saveTimer,saveQueue=Promise.resolve(),shadowDirty=true;
const assets=[...new Set(modules.map(m=>m.asset))];
let flight=flightSeed();const heldKeys=new Set(),heldActions=new Map(),flightPulses=new Map();
const keyActions={w:'accelerate',ArrowUp:'accelerate',s:'brake',ArrowDown:'brake',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'};
const editing=e=>e.target.matches('input,select,textarea')||e.target.isContentEditable;
const inputKey=e=>e.key.length===1?e.key.toLowerCase():e.key;
window.addEventListener('keydown',e=>{if(editing(e)||e.ctrlKey||e.metaKey||e.altKey)return;const key=inputKey(e);if(keyActions[key]||e.code==='Space'){e.preventDefault();if(e.code==='Space'){if(!e.repeat)$('#fire').click();}else heldKeys.add(key);}});
window.addEventListener('keyup',e=>heldKeys.delete(inputKey(e)));
window.addEventListener('blur',()=>{heldKeys.clear();heldActions.clear();flightPulses.clear();});
for(const b of document.querySelectorAll('[data-flight]')){
 b.onpointerdown=e=>{e.preventDefault();b.dataset.pressedAt=e.timeStamp;b.setPointerCapture(e.pointerId);heldActions.set(e.pointerId,b.dataset.flight);};
 b.onpointerup=b.onpointercancel=e=>heldActions.delete(e.pointerId);
 b.onlostpointercapture=e=>heldActions.delete(e.pointerId);
 b.onclick=e=>{if(!b.dataset.pressedAt||e.timeStamp-Number(b.dataset.pressedAt)<180)flightPulses.set(b.dataset.flight,performance.now()+900);};
}
const flightInput=()=>Object.fromEntries(['accelerate','brake','left','right'].map(action=>[action,[...heldKeys].some(k=>keyActions[k]===action)||[...heldActions.values()].includes(action)||(flightPulses.get(action)||0)>performance.now()]));
const assetUrl=id=>new URL('ship-art/human-nomad-v1-'+id+'.png',location.href).href;
for(const m of modules){const o=document.createElement('option');o.value=m.id;o.textContent=m.label;$('#module').append(o);}$('#module').value=selected;
for(const id of assets){const f=document.createElement('figure');const img=new Image();img.src=assetUrl(id);img.alt=id;const cap=document.createElement('figcaption');cap.textContent=id;f.append(img,cap);$('#parts').append(f);}
function controls(){const m=modules.find(m=>m.id===selected),entry=calibration.modules[selected],off=entry.offsets[direction];$('#offsetX').value=$('#xRange').value=+off.x.toFixed(2);$('#offsetY').value=$('#yRange').value=-Number(off.y.toFixed(2));$('#orderZ').value=entry.order['up'];$('#zLabel').textContent='Fixed Z order';$('#width').value=entry.width;$('#shadowX').value=calibration.shadow.x;$('#shadowY').value=calibration.shadow.y;$('#hoverLift').value=calibration.hoverLift;document.querySelectorAll('[data-dir]').forEach(b=>b.classList.toggle('active',b.dataset.dir===direction));}
function setHeading(a){angle=a;$('#heading').value=a;$('#angleValue').textContent=a.toFixed(1)+'°';}
function levelRotation(){flight.pitch=0;flight.bank=0;flightPulses.clear();$('#manualTilt').checked=false;$('#tiltDemo').checked=false;}
function save(){draft.calibration=calibration;remember();return Promise.resolve();}
function changed(){dirty++;$('#saveStatus').textContent='Unsaved browser draft…';clearTimeout(saveTimer);saveTimer=setTimeout(save,600);}
$('#module').onchange=e=>{selected=e.target.value;controls();};
document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>{levelRotation();direction=b.dataset.dir;spinning=false;$('#spin').textContent='Auto rotate';setHeading(directions.indexOf(direction)*90);controls();});
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{levelRotation();spinning=false;$('#spin').textContent='Auto rotate';setHeading(+b.dataset.angle);direction=directions[sector(angle)];controls();});
$('#heading').oninput=e=>{levelRotation();spinning=false;$('#spin').textContent='Auto rotate';setHeading(+e.target.value);};
$('#spin').onclick=()=>{levelRotation();spinning=!spinning;$('#spin').textContent=spinning?'Pause rotation':'Auto rotate';};
for(const [selector,axis,other]of [['#offsetX','x','#xRange'],['#xRange','x','#offsetX'],['#offsetY','y','#yRange'],['#yRange','y','#offsetY']])$(selector).oninput=e=>{const n=+e.target.value;if(!Number.isFinite(n)||Math.abs(n)>100)return;calibration.modules[selected].offsets[direction][axis]=axis==='y'?-n:n;$(other).value=n;changed();};
$('#orderZ').oninput=e=>{const n=+e.target.value;if(!Number.isFinite(n)||Math.abs(n)>100)return;const m=modules.find(m=>m.id===selected);for(const d of directions)calibration.modules[selected].order[d]=n;changed();};
$('#width').oninput=e=>{const n=+e.target.value;if(n>=12&&n<=300){calibration.modules[selected].width=n;shadowDirty=true;changed();}};
$('#resetPart').onclick=()=>{calibration.modules[selected]=structuredClone(initialCalibration.modules[selected]);shadowDirty=true;controls();changed();};
for(const axis of ['X','Y'])$('#shadow'+axis).oninput=e=>{const n=+e.target.value;if(Number.isFinite(n)&&Math.abs(n)<=100){calibration.shadow[axis.toLowerCase()]=n;changed();}};
$('#hoverLift').oninput=e=>{const n=+e.target.value;if(Number.isFinite(n)&&n>=0&&n<=100){calibration.hoverLift=n;changed();}};
$('#save').onclick=save;$('#export').onclick=()=>{draft.calibration=calibration;download(draft,'steroids-alpha-settings.json');};
$('#zoom').oninput=e=>$('#sizeValue').textContent=e.target.value+'%';
window.addEventListener('lab-config',()=>{calibration=draft.calibration;shadowDirty=true;resetPreview();controls();mountStats();});
window.addEventListener('lab-stats',()=>{const t=draft.tune;$('#statSummary').textContent=`Hull ${t.ship.maxHp} · ${(t.net.tickHz/t.weapon.fireIntervalSteps).toFixed(2)} shots/s · ${(t.weapon.damage*t.net.tickHz/t.weapon.fireIntervalSteps).toFixed(1)} damage/s`;});
$('#gameSize').onclick=()=>{$('#zoom').value=draft.clientTune.render.shipScale*100;$('#sizeValue').textContent=$('#zoom').value+'%';};
controls();
for(const button of document.querySelectorAll('[data-tilt]'))button.onclick=()=>{
 const [p,b]=button.dataset.tilt.split(',').map(Number);
 $('#pitch').value=p;$('#bank').value=b;$('#tiltDemo').checked=false;$('#ffd').checked=true;$('#manualTilt').checked=true;
};
for(const id of ['pitch','bank'])$('#'+id).oninput=()=>{$('#manualTilt').checked=true;$('#tiltDemo').checked=false;};
$('#tiltDemo').onchange=()=>{if($('#tiltDemo').checked)$('#manualTilt').checked=true;};
$('#resetFlight').onclick=()=>{heldActions.clear();heldKeys.clear();flightPulses.clear();flight=flightSeed();resetPreview();$('#manualTilt').checked=false;$('#tiltDemo').checked=false;};
function trimFrame(texture){
 const source=texture.getSourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let left=canvas.width,top=canvas.height,right=0,bottom=0;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<=left||bottom<=top)throw Error('Empty module texture');
 // Crop frame metadata only. Source pixels and originals remain unchanged.
 texture.add('part',0,left,top,right-left+1,bottom-top+1);
}
class RotationLab extends P.Scene{
 constructor(){super('nomad');}
 preload(){for(const id of assets)this.load.image(id,assetUrl(id));this.load.on('loaderror',file=>{$('#error').textContent='Asset failed to load: '+file.key;});}
 create(){try{
 for(const id of assets)trimFrame(this.textures.get(id));
 this.grid=this.add.graphics().setDepth(-30);this.guides=this.add.graphics().setDepth(150);this.sprites=new Map();
 for(const m of modules){const s=this.add.image(0,0,m.asset,'part');if(m.mirror)s.setFlipX(true);s.setInteractive({useHandCursor:true});s.on('pointerdown',()=>{selected=m.id;$('#module').value=m.id;controls();});this.sprites.set(m.id,s);}
 this.caption=this.add.text(24,24,'UP / 0°',{fontFamily:'Arial',fontSize:13,color:'#c8d9df',resolution:Math.min(devicePixelRatio,2)}).setDepth(200);
 this.scaleText=this.add.text(24,510,'',{fontFamily:'Arial',fontSize:12,color:'#8aa4b3',resolution:Math.min(devicePixelRatio,2)}).setDepth(200);
 $('#fire').onclick=()=>{recoilAt=this.time.now;};
 this.shadowTexture=this.textures.createCanvas('ground-shadow',1024,1024);this.groundShadow=this.add.image(0,0,'ground-shadow').setDepth(-20);
 this.cameras.main.setZoom(DPR).centerOn(450,270);

 this.ffd=new TiltFFD(this,modules);
 this.ready=true;$('#selfcheck').textContent=assets.length+' textures · '+modules.length+' independently layered parts · ground shadow';
 }catch(e){$('#error').textContent=e.message;console.error(e);}}
 rebuildShadow(){
 // Cache a hard-edged union of module footprints at ground height; no blur pass.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');
 for(const m of modules){const sprite=this.sprites.get(m.id),f=this.ffd.parts.get(m.id).originalFrame,w=calibration.modules[m.id].width,h=w*f.cutHeight/f.cutWidth;ctx.save();ctx.translate(512+m.x,512+m.y);if(m.mirror)ctx.scale(-1,1);ctx.drawImage(this.textures.get(this.ffd.parts.get(m.id).originalTexture).getSourceImage(),f.cutX,f.cutY,f.cutWidth,f.cutHeight,-w/2,-h/2,w,h);ctx.restore();}
 ctx.globalCompositeOperation='source-in';ctx.fillStyle='#01060c';ctx.fillRect(0,0,1024,1024);
 const target=this.shadowTexture.context;target.clearRect(0,0,1024,1024);target.drawImage(canvas,0,0);this.shadowTexture.refresh();shadowDirty=false;
 }
 update(time,delta){if(!this.ready)return;
 const input=flightInput();flight=advancePreview(angle,input,delta/1000);
 if(Object.values(input).some(Boolean)){spinning=false;$('#spin').textContent='Auto rotate';$('#manualTilt').checked=false;$('#tiltDemo').checked=false;}
 if(flight.yawDelta)setHeading((angle+flight.yawDelta+360)%360);
 if(spinning)setHeading((angle+Math.min(delta,50)*.018)%360);
 const turn=Math.max(-1,Math.min(1,(((angle-lastAngle+540)%360)-180)/Math.max(1,delta)*20));lastAngle=angle;
 const scale=+$('#zoom').value/100,motion=$('#motion').checked?1:0,explode=$('#explode').checked?1:0,anchors=$('#anchors').checked,flat=$('#flat').checked;
 const hover=flat?0:calibration.hoverLift;
 const amount=+$('#ffdStrength').value/100,demo=$('#tiltDemo').checked,manual=$('#manualTilt').checked;
 const pitch=(manual?(demo?Math.sin(time*.0006)*24:+$('#pitch').value):flight.pitch)*amount,bank=(manual?(demo?Math.sin(time*.00043+1)*26:+$('#bank').value):flight.bank)*amount;
 const ffdOn=$('#ffd').checked&&!flat&&!explode&&Math.abs(pitch)+Math.abs(bank)>.05;
 $('#tiltStatus').textContent=`${manual?'Manual tilt':'Flight controls'} · speed ${flight.speed.toFixed(0)}\n${ffdOn?`Pitch ${pitch.toFixed(1)}° · bank ${bank.toFixed(1)}°`:'Level · original sprites'}`;
 const cx=450,cy=273,grid=this.grid;grid.clear();grid.lineStyle(1,0x2c4350,.42);for(let x=0;x<=900;x+=40)grid.lineBetween(x,0,x,540);for(let y=0;y<=540;y+=40)grid.lineBetween(0,y,900,y);grid.lineStyle(1,0x718996,.35);grid.strokeCircle(cx,cy,220);grid.lineBetween(cx-230,cy,cx+230,cy);grid.lineBetween(cx,cy-230,cx,cy+230);
 if(shadowDirty)this.rebuildShadow();this.groundShadow.setPosition(cx+calibration.shadow.x*scale,cy+calibration.shadow.y*scale).setScale(scale).setRotation(angle*Math.PI/180).setAlpha(calibration.shadow.opacity).setVisible($('#shadow').checked&&!explode);
 const guides=this.guides;guides.clear();
 for(const m of modules){const dt=time-recoilAt-(m.side===1?80:0),kick=m.asset==='gun'?recoilPose(dt):{kick:0,scaleX:1,scaleY:1},recoil=kick.kick/7;
 const p=pose(m,angle,calibration,time,motion,turn,recoil),sprite=this.sprites.get(m.id),factor=calibration.modules[m.id].width/sprite.frame.width*scale;
 let x=p.x,y=p.y;if(flat){x-=p.accumulated.x;y-=p.accumulated.y;}if(explode){x*=1.5;y*=1.3;if(m.id==='cockpit')y-=60;if(m.id==='armour')x+=60;}
 sprite.setVisible(true).setPosition(cx+x*scale,cy+(y-hover)*scale).setRotation(p.rotation).setScale(factor).setDepth(flat?m.band:drawDepth(m,angle,calibration)).setAlpha(1);
 const shade=Math.round(255*(flat?1:layerBrightness(m,angle,calibration)));sprite.setTint((shade<<16)|(shade<<8)|shade);
 this.ffd.apply(m,sprite,p,calibration.modules[m.id].width,cx,cy-hover*scale,scale,pitch,bank,ffdOn,angle);
 sprite.setScale(sprite.scaleX*kick.scaleX,sprite.scaleY*kick.scaleY);
 if(anchors&&!explode&&!flat){const gx=cx+(p.x-p.accumulated.x)*scale,gy=cy+(p.y-p.accumulated.y-hover)*scale;guides.lineStyle(m.id===selected?2:1,m.id===selected?0xeabf7b:0x6d939e,.8);guides.lineBetween(gx,gy,gx,sprite.y);guides.lineBetween(gx,sprite.y,sprite.x,sprite.y);guides.strokeCircle(gx,gy,3);guides.strokeCircle(sprite.x,sprite.y,m.id===selected?6:2);}
 }
 const near=directions[sector(angle)],off=blendOffsets(angle,calibration.modules[selected].offsets);
 this.caption.setText(near.toUpperCase()+' / '+angle.toFixed(1)+'°'+(flat?' · FLAT COMPARISON':motion?' · MOTION ON':' · LAYERED POSE'));
 this.scaleText.setText(explode?'EXPLODED VIEW':`HOVER ${hover}px · FIXED Z · ${ffdOn?'FFD TILT ON':'FFD OFF'} · 3% BLACK / LAYER`); if(time-(this.lastReadout||0)>100){this.lastReadout=time;const m=modules.find(m=>m.id===selected),total=stackOffset(m,angle,calibration);$('#readout').textContent=`Live ${m.label}\nParent: ${m.parent||'ship origin'}\nOwn Y gap ${(-off.y).toFixed(2)} · total lift ${(-total.y).toFixed(2)}\nZ ${Math.floor(drawDepth(modules.find(m=>m.id===selected),angle,calibration))} · sector ${near}\nEditing ${direction} endpoint`;$('#depthStack').textContent=modules.slice().sort((a,b)=>drawDepth(a,angle,calibration)-drawDepth(b,angle,calibration)).map(m=>`${m.id===selected?'→':' '} ${String(Math.floor(drawDepth(m,angle,calibration))).padStart(3)} ${m.label}`).join('\n');}
 }
}
window.addEventListener('error',e=>{$('#error').textContent=e.message;});
new P.Game({type:P.AUTO,parent:'game',width:900*DPR,height:540*DPR,backgroundColor:'#121f2b',scale:{mode:P.Scale.FIT,autoCenter:P.Scale.CENTER_BOTH},render:{antialias:true},scene:RotationLab});
