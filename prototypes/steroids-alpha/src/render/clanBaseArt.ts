import type Phaser from 'phaser';
import type { BaseLayout } from '../../sim/clanBase';
import { padUnder } from '../../sim/clanBase';
import type { ShipState } from '../../sim/ship';
import type { Tune } from '../../sim/tune';
import { wrapDelta } from '../../sim/wrap';
import type { BuildingRigs, BuildingRigPose } from './buildingRig';
import { clanArtColours } from './buildingMaterials';
export { CLAN_ART, clanArtColours } from './buildingMaterials';

/** Broad painted-metal planes, cream bevels and emissive insets follow the Nomad ships. */
type At={x:number;y:number;scale:number;visible:boolean};
type Point={x:number;y:number};
export interface ClanBaseArtOptions {
  layout:BaseLayout;
  own:ShipState|null;
  member:boolean;
  docked:boolean;
  now:number;
  tune:Tune;
  project:(x:number,y:number)=>At;
  aim:readonly number[];
  firedAt:readonly number[];
  /** Existing world impacts; only those on the dome perimeter are used. */
  impacts?:readonly {x:number;y:number;at:number}[];
  rigs?:BuildingRigs;
  sun?:{x:number;y:number;z:number};daylight?:number;brightness?:number;
}
export interface ClanBaseArtLabels { treasury:(At&{labelY?:number;top?:number})|null; gate:At|null; }

const hex=(x:number,y:number,r:number,turn=Math.PI/6):Point[]=>Array.from({length:6},(_,i)=>({x:x+Math.cos(turn+i*Math.PI/3)*r,y:y+Math.sin(turn+i*Math.PI/3)*r}));
const poly=(g:Phaser.GameObjects.Graphics,points:Point[],fill:number,stroke=0x0a1729,width=2):void=>{
  g.fillStyle(fill,1);g.fillPoints(points,true);g.lineStyle(width,stroke,1);g.strokePoints(points,true);
};
function ring(g:Phaser.GameObjects.Graphics,o:ClanBaseArtOptions,x:number,y:number,r:number,segments:number,dashed=false,lift=0):void {
  let prev:At|null=null;
  for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,q=o.project(x+Math.cos(a)*r,y+Math.sin(a)*r);
    if(prev?.visible&&q.visible&&(!dashed||i%3!==0))g.lineBetween(prev.x,prev.y-lift*prev.scale,q.x,q.y-lift*q.scale);
    prev=q;
  }
}
function shieldContact(g:Phaser.GameObjects.Graphics,at:At,colour:number,progress:number,push=false):void {
  if(!at.visible)return;
  const f=Math.max(0,1-progress),r=(12+progress*36)*at.scale;
  g.lineStyle(Math.max(1,2.5*at.scale),colour,f*.85);
  g.strokePoints(hex(at.x,at.y,r),true);
  g.lineStyle(Math.max(1,at.scale),0xffefcf,f);
  g.strokePoints(hex(at.x,at.y,r*.62),true);
  if(push){
    g.lineStyle(Math.max(1,2*at.scale),0xffe2ac,f);
    for(let i=0;i<3;i++){const x=at.x+(i-1)*8*at.scale;g.lineBetween(x-4*at.scale,at.y+10*at.scale,x,at.y+5*at.scale);g.lineBetween(x,at.y+5*at.scale,x+4*at.scale,at.y+10*at.scale);}
  }
}

