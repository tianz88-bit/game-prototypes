import {punchFist} from './fistPath.js';
export const combatTune={moveSpeed:135,holdMs:180,flickMs:160,dodgeMs:180,invulMs:110,dodgePenaltyMs:620,perfectMs:100,rearmMs:100,guardFactor:.35,guardRaiseMs:250,chargeMs:1000,chargeBonus:.5};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class CombatModel{
 constructor(project){this.project=project;this.reset();}
 reset(){this.time=0;this.events=[];this.player=this.actor(390,355,0);this.dummy=this.actor(510,355,Math.PI);this.dummy.fixed=true;this.mode='passive';this.track=true;this.nextDummy=1400;this.hits=0;this.dealt=0;this.received=0;this.perfects=0;this.dodges=0;this.lastMove=false;this.moveStart=0;this.moveDir=0;this.neutralSince=0;this.pgUntil=0;this.hookUntil=0;this.queueUntil=0;this.pressAt=null;this.attackHeld=false;this.aimedPress=false;this.aimAngle=0;this.lastType='';this.repeats=0;this.lastAttack=-9999;this.notice='Tap Attack to jab. Hold and drag to aim a cross.';}
 actor(x,y,angle){return{x,y,angle,hp:100,stars:0,guard:false,guardReadyAt:0,aiming:false,attack:null,stunUntil:0,dodgeUntil:0,invulUntil:0,penaltyUntil:0,vx:0,vy:0};}
 emit(type,data={}){this.events.push({type,time:this.time,...data});this.notice=data.text||this.notice;}
 press(){if(this.attackHeld)return;this.attackHeld=true;this.pressAt=this.time;this.aimedPress=false;this.aimAngle=this.player.angle;this.player.guard=false;this.emit('press',{text:'Attack pressed'});}
 aim(angle,explicit=false){this.aimAngle=angle;if(explicit)this.aimedPress=true;}
 charge(){return this.attackHeld?Math.max(0,Math.min(1,(this.time-this.pressAt-combatTune.holdMs)/combatTune.chargeMs)):0;}
 release(cancel=false){if(!this.attackHeld)return;const held=this.time-this.pressAt,charge=this.charge(),aimed=this.aimedPress;this.attackHeld=false;this.pressAt=null;this.player.aiming=false;if(cancel)return;const type=held>=combatTune.holdMs||aimed?'cross':this.time<this.hookUntil?'hook':'jab';if(!this.startAttack(this.player,type,type==='cross'?this.aimAngle:this.player.angle,charge)&&['jab','hook'].includes(type)){this.queueUntil=this.time+320;this.queuedType=type;}}
 super(){if(this.player.stars<3){this.emit('empty',{text:'Super needs 3 stars.'});return;}if(this.startAttack(this.player,'upper',this.player.angle)){this.player.stars=0;this.release(true);}}
 startAttack(actor,type,angle,charge=0){if(actor.attack||this.time<actor.stunUntil||this.time<actor.dodgeUntil||this.time<actor.penaltyUntil&&type==='upper')return false;
  if(actor===this.player&&type==='jab'){
   const dx=this.dummy.x-actor.x,dy=this.dummy.y-actor.y,aim=Math.atan2(dy,dx),delta=wrap(aim-angle);
   if(Math.abs(delta)<Math.PI/6&&Math.hypot(dx,dy)<180)angle+=delta*.65;
  }
  if(actor===this.player){this.repeats=type===this.lastType&&this.time-this.lastAttack<1200?Math.min(4,this.repeats+1):0;this.lastType=type;this.lastAttack=this.time;}
  const spec=type==='jab'?{startup:6,recovery:11,damage:8,reach:42}:type==='cross'?{startup:12,recovery:16,damage:14,reach:48}:type==='hook'?{startup:10,recovery:16,damage:12,reach:39}:{startup:16,recovery:22,damage:25,reach:47};
  if(type==='cross')spec.damage*=1+Math.max(0,Math.min(1,charge))*combatTune.chargeBonus;
  actor.guardReadyAt=this.time+(spec.startup+8+spec.recovery)*16.6667+combatTune.guardRaiseMs;
  if(actor===this.player)this.pgUntil=0;
  actor.angle=angle;actor.guard=false;actor.aiming=false;actor.attack={type,angle,charge,hand:type==='cross'?1:0,frame:0,sourEarly:2,sweet:3,sour:3,...spec,reach:spec.reach*2.64,started:this.time,hit:false,fatigue:actor===this.player?Math.pow(.88,this.repeats):1};
  if(type==='hook')this.hookUntil=0;this.emit('swing',{text:(actor===this.player?'Marco: ':'Dummy: ')+type});return true;
 }
 step(dt,input={x:0,y:0}){dt=Math.min(dt,34);this.time+=dt;const p=this.player,d=this.dummy,t=this.time;const prev={x:p.x,y:p.y};
  const amount=Math.hypot(input.x,input.y),moving=amount>.2,canMove=t>=p.stunUntil;
  if(moving&&!this.lastMove){this.moveStart=t;this.moveDir=Math.atan2(input.y,input.x);this.pgUntil=0;}
  if(moving)this.moveDir=Math.atan2(input.y,input.x);
  if(!moving&&this.lastMove){const held=t-this.moveStart;
   if(held<=combatTune.flickMs&&t>=p.penaltyUntil&&!p.attack&&t>=p.stunUntil){if(this.attackHeld){this.release(true);this.queueUntil=0;}p.dodgeAngle=this.moveDir;p.dodgeUntil=t+combatTune.dodgeMs;p.invulUntil=t+combatTune.invulMs;p.penaltyUntil=t+combatTune.dodgePenaltyMs;p.guard=false;this.pgUntil=0;this.emit('dodge',{text:'Directional dodge'});}
   else if(held>=combatTune.rearmMs&&t>=p.guardReadyAt&&t>=p.penaltyUntil&&!p.attack&&!this.attackHeld&&t>=p.stunUntil)this.pgUntil=t+combatTune.perfectMs;
   this.neutralSince=t;
  }
  this.lastMove=moving;
  if(t<p.dodgeUntil){p.x+=Math.cos(p.dodgeAngle)*310*dt/1000;p.y+=Math.sin(p.dodgeAngle)*310*dt/1000;}
  else if(moving&&canMove){const speed=combatTune.moveSpeed*(t<p.penaltyUntil?.4:1)*(p.aiming?.65:1),factor=Math.min(1,amount)/amount;p.x+=input.x*factor*speed*dt/1000;p.y+=input.y*factor*speed*dt/1000;if(!this.attackHeld&&!p.attack)p.angle=this.moveDir;}
  if(this.attackHeld&&t-this.pressAt>=combatTune.holdMs&&t>=p.stunUntil){p.aiming=true;if(!p.attack)p.angle=this.aimAngle;}
  if(p.attack)p.angle=p.attack.angle;
  p.guard=t>=p.guardReadyAt&&!moving&&!p.attack&&!this.attackHeld&&!p.aiming&&t>=p.penaltyUntil&&t>=p.stunUntil;
  p.x=Math.max(85,Math.min(815,p.x));p.y=Math.max(175,Math.min(475,p.y));
  // Solid bodies prevent walking through the stationary target.
  const dx=p.x-d.x,dy=p.y-d.y,dist=Math.hypot(dx,dy),min=62;if(dist<min){const nx=dist>.001?dx/dist:-1,ny=dist>.001?dy/dist:0;p.x=d.x+nx*min;p.y=d.y+ny*min;}
  p.vx=(p.x-prev.x)*1000/dt;p.vy=(p.y-prev.y)*1000/dt;
  if(this.track&&!d.attack&&t>=d.stunUntil)d.angle=Math.atan2(p.y-d.y,p.x-d.x);
  d.guard=t>=d.guardReadyAt&&this.mode==='guard'&&!d.attack&&t>=d.stunUntil;
  if(['jab','cross','mixed'].includes(this.mode)&&t>=this.nextDummy&&!d.attack&&t>=d.stunUntil){const type=this.mode==='mixed'?(Math.floor(t/1600)%2?'jab':'cross'):this.mode;this.startAttack(d,type,d.angle);if(d.attack)d.attack.startup+=22;this.nextDummy=t+1900;this.emit('tell',{actor:d,text:'Dummy winding up — release movement to parry, or flick away.'});}
  for(const actor of[p,d]){const a=actor.attack;if(!a)continue;a.frame=(t-a.started)/16.6667;const end=a.startup+a.sourEarly+a.sweet+a.sour;if(!a.hit&&a.frame>=a.startup&&a.frame<end)this.tryHit(actor,actor===p?d:p,a);if(actor.attack===a&&a.frame>=end+a.recovery){actor.attack=null;actor.guardReadyAt=Math.max(actor.guardReadyAt,t+combatTune.guardRaiseMs);if(!a.hit&&actor===p)this.emit('miss',{text:a.type+' missed — move closer or adjust facing.'});}}
  if(this.queueUntil>t&&!p.attack&&!this.attackHeld){this.queueUntil=0;this.startAttack(p,this.queuedType==='hook'&&t<this.hookUntil?'hook':'jab',p.angle);}
 }
 tryHit(attacker,target,a){const pose=this.project(attacker),hurt=this.project(target),tip=punchFist({x:0,y:0,fx:Math.cos(a.angle??attacker.angle),fy:Math.sin(a.angle??attacker.angle)},a,2.64),fist={x:pose.x+tip.x,y:pose.y+tip.y};
  const contact=Math.hypot(fist.x-hurt.x,fist.y-hurt.y)<hurt.radius+13;if(!contact)return;a.hit=true;
  if(this.time<target.invulUntil){if(target===this.player)this.dodges++;this.emit('evade',{target,x:fist.x,y:fist.y,text:'Dodged'});return;}
  const interrupted=target===this.player&&this.attackHeld;if(interrupted){this.release(true);this.queueUntil=0;this.emit('chargeCancel',{target,x:fist.x,y:fist.y});}
  const incoming=Math.atan2(attacker.y-target.y,attacker.x-target.x),front=Math.abs(wrap(incoming-target.angle))<Math.PI*.38;
  if(target.guard&&front&&target===this.player&&this.time<this.pgUntil){attacker.attack=null;attacker.stunUntil=this.time+500;this.pgUntil=0;this.perfects++;this.emit('perfect',{target,x:fist.x,y:fist.y,text:'Perfect Guard — counter now!'});return;}
  const blocked=target.guard&&front&&a.type!=='hook'&&a.type!=='upper',damage=a.damage*a.fatigue*(blocked?combatTune.guardFactor:1);target.hp=Math.max(0,target.hp-damage);
  if(attacker===this.player){this.dealt+=damage;if(!blocked){this.hits++;this.player.stars=Math.min(3,this.player.stars+1);}else if(a.type==='jab'){this.hookUntil=this.time+750;}}
  else this.received+=damage;
  if(!blocked){target.attack=null;target.stunUntil=this.time+140;}
  this.emit(blocked?'block':'hit',{target,x:fist.x,y:fist.y,damage,text:interrupted?'Charge interrupted — hit taken.':blocked?(attacker===this.player?'Guarded — tap again for a hook.':'Guard reduced damage.'):a.type==='hook'?'Hook opened the guard.':a.type==='upper'?'Rising Upper!':a.type==='cross'?'Cross connected.':'Jab connected.'});
  // Dummy is immortal; zero health remains zero until Reset.
 }
}
