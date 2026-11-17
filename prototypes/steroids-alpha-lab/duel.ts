import Phaser from 'phaser';
import {DuelModel,idle,DUEL_SCENARIO} from './duel-model';
import type {DuelStart,Handling} from './duel-model';
import {TUNE} from '../steroids-alpha/sim/tune';
import {shipRadius,topSpeed,maxShield} from '../steroids-alpha/sim/ship';
import {shipMotion} from '../steroids-alpha/sim/chassis';
import {wrapDelta} from '../steroids-alpha/sim/wrap';
import {intents} from '../steroids-alpha/src/input/intents';
import {DPR,logicalSize,placeContainer,refreshDpr,refreshSideways,sideways} from '../steroids-alpha/src/base';
import {clientTune} from '../steroids-alpha/src/clientTune';
import {applyServerConfig,configVersion} from '../steroids-alpha/src/liveConfig';
import {ShipView} from '../steroids-alpha/src/render/shipView';
import {queueShipArt,prepareShipArt,shipArtStatus} from '../steroids-alpha/src/render/shipArt';
import {PlanetGround,queueTerrain,prepareTerrain} from '../steroids-alpha/src/render/planetGround';
import {projectOffset} from '../steroids-alpha/src/render/planet';
import {CombatSprites,queueCombatArt,prepareCombatArt} from '../steroids-alpha/src/render/combatSprites';
import {CombatHud} from '../steroids-alpha/src/render/combatHud';
import {drawCombatImpact,drawRamAttack} from '../steroids-alpha/src/render/combatEffects';
import {flightControls} from '../steroids-alpha/src/render/hudLayout';
import {panel,controlFace,UI,css} from '../steroids-alpha/src/render/ui';
import {fitCamera,text} from '../steroids-alpha/src/scenes/common';

async function boot():Promise<void>{
// This entry has no NetClient, Room, account, draft publisher or WebSocket dependency.
document.title='Steroids-α · Combat duel lab';
document.body.innerHTML='<div id="app"></div>';
const style=document.createElement('style');style.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07101c}#app{position:fixed;overflow:hidden}canvas{display:block;touch-action:none}';document.head.appendChild(style);
const app=document.getElementById('app')!;placeContainer(app);
app.textContent='Loading combat lab…';app.style.color='#dfe8ff';
let baseline='Bundled baseline';
// Read-only live settings, once. A failed read leaves explicitly labelled bundled defaults.
const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),5000);
try{const r=await fetch('https://steroids-alpha-server.tianz-88.workers.dev/config',{signal:abort.signal,cache:'no-store'});if(r.ok){applyServerConfig(await r.json());baseline='Live settings '+configVersion;}}catch{}finally{clearTimeout(deadline);}