/** World positions/radii are read directly from the existing layout and tune. No collision shapes. */
export function drawClanBase(g:Phaser.GameObjects.Graphics,o:ClanBaseArtOptions):ClanBaseArtLabels {
  const {layout,tune,project,now}=o,b=tune.base,c=clanArtColours(layout.clan);
  const centre=project(layout.treasury.x,layout.treasury.y);
  const labels:ClanBaseArtLabels={treasury:centre.visible?centre:null,gate:null};
  const rigPose=(id:string,x:number,y:number,at:At):BuildingRigPose=>{
    const qx=project(x+24,y),qy=project(x,y+24),dx=qx.x-at.x,dy=qx.y-at.y;
    const basisAngle=qx.visible?Math.atan2(dy,dx):0;
    const foreshorten=qx.visible&&qy.visible?Math.max(.55,Math.min(1.15,Math.hypot(qy.x-at.x,qy.y-at.y)/Math.max(.001,Math.hypot(dx,dy)))):1;
    return{id,at,clan:layout.clan,now,basisAngle,foreshorten,sun:o.sun,daylight:o.daylight,brightness:o.brightness,
      projectGround:(dx,dy)=>project(x+dx,y+dy)};
  };
  // A projected perimeter and two light latitude bands suggest a dome without a solid gameplay veil.
  g.lineStyle(2,c.glow,.42+.06*Math.sin(now/550));ring(g,o,layout.treasury.x,layout.treasury.y,b.domeRadius,72);
  g.lineStyle(1,0xe3f7e9,.24);ring(g,o,layout.treasury.x,layout.treasury.y,b.domeRadius-8,72,true);
  g.lineStyle(1,c.glow,.11);ring(g,o,layout.treasury.x,layout.treasury.y,b.domeRadius*.82,60,true,42);
  g.lineStyle(1,c.glow,.07);ring(g,o,layout.treasury.x,layout.treasury.y,b.domeRadius*.5,48,true,84);
  // Small emitters indicate the exact ground boundary, not a second boundary.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,q=project(layout.treasury.x+Math.cos(a)*b.domeRadius,layout.treasury.y+Math.sin(a)*b.domeRadius);
    if(!q.visible)continue;const k=q.scale;
    poly(g,hex(q.x,q.y,7*k),c.shade,0x101c31,Math.max(.7,k));
    g.fillStyle(c.glow,.8);g.fillRect(q.x-2*k,q.y-2*k,4*k,4*k);
  }
  const myPad=o.own&&o.member?padUnder(layout,o.own,tune):-1;
  layout.pads.forEach((pad,i)=>{
    const at=project(pad.x,pad.y);if(!at.visible)return;
    const r=b.padRadius,k=at.scale,lit=myPad===i,docked=lit&&o.docked;
    // Ground plates have the exact pad footprint; the lower edge supplies the Zelda-like bevel.
    const p=hex(at.x,at.y,r*k);
    poly(g,p,c.shade,0x101a2b,Math.max(1,3*k));
    poly(g,hex(at.x,at.y-3*k,(r-5)*k),c.dark,0x9b9697,Math.max(.8,1.6*k));
    g.lineStyle(Math.max(1,3*k),lit?(docked?0xd5ffc4:0x8de5cc):c.mid,lit?.95:.65);
    g.strokePoints(hex(at.x,at.y-3*k,(r-11)*k),true);
    // Painted landing chevrons leave the centre open for the ship.
    g.lineStyle(Math.max(1,3*k),0xf2dfbd,.9);
    for(const side of [-1,1]){
      const x=at.x+side*27*k,y=at.y-3*k;
      g.lineBetween(x,y-15*k,x-side*7*k,y-8*k);g.lineBetween(x,y+15*k,x-side*7*k,y+8*k);
    }
    const lamp=docked?0xcaffbc:lit?0x9df3da:c.glow;
    for(const side of [-1,1]){g.fillStyle(lamp,lit?1:.65);g.fillRect(at.x+side*37*k-2*k,at.y-7*k,4*k,8*k);}
    // Docked state: three steady service strips; over-pad state: a gentle alignment sweep.
    if(docked){g.fillStyle(0xc5ffb4,.9);for(let j=0;j<3;j++)g.fillRect(at.x+(j-1)*10*k-3*k,at.y+29*k,6*k,3*k);}
    else if(lit){g.lineStyle(Math.max(1,2*k),0xc5ffee,.55+.2*Math.sin(now/230));g.beginPath();g.arc(at.x,at.y-3*k,(r-18)*k,-Math.PI/2+now/1600,-Math.PI/2+now/1600+1.2);g.strokePath();}
  });
  // Optional painted fixed-layer nexus; original code-native vault remains the missing-art fallback.
  const nexus=o.rigs?.drawTreasury(rigPose(`treasury-${layout.clan}`,layout.treasury.x,layout.treasury.y,centre));
  if(nexus&&labels.treasury)labels.treasury={...labels.treasury,labelY:nexus.labelY,top:nexus.top};
  if(centre.visible&&!nexus){
    const {x,y}=centre,k=centre.scale;
    g.fillStyle(0x0b1323,.55);g.fillEllipse(x+5*k,y+13*k,112*k,79*k);
    poly(g,hex(x,y+5*k,60*k),c.shade,0x0b1629,Math.max(1,3*k));
    poly(g,hex(x,y-3*k,55*k),c.hull,0x0b1629,Math.max(1,2*k));
    poly(g,[{x:x-45*k,y:y-28*k},{x:x,y:y-53*k},{x:x+45*k,y:y-28*k},{x:x+26*k,y:y-17*k},{x:x-26*k,y:y-17*k}],c.mid,0x18263a,Math.max(.7,k));
    g.lineStyle(Math.max(1,3*k),0xf0ddbc,.9);g.lineBetween(x-36*k,y-28*k,x,y-47*k);g.lineBetween(x,y-47*k,x+36*k,y-28*k);
    poly(g,hex(x,y-2*k,25*k),0xead3ac,0x17273b,Math.max(1,2*k));
    poly(g,hex(x,y-2*k,18*k),c.dark,0x53758b,Math.max(.7,k));
    poly(g,hex(x,y-2*k,8*k),c.glow,0x17273b,Math.max(.6,k));
    g.fillStyle(0xf3dfa7,1);g.fillCircle(x,y-4*k,2.5*k);g.fillRect(x-1.5*k,y-3*k,3*k,7*k);
    g.lineStyle(Math.max(.7,1.5*k),0xd8c3a1,.95);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;g.lineBetween(x+Math.cos(a)*11*k,y-2*k+Math.sin(a)*11*k,x+Math.cos(a)*16*k,y-2*k+Math.sin(a)*16*k);}
    for(const side of [-1,1]){
      g.fillStyle(0x152537,1);g.fillRoundedRect(x+side*33*k-6*k,y+7*k,12*k,23*k,2*k);
      g.fillStyle(0xffd27b,1);g.fillRect(x+side*33*k-3*k,y+12*k,6*k,12*k);
    }
    g.fillStyle(c.glow,.8);for(let i=0;i<3;i++)g.fillRect(x+(i-1)*10*k-2*k,y+38*k,4*k,3*k);
  }
  layout.turrets.forEach((p,i)=>{
    const at=project(p.x,p.y);if(!at.visible)return;
    const k=Math.max(.7,at.scale),aim=o.aim[i]??-Math.PI/2,ahead=project(p.x+Math.cos(aim)*30,p.y+Math.sin(aim)*30);
    const a=Math.atan2(ahead.y-at.y,ahead.x-at.x),ca=Math.cos(a),sa=Math.sin(a),flash=now-(o.firedAt[i]??-1e9)<90;
    if(o.rigs?.drawTurret({...rigPose(`base-turret-${layout.clan}-${i}`,p.x,p.y,at),angle:a,firedAt:o.firedAt[i]??-1e9,groundMuzzle:ahead}))return;
    const pt=(u:number,v:number)=>({x:at.x+(ca*u-sa*v)*k,y:at.y+(sa*u+ca*v)*k});
    poly(g,hex(at.x,at.y+2*k,18*k),c.shade,0x111c2c,Math.max(1,2*k));
    poly(g,[pt(-8,-11),pt(12,-9),pt(15,0),pt(12,9),pt(-8,11),pt(-13,0)],c.hull,0x101c31,Math.max(1,2*k));
    poly(g,[pt(-6,-9),pt(10,-7),pt(8,-2),pt(-8,-2)],c.mid,0x18263a,Math.max(.6,k));
    const recoil=flash?2:0;
    poly(g,[pt(0-recoil,-4),pt(26-recoil,-4),pt(29-recoil,0),pt(26-recoil,4),pt(0-recoil,4)],0xeadfbd,0x132034,Math.max(1,2*k));
    const tip=pt(28-recoil,0);g.fillStyle(c.dark,1);g.fillCircle(tip.x,tip.y,2.1*k);
    const lamp=pt(-5,0);g.fillStyle(c.glow,.95);g.fillCircle(lamp.x,lamp.y,2.3*k);
    if(flash){const tip=pt(39,0),l=pt(29,-6),r=pt(29,6);g.fillStyle(0xffc573,.8);g.fillTriangle(tip.x,tip.y,l.x,l.y,r.x,r.y);const q=pt(33,0);g.fillStyle(0xf4ffec,1);g.fillCircle(q.x,q.y,3*k);}
  });
  // Arrival gate: four unmistakable portal pylons, with a broken energy loop inside 120 world units.
  const gate=project(layout.gate.x,layout.gate.y);
  if(gate.visible){
    labels.gate=gate;const k=gate.scale,r=120;
    g.lineStyle(Math.max(1,3*k),c.glow,.38+.08*Math.sin(now/500));ring(g,o,layout.gate.x,layout.gate.y,r-16,48,true);
    g.lineStyle(Math.max(.7,k),0xffe3b0,.45);ring(g,o,layout.gate.x,layout.gate.y,r-24,48,true);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+Math.PI/4,q=project(layout.gate.x+Math.cos(a)*(r-13),layout.gate.y+Math.sin(a)*(r-13));if(!q.visible)continue;
      poly(g,hex(q.x,q.y,18*q.scale),c.shade,0x101b2e,Math.max(1,2*q.scale));
      poly(g,hex(q.x,q.y-3*q.scale,13*q.scale),0xdcc9ad,0x132338,Math.max(.7,q.scale));
      g.fillStyle(c.glow,.95);g.fillRect(q.x-4*q.scale,q.y-8*q.scale,8*q.scale,10*q.scale);
    }
    g.lineStyle(Math.max(1,2*k),c.glow,.65);for(const side of [-1,1]){g.lineBetween(gate.x+side*33*k,gate.y-16*k,gate.x+side*22*k,gate.y);g.lineBetween(gate.x+side*22*k,gate.y,gate.x+side*33*k,gate.y+16*k);}
  }
  // Existing hit sparks near the boundary produce a local hex ripple, never a whole-screen flash.
  for(const impact of o.impacts??[]){
    const age=now-impact.at;if(age<0||age>360)continue;
    const d=Math.hypot(wrapDelta(impact.x,layout.treasury.x,tune.world.width),wrapDelta(impact.y,layout.treasury.y,tune.world.height));
    if(Math.abs(d-b.domeRadius)<32)shieldContact(g,project(impact.x,impact.y),c.glow,age/360);
  }
  if(o.own&&!o.member){
    const d=Math.hypot(wrapDelta(o.own.x,layout.treasury.x,tune.world.width),wrapDelta(o.own.y,layout.treasury.y,tune.world.height));
    if(Math.abs(d-b.domeRadius)<12)shieldContact(g,project(o.own.x,o.own.y),c.glow,(now%500)/500,true);
  }
  return labels;
}

/** Keep real arrival/deposit text; add a compact canvas-native, clan-coloured warning plate. */
const bannerStyles=new WeakMap<Phaser.GameObjects.Text,string>();
export function styleClanBanner(label:Phaser.GameObjects.Text,clan:number,member:boolean,docked:boolean,w:number,touch:boolean):void {
  const style=`${clan}:${member}:${docked}:${w}:${touch}`;
  if(bannerStyles.get(label)===style)return;
  bannerStyles.set(label,style);
  const colour=docked?'#d5ffbf':clan&&!member?'#ffc391':clan===1?'#ffd4c5':'#b6e8ff';
  label.setFontSize(touch?10:11).setWordWrapWidth(Math.min(w-32,touch?340:480),true).setPadding(10,5,10,5)
    .setBackgroundColor('#101e31').setStroke('#101e31',1).setAlign('center');
  if(label.style.color!==colour)label.setColor(colour);
  // This is a Text canvas background, so no extra object, blend pass or pointer target is allocated.
}
