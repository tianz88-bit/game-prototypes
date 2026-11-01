import assert from 'node:assert/strict';
import { i18nStub } from './lib-i18n-stub.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const buttons=new Map(), calls=[], copy=[];let shutdown,modalBack;
const source={input:{enabled:true},scene:{isPaused:()=>calls.includes('pause'),resume:()=>calls.push('resume'),start:()=>calls.push('start')},events:{emit:()=>calls.push('forfeit')}};
class Base {openSettings(){calls.push('settings');}constructor(){this.scene={bringToTop:()=>calls.push('top'),pause:()=>calls.push('pause'),get:()=>source,stop:()=>{calls.push('close');shutdown?.();}};this.events={once:(_,fn)=>shutdown=fn};this.registry={remove:()=>calls.push('clear')};this.children={removeAll:()=>buttons.clear()};const item={setDepth(){return this},setInteractive(){return this},setOrigin(){return this}};this.add={rectangle:()=>item,graphics:()=>({}),text:(_x,_y,label)=>{copy.push(label);return item;}};}openInputPopup(){calls.push('settings');}}
const mocks={'../ui/menuNav':{getNav:()=>({modalBack:(_anchor,back)=>modalBack=back})},'../i18n':i18nStub,'./MenuScene':{MenuScene:Base},'../render/pixelRatio':{applyCameraPixelRatio:()=>{},VIEW:{cx:422,cy:195,width:844,height:390},PIXEL_RATIO:1},'../ui/cartoonChrome':{cartoonPanel:()=>{}},'../ui/titleButton':{titleButton:(_s,_x,_y,_w,_h,label,fn)=>buttons.set(label,fn)},'../input/devices':{devices:{clear:()=>calls.push('inputClear')}}};
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/GameMenuScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>mocks[id]});
for(const multiplayer of [false,true]){
 calls.length=0;const menu=new exports.GameMenuScene();menu.create({source:multiplayer?'Match':'VsAI',multiplayer});
 assert.equal(calls[0],'top');assert.equal(calls.includes('pause'),!multiplayer);assert.equal(source.input.enabled,false);
 buttons.get('SETTINGS')();assert.ok(calls.includes('settings'));
 buttons.get('RETURN TO MAIN MENU')();assert.equal(copy.at(-1),multiplayer?i18nStub.t('pause.the_match_keeps_running_returning'):'Your current round will end.');assert.ok(!calls.includes('forfeit')&&!calls.includes('start'));
 buttons.get('CANCEL')();assert.ok(buttons.has('RESUME'));
 buttons.get('RETURN TO MAIN MENU')();buttons.get('RETURN')();
 assert.ok(calls.includes(multiplayer?'forfeit':'start'));assert.equal(source.input.enabled,true);assert.ok(!calls.includes('resume'),'confirmed exit must not resume a destroyed fight');
}
calls.length=0;const menu=new exports.GameMenuScene();menu.create({source:'Training',multiplayer:false});buttons.get('RETURN TO MAIN MENU')();assert.equal(copy.at(-1),'Your practice session will end.');buttons.get('CANCEL')();buttons.get('RESUME')();assert.ok(calls.includes('resume'));assert.equal(source.input.enabled,true);
calls.length=0;const survivalMenu=new exports.GameMenuScene();survivalMenu.create({source:'Survival',multiplayer:false});buttons.get('RETURN TO MAIN MENU')();modalBack();assert.ok(buttons.has('RESUME'),'B cancels confirmation');modalBack();assert.ok(calls.includes('resume'),'B resumes solo combat');
console.log('Menu: foreground overlay, solo pause/resume, live multiplayer, settings, cancel, confirmed forfeit, and input restoration passed');
// The remote end must finish a forfeited series even while a round splash is running.
const netCalls=[];class Scene {constructor(){this.events={};this.time={removeAllEvents:()=>netCalls.push('cancelTimers')};this.add={text:(_x,_y,label)=>{netCalls.push(label,'overlay');const t={setOrigin:()=>t,setDepth:()=>t};return t;}};}}
const matchExports={};const netMocks={'../i18n':i18nStub,'../portal/gameplay':{setGameplay(){},trackFightScene(){}},'../portal/analytics':{track(){}},phaser:{default:{Scene}},'./FightStage':{makeButton:()=>{}},'../ui/menuNav':{getNav:()=>({engage:()=>{}})},'../render/pixelRatio':{VIEW:{cx:422,cy:195},PIXEL_RATIO:1},'../ui/presentation':{startScreen:(_scene,_key,data)=>{netCalls.push('menu');if(data?.message)netCalls.push(data.message);}},'../sim/tune':{restoreTune:()=>{},TICK_RATE:60}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/MatchScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:matchExports,require:id=>netMocks[id]??{},performance:{}});
const match=new matchExports.MatchScene();match.showRating=async()=>{};match.stageReady=true;match.over=true;match.nextSeries={};match.cancelSplash=()=>netCalls.push('cancelSplash');match.waiting={setVisible:()=>{}};
match.opponentLeft(true);assert.ok(netCalls.includes('overlay'));assert.ok(netCalls.includes('cancelSplash'));assert.ok(netCalls.includes(i18nStub.t('match.victory_opponent_forfeited')));assert.equal(match.rematchLocal,false);assert.equal(match.advancing,true);
const count=netCalls.length;match.opponentLeft(false);assert.equal(netCalls.length,count);
netCalls.length=0;match.match={round:2,session:{forfeit:async()=>netCalls.push('forfeit'),leave:()=>netCalls.push('disconnect')}};await match.leave();assert.deepEqual(netCalls,['disconnect','menu'],'returning after an opponent departure must not report a voluntary quit');
netCalls.length=0;const active=new matchExports.MatchScene();active.match=match.match;active.over=false;await active.leave();assert.deepEqual(netCalls,['forfeit','disconnect','menu'],'leaving active combat reports own quit before disconnecting');
const once=netCalls.length;await active.leave();assert.equal(netCalls.length,once,'repeated exit must reuse the completed leave operation');
console.log('Online forfeit: between-round cancellation, opponent victory, duplicate disconnect protection and send-before-leave passed');

// Before stage creation, route the same departure message to Menu without drawing an overlay.
for(const forfeited of [false,true]) {
 netCalls.length=0;const early=new matchExports.MatchScene();early.over=true;early.stageReady=false;early.opponentLeft(forfeited);
 assert.ok(netCalls.includes('menu'));assert.ok(netCalls.includes(i18nStub.t(forfeited?'match.victory_opponent_forfeited':'match.victory_opponent_disconnected')));assert.ok(!netCalls.includes('overlay'));
 const before=netCalls.length;early.opponentLeft(forfeited);assert.equal(netCalls.length,before);
}
console.log('Pre-stage departure: Menu message, no overlay, duplicate disconnect protection passed');
