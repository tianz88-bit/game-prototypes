import assert from 'node:assert/strict';
import {CombatModel} from './combatModel.js';
const make=()=>new CombatModel(a=>({x:a.x,y:a.y,radius:29}));
const tick=(m,n,x=0,y=0)=>{for(let i=0;i<n;i++)m.step(1000/60,{x,y});};
let m=make();m.press();tick(m,5);m.release();assert.equal(m.player.attack.type,'jab');
m=make();m.press();tick(m,13);assert.equal(m.player.aiming,true);m.aim(Math.PI/2);m.release();assert.equal(m.player.attack.type,'cross');assert.equal(m.player.angle,Math.PI/2);
m=make();tick(m,5,1,0);tick(m,1);assert(m.player.dodgeUntil>m.time);assert(m.player.invulUntil>m.time);assert.equal(m.pgUntil,0);const until=m.player.dodgeUntil;tick(m,2,1,0);tick(m,1);assert.equal(m.player.dodgeUntil,until);
m=make();tick(m,14,1,0);tick(m,1);assert(m.pgUntil>m.time);assert(m.player.guard);tick(m,8);assert(m.pgUntil<m.time);assert(m.player.guard);
m=make();m.player.x=0;m.player.y=0;m.dummy.x=100;m.dummy.y=0;m.player.angle=0;m.player.guard=true;m.pgUntil=100;const jab={type:'jab',hand:0,frame:8,startup:6,sourEarly:2,sweet:3,sour:3,recovery:11,reach:110,damage:8,fatigue:1};m.dummy.angle=Math.PI;m.dummy.attack=jab;m.tryHit(m.dummy,m.player,jab);assert.equal(m.player.hp,100);assert.equal(m.perfects,1);assert(m.dummy.stunUntil>0);
m=make();m.player.x=0;m.player.y=0;m.dummy.x=100;m.dummy.y=0;m.dummy.angle=Math.PI;m.dummy.guard=true;const hit={...jab,hit:false};m.tryHit(m.player,m.dummy,hit);assert.equal(m.dummy.hp,97.2);assert(m.hookUntil>0);m.release(true);m.press();tick(m,2);m.release();assert.equal(m.player.attack.type,'hook');
m=make();m.player.x=0;m.player.y=0;m.dummy.x=100;m.dummy.y=0;m.dummy.angle=0;m.dummy.guard=true;m.tryHit(m.player,m.dummy,{...jab,hit:false});assert.equal(m.dummy.hp,92);
m=make();m.player.x=0;m.player.y=0;m.dummy.x=100;m.dummy.y=0;m.dummy.hp=1;m.tryHit(m.player,m.dummy,{...jab,hit:false});assert.equal(m.dummy.hp,0);tick(m,180);assert.equal(m.dummy.hp,0);assert.equal(m.dummy.x,100);
console.log('PASS: tap/hold, manual cross direction, flick invulnerability and penalty, guard rearming, Perfect Guard stagger, guarded jab → hook, rear bypass and immortal fixed dummy.');
// Punch recovery must not silently turn into immediate guard or Perfect Guard.
m=make();m.press();tick(m,3);m.release();while(m.player.attack)tick(m,1);assert.equal(m.player.guard,false);const recovered=m.time;tick(m,10);assert.equal(m.player.guard,false);assert.equal(m.pgUntil,0);tick(m,7);assert(m.time-recovered>=250);assert(m.player.guard);assert.equal(m.pgUntil,0);
// Repeating a punch during the guard delay remains responsive and extends it.
m=make();m.startAttack(m.player,'jab',0);while(m.player.attack)tick(m,1);const previousReady=m.player.guardReadyAt;assert(m.startAttack(m.player,'jab',0));assert(m.player.guardReadyAt>previousReady);
console.log('PASS: 250 ms post-punch guard delay; no recovery Perfect Guard; attacks remain available during downtime.');
import {PlantedFeet} from './plantedFeet.js';
const gait=new PlantedFeet({walkMs:115,settleMs:85,landGap:22.5,leadSeconds:.22});let feet;
const k=2.64,walking=t=>[{x:t*.135,y:-17,yaw:0},{x:t*.135,y:17,yaw:0}];
for(let time=0;time<=1200;time+=16.6667){feet=gait.update(walking(time),time,k,0,{x:135,y:0});assert(feet.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)));}
const stopped=[{x:162+24,y:-27,yaw:-.35},{x:162-18,y:27,yaw:.35}];for(let time=1200;time<=2600;time+=16.6667)feet=gait.update(stopped,time,k,0,{x:0,y:0});
for(let i=0;i<2;i++){assert(Math.hypot(feet[i].x-stopped[i].x,feet[i].y-stopped[i].y)<1.1*k);assert.equal(feet[i].lift,0);}
console.log('PASS: normal walking settles both feet into the stopped fighting stance.');
// Movement must continue during committed punches without steering their aim.
m=make();m.startAttack(m.player,'cross',Math.PI/4);const xBefore=m.player.x;tick(m,8,-1,0);assert(m.player.x<xBefore-10);assert.equal(m.player.angle,Math.PI/4);assert.equal(m.player.attack.angle,Math.PI/4);
// A short aimed flick is a cross, even before the hold threshold.
m=make();m.press();tick(m,2);m.aim(-Math.PI/2,true);m.release();assert.equal(m.player.attack.type,'cross');assert.equal(m.player.attack.angle,-Math.PI/2);assert.equal(m.player.attack.damage,14);
// Holding adds bounded power, locked in at release.
m=make();m.press();tick(m,80);m.release();assert.equal(m.player.attack.damage,21);assert.equal(m.player.attack.charge,1);
m=make();m.press();tick(m,40);m.release();assert(m.player.attack.damage>14&&m.player.attack.damage<21);
// An incoming connected hit cancels charging and a later release cannot fire.
m=make();m.player.x=200;m.player.y=300;m.dummy.x=300;m.dummy.y=300;m.dummy.angle=Math.PI;m.press();tick(m,15);assert(m.player.aiming);m.tryHit(m.dummy,m.player,{...jab,hit:false});assert.equal(m.attackHeld,false);assert.equal(m.player.aiming,false);m.release();assert.equal(m.player.attack,null);assert.equal(m.notice,'Charge interrupted — hit taken.');
// Stop, flick and return to neutral cancels charge into a dash, without a cross.
m=make();m.press();tick(m,15);tick(m,5,-1,0);tick(m,1);assert(m.player.dodgeUntil>m.time);assert.equal(m.attackHeld,false);assert.equal(m.player.aiming,false);m.release();assert.equal(m.player.attack,null);
console.log('PASS: movement during punches, committed aim, flick crosses, bounded charge damage, incoming-hit cancellation and dash cancellation.');
