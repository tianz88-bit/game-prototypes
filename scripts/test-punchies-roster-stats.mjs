import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './prototypes/punchies/src/sim/rosterStats';export * from './prototypes/punchies/src/sim/tune';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {statFill,rosterScores,rosterUppercut,STAT_RANGES,tune}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
try{
 for(const [key,[min,max]] of Object.entries(STAT_RANGES)){
  const floor=key==='power'?0:.4;near(statFill(key,min),floor);near(statFill(key,max),1);near(statFill(key,min-.1),floor);near(statFill(key,max+.1),1);
  let prior=floor;for(let i=0;i<=100;i++){const fill=statFill(key,min+(max-min)*i/100);assert(fill>=prior-1e-12);prior=fill;}
  if(key==='power')near(statFill(key,1),.6);else{const x=(1-min)/(max-min);near(statFill(key,1),.4+.6*Math.log1p(x)/Math.LN2);}
 }
 near(statFill('durability',.735),.4+.6*Math.log1p((.735-.65)/.7)/Math.LN2);
 near(statFill('power',1.05),.6+.4*.05/.3);
 const currentRoster=Object.keys(tune.characters);for(const id of currentRoster)for(const [key,score] of Object.entries(rosterScores(id)))if(key!=='power'){assert(statFill(key,score)>=.4&&statFill(key,score)<=1);}
 near(rosterScores('bruno').durability,1.215);near(rosterScores('mia').durability,.865);
 const original=structuredClone(tune.characters.marco);
 Object.assign(tune.characters.marco,{hp:1,stun:1,stamina:1,regen:1,speed:1});
 for(const type of ['jab','cross','hook'])Object.assign(tune.characters.marco[type],{damage:1,staminaCost:1,reach:1,startup:0,recovery:0});
 tune.body.proportions.marco=1;
 for(const score of Object.values(rosterScores('marco')))near(score,1);
 const before=rosterScores('marco');Object.assign(tune.characters.marco.uppercut,{damage:1.8,startup:9,recovery:20,staminaCost:2,reach:2,starRequirement:4});assert.deepEqual(rosterScores('marco'),before);
 tune.characters.marco=original;
 near(rosterUppercut('longan').damage,6);assert.equal(rosterUppercut('longan').stars,1);near(rosterUppercut('tyke').damage,48);assert.equal(rosterUppercut('tyke').stars,4);
 const old=rosterScores('mia').endurance;tune.characters.mia.stun=1.9;near(rosterScores('mia').endurance,old);
 console.log('PASS: fixed log ranges, 40–100% clamps, monotonicity, unchanged Power curve, durability weighting, neutral Base ratios and uppercut separation');
}catch(e){console.error(e.message);process.exitCode=1;}