type Button={id:string;x:number;y:number;w:number;h:number};
class DuelScene extends Phaser.Scene{
 model!:DuelModel;start:DuelStart=new URLSearchParams(location.search).get('duel')==='circle'?'circle':'tail';handling:Handling='candidate';chassis=0;swap=false;
 state:'ready'|'running'|'paused'|'over'='ready';buttons:Button[]=[];acc=0;lastInput=idle();manual=false;mouseAtStart:{x:number;y:number}|null=null;
 private ground!:PlanetGround;private ships:ShipView[]=[];private sprites!:CombatSprites;private hud!:CombatHud;
 private modal!:Phaser.GameObjects.Graphics;private ui!:Phaser.GameObjects.Graphics;private fx!:Phaser.GameObjects.Graphics;private words:Phaser.GameObjects.Text[]=[];private wordUsed=0;
 private impacts:{x:number;y:number;at:number;kind:'shot'|'ram'|'nova'}[]=[];
 constructor(){super('duel');}
 preload(){fitCamera(this);this.load.setBaseURL(new URL('../steroids-alpha/',location.href).href);queueShipArt(this);queueTerrain(this);queueCombatArt(this);}
 create(){prepareShipArt(this);prepareTerrain(this);prepareCombatArt(this);this.ground=new PlanetGround(this,0);this.ui=this.add.graphics().setDepth(960);this.modal=this.add.graphics().setDepth(970);this.fx=this.add.graphics().setDepth(30);this.sprites=new CombatSprites(this);this.hud=new CombatHud(this);this.reset();this.game.events.on('dpr',()=>fitCamera(this));}
 reset(){this.ships.forEach(s=>s.destroy());this.model=new DuelModel(this.start,this.handling,this.chassis,this.swap,TUNE);this.ships=[new ShipView(this,true,this.chassis,0),new ShipView(this,false,this.chassis,1)];this.state='ready';this.manual=false;this.acc=0;this.impacts=[];intents.drainTaps();}
 private label(x:number,y:number,value:string,size=11,colour=css(UI.uiText),origin=.5,depth=962){let t=this.words[this.wordUsed++];if(!t){t=text(this,0,0,'',size).setDepth(962);this.words.push(t);}return t.setDepth(depth).setVisible(true).setPosition(x,y).setText(value).setFontSize(size).setColor(colour).setOrigin(origin,.5);}
 private button(id:string,x:number,y:number,w:number,label:string,on=false,front=false){const b={id,x,y,w,h:44};this.buttons.push(b);panel(front?this.modal:this.ui,x-w/2,y-22,w,44,on?UI.uiAccent:UI.uiBorder,on);this.label(x,y,label,11,css(UI.uiText),.5,front?972:962);}
 private action(id:string){
  if(id==='lab'){location.href=new URL('./',location.href).href;return;}
  if(id==='pause'&&this.state==='over'){this.reset();return;}
  if(id==='start'||id==='pause'){this.mouseAtStart=intents.mouse?{...intents.mouse}:null;this.state=this.state==='running'?'paused':'running';this.acc=0;return;}
  if(id==='tail'||id==='circle'){this.start=id;history.replaceState(null,'','?duel='+id);}
  if(id==='handling')this.handling=this.handling==='candidate'?'baseline':'candidate';
  if(id==='ship')this.chassis=(this.chassis+1)%4;
  if(id==='swap')this.swap=!this.swap;
  this.reset();
 }
 private step(){const p=this.model.pilots[0],i={...idle(),...intents.flight(p.speed),fire:intents.fire,dash:intents.consume('secondary')};if(intents.turn||intents.thrust||(intents.mouseSteering&&(!this.mouseAtStart||Math.hypot(intents.mouse!.x-this.mouseAtStart.x,intents.mouse!.y-this.mouseAtStart.y)>8))||intents.stick||i.fire||i.dash)this.manual=true;
  if(!this.manual){const cruise=shipMotion(this.chassis,this.model.tune).cruiseSpeed;i.aim=NaN;i.turn=this.start==='circle'?-1:0;i.thrust=Math.abs(p.speed-cruise)<DUEL_SCENARIO.cruiseDeadband?0:p.speed<cruise?1:-1;}this.lastInput=i;
  const e=this.model.step(i);for(const shot of e.shots)this.ships[shot.owner-1]?.fire(shot.side);
  for(const hit of e.hits){if(hit.shielded)this.ships[hit.id-1]?.shieldHit(0);this.impacts.push({x:hit.x,y:hit.y,at:this.time.now,kind:'shot'});}
  for(const ram of e.rams)this.impacts.push({x:ram.x,y:ram.y,at:this.time.now,kind:'ram'});
  for(const death of e.deaths)this.impacts.push({x:death.x,y:death.y,at:this.time.now,kind:'nova'});
  if(this.model.pilots.some(s=>s.hp<=0))this.state='over';
 }
 update(_time:number,delta:number){if(!this.model)return;
  if(intents.consume('pause')&&this.state!=='over'){this.state=this.state==='running'?'paused':'running';this.acc=0;}
  for(const tap of intents.drainTaps()){const b=this.buttons.find(b=>Math.abs(tap.x-b.x)<=b.w/2&&Math.abs(tap.y-b.y)<=b.h/2);if(b){this.action(b.id);break;}}
  if(this.state==='running'){this.acc+=Math.min(delta,100);const dt=1000/this.model.tune.net.tickHz;while(this.acc>=dt&&this.state==='running'){this.acc-=dt;this.step();}}
  else{this.acc=0;intents.consume('secondary');}
  this.draw();
 }
 private draw(){
  const {w,h}=logicalSize(),m=this.model,p=m.pilots[0],k=h/clientTune.render.referenceHeight,now=this.time.now;
  const project=(x:number,y:number)=>{const a=projectOffset(wrapDelta(x,p.x,m.tune.world.width),wrapDelta(y,p.y,m.tune.world.height),clientTune.render.planetRadius);return{...a,x:w/2+a.x*k,y:h/2+a.y*k,scale:a.scale*k};};
  this.ground.update(w,h,k,{camera:{x:p.x-m.tune.world.width/2,y:p.y-m.tune.world.height/2},sun:{x:-.55,y:-.35,z:.75},daylight:.95,brightness:.95});
  this.ui.clear();this.modal.clear();this.fx.clear();this.wordUsed=0;this.buttons=[];this.sprites.begin();
  m.pilots.forEach((s,i)=>{const at=project(s.x,s.y),radius=shipRadius(s.hullMax,m.tune,s.chassis);this.ships[i].update({...at,visible:at.visible&&s.hp>0,brightness:.95,shadowX:at.x+10*k,shadowY:at.y+15*k,shadowAlpha:.4},s.heading,now,s.speed,s.dashTime>0,i===0?this.lastInput:'observed',topSpeed(s.hullMax,m.tune,s.chassis));
   if(s.hp>0&&at.visible){this.label(at.x,at.y+(radius+40)*at.scale,i===0?'YOU':'SPARRING SHIP',10,i===0?'#aee8f0':'#ffb89c');if(i===1){const bw=64*k;this.fx.fillStyle(0x121c28,.9).fillRect(at.x-bw/2,at.y-(radius+22)*at.scale,bw,4);this.fx.fillStyle(0x83dbec,.8).fillRect(at.x-bw/2,at.y-(radius+22)*at.scale,bw*s.shield/maxShield(s,m.tune),2);this.fx.fillStyle(0xf3ba7c,.85).fillRect(at.x-bw/2,at.y-(radius+22)*at.scale+2,bw*s.hp/s.hullMax,2);}
    if(s.dashTime>0)drawRamAttack(this.fx,at,s.heading,radius*2, radius,now);
   }else if(i===1&&s.hp>0){const dx=wrapDelta(s.x,p.x,m.tune.world.width),dy=wrapDelta(s.y,p.y,m.tune.world.height),a=Math.atan2(dy,dx),r=Math.min(w,h)*.38;this.label(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r,'◆ OPPONENT',11,'#ffba9d');}
  });
  for(const b of m.bullets()){const at=project(b.x,b.y);if(at.visible)this.sprites.bullet(at,project(b.x-b.vx*.025,b.y-b.vy*.025),b.owner===1,false,0);}
  this.sprites.end();this.impacts=this.impacts.filter(f=>now-f.at<700).slice(-48);for(const f of this.impacts){const at=project(f.x,f.y);if(at.visible)drawCombatImpact(this.fx,at,(now-f.at)/700,f.kind,f.kind==='ram'?48:28,f.kind==='ram'?0xffa34e:0xc4eaff);}
  const radius=(shipRadius(p.hullMax,m.tune,p.chassis)+48)*k;
  this.hud.draw(this.ui,p,w,h,intents.touch,now,{x:w/2,y:h/2,radius,visible:p.hp>0},'none');
  // One compact two-row toolbar; no controls cover the touch steering/fire area below it.
  const width=Math.min(112,(w-32)/4),x=(i:number)=>w/2+(i-1.5)*(width+4);
  this.button('tail',x(0),30,width,'TAILED',this.start==='tail');this.button('circle',x(1),30,width,'CIRCLING',this.start==='circle');
  this.button('handling',x(2),30,width,this.handling==='candidate'?'CANDIDATE':'BASELINE',this.handling==='candidate');this.button('reset',x(3),30,width,'RESET');
  this.button('ship',x(0),78,width,['FALCON','BAT',w<600?'CRUISER':'BATTLECRUISER','SPARROW'][this.chassis]);this.button('swap',x(1),78,width,this.start==='tail'?(this.swap?'YOU CHASE':'YOU EVADE'):(this.swap?'SWAP: ON':'SWAP SIDES'));
  this.button('pause',x(2),78,width,this.state==='running'?'PAUSE':this.state==='over'?'NEW DUEL':'RESUME');this.button('lab',x(3),78,width,'BACK TO LAB');
  this.label(12,110,`LAB ONLY · ${this.handling==='candidate'?'stronger impacts / cruise turns':'unchanged live handling'}`,10,'#eac98c',0);
  this.label(12,125,this.manual?`${m.elapsed.toFixed(1)}s · rams ${m.ramHits} · bumps ${m.bumpHits}`:'Opening autopilot · steer to take control',10,'#b5cbd9',0);
  // CombatHud's economy box is intentionally covered by the lab toolbar; no buying/banking here.
  const t=clientTune.touch,c=flightControls(w,h,t.dashButtonMargin,t.dashButtonRadius,t.fireButtonRadius);
  if(intents.touch){intents.fireButton={x:c.fire.x,y:c.fire.y,hw:c.fire.hw,hh:c.fire.hh};intents.dashButton={x:c.dash.x,y:c.dash.y,hw:c.dash.hw,hh:c.dash.hh};controlFace(this.ui,c.fire.x,c.fire.y,c.fire.r,UI.uiDanger,intents.fire);this.label(c.fire.x,c.fire.y,'FIRE',11);controlFace(this.ui,c.dash.x,c.dash.y,c.dash.r,UI.uiAccent,p.dashCd<=0);this.label(c.dash.x,c.dash.y,'DASH',11);
   const st=intents.stick;if(st){this.ui.lineStyle(1,0xb3e2ef,.4).strokeCircle(st.ox,st.oy,clientTune.touch.joystickRadius);this.ui.fillStyle(0xc1e9ef,.4).fillCircle(st.ox+st.dx,st.oy+st.dy,14);}
  }
  intents.mouseOrigin={x:w/2,y:h/2};
  if(this.state!=='running'){
   const bh=Math.min(156,h-156),by=h/2+20,bw=Math.min(430,w-28);panel(this.modal,w/2-bw/2,by-bh/2,bw,bh,UI.uiAccent);
   const title=this.state==='over'?(p.hp<=0?'YOU WERE DESTROYED':'OPPONENT DESTROYED'):this.state==='paused'?'PAUSED':this.start==='tail'?(this.swap?'CATCH THE EVADER':'BREAK THE TAIL'):'BREAK THE CIRCLE';
   this.label(w/2,by-bh/2+22,title,16,css(UI.uiText),.5,972);if(bh>=140)this.label(w/2,by-bh/2+44,this.start==='tail'?'Change speed + turn. Dash to separate.':'Steer to break the loop. Change speed or dash across.',w<600?10:11,css(UI.uiText),.5,972);
   this.button(this.state==='over'?'reset':'start',w/2,by+bh/2-28,Math.min(200,bw-24),this.state==='over'?'TRY AGAIN':this.state==='paused'?'RESUME':'START DUEL',true,true);
  }
  if(h>=400)this.label(12,h-34,baseline,9,'#839bad',0);
  if(h>=400)this.label(12,h-18,intents.touch?'Drag left to steer · FIRE / DASH':'Mouse aim · W/S speed · A/D turn · Space fire · Shift dash · Esc pause',10,'#a2bacb',0);
  intents.uiZones=this.buttons.map(b=>({x:b.x,y:b.y,hw:b.w/2,hh:b.h/2}));
  for(let i=this.wordUsed;i<this.words.length;i++)this.words[i].setVisible(false);
 }
 snapshot(){return{start:this.start,handling:this.handling,state:this.state,chassis:this.chassis,swap:this.swap,manual:this.manual,baseline,art:shipArtStatus,sideways:sideways(),size:logicalSize(),controls:{fire:intents.fireButton,dash:intents.dashButton},buttons:this.buttons,pilots:this.model.pilots.map(s=>({...s})),tick:this.model.world.tick,bullets:this.model.bullets().length,ramHits:this.model.ramHits,bumpHits:this.model.bumpHits,children:this.children.length};}
}
app.textContent='';
const game=new Phaser.Game({type:Phaser.AUTO,parent:'app',width:Math.round(logicalSize().w*DPR),height:Math.round(logicalSize().h*DPR),backgroundColor:'#07101c',scale:{mode:Phaser.Scale.NONE,zoom:1/DPR},input:{mouse:false,touch:false,keyboard:false,gamepad:false},render:{antialias:true},scene:[DuelScene]});
game.events.once(Phaser.Core.Events.READY,()=>intents.attach(game.canvas));
window.addEventListener('resize',()=>{refreshDpr();refreshSideways();placeContainer(app);const{w,h}=logicalSize();game.scale.setZoom(1/DPR);game.scale.resize(Math.round(w*DPR),Math.round(h*DPR));game.events.emit('dpr');});
window.addEventListener('blur',()=>{const s=game.scene.getScene('duel') as DuelScene;if(s?.state==='running')s.state='paused';});
Object.assign(window,{__duel:{scene:()=>game.scene.getScene('duel') as DuelScene,snapshot:()=>(game.scene.getScene('duel') as DuelScene).snapshot()}});

}
void boot().catch(e=>{document.getElementById('app')!.textContent='Combat lab failed to load. Reload to retry.';console.error(e);});
