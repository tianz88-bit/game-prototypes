import type Phaser from 'phaser';
import type { OrdnanceView } from '../../sim/protocol';
type At={x:number;y:number;scale:number};
export type CombatImpact='missile'|'mine'|'shot'|'asteroid'|'ram'|'nova';

/** Short, directional fragments with a solid hot face and a darker material edge. */
export function drawImpactSpark(g:Phaser.GameObjects.Graphics,at:At,t:number,angle:number,seed:number):void {
  const {x,y}=at,k=at.scale,fade=(1-t)**2;
  for(let i=0;i<11;i++){
    const a=angle+(i-5)*.21+Math.sin(seed+i*7)*.12,c=Math.cos(a),s=Math.sin(a);
    const d=(3+(1-(1-t)**2)*(17+i%3*7))*k,l=(3+(1-t)*(i%3===0?15:7))*k,w=(i%3===0?1.9:1.1)*k;
    const px=x+c*d,py=y+s*d;
    g.fillStyle(0x503340,fade*.8);g.fillTriangle(px-s*w*1.7,py+c*w*1.7,px+s*w*1.7,py-c*w*1.7,px+c*l*1.2,py+s*l*1.2);
    g.fillStyle(i%3===0?0xfff7d7:i%3===1?0xffc56f:0xff8d52,fade);
    g.fillTriangle(px-s*w,py+c*w,px+s*w,py-c*w,px+c*l,py+s*l);
  }
  if(t<.26){const r=(5+8*t)*k;g.fillStyle(0xfff4d7,1-t/.26);g.fillRect(x-r,y-k,r*2,k*2);g.fillRect(x-k,y-r,k*2,r*2);}
}

/** A single scalloped painted mass avoids additive overlapping bubble outlines. */
function cloud(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,colour:number,alpha:number,phase=0,stretch=1):void {
  const pts=Array.from({length:40},(_,i)=>{const a=i*Math.PI/20,rr=r*(1+.13*Math.sin(a*7+phase)+.06*Math.sin(a*11-phase));return{x:x+Math.cos(a)*rr,y:y+Math.sin(a)*rr*stretch};});
  g.fillStyle(colour,alpha);g.fillPoints(pts,true);
}
export function drawDeathCore(g:Phaser.GameObjects.Graphics,at:At,t:number):void {
  const {x,y}=at,k=at.scale,travel=1-(1-Math.min(1,t/.65))**2,r=(18+75*travel)*k;
  if(t<.78){
    const smoke=Math.min(1,(.85-t)*2);
    cloud(g,x+6*k,y+8*k,r*1.04,0x172332,smoke,t*3,.82);
    cloud(g,x+3*k,y+4*k,r*.96,0x665764,smoke,t*3,.8);
    if(t<.4){const hot=Math.min(1,(.4-t)*7);
      cloud(g,x,y,r*.96,0xd95d3c,hot,t*3,.83);
      cloud(g,x-4*k,y-6*k,r*.78,0xff9d45,hot,t*3+.3,.85);
      cloud(g,x-5*k,y-7*k,r*.51,0xffd477,hot,t*3+.7,.83);
      cloud(g,x-5*k,y-7*k,r*.24,0xfff1ba,hot,t*3+.3,.8);
    }
  }
  if(t<.09){const fade=1-t/.09,rr=(12+30*t)*k;g.fillStyle(0xfff8dd,fade);g.fillRect(x-rr*2,y-2*k,rr*4,4*k);g.fillRect(x-2*k,y-rr,4*k,rr*2);}
}

export function drawCombatImpact(g:Phaser.GameObjects.Graphics,at:At,t:number,kind:CombatImpact,radius:number,colour=0xb99cff):void {
  const {x,y}=at,k=at.scale,r=radius*k,fade=(1-t)**2,travel=1-(1-t)**3;
  if(kind==='nova'){
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+t*.7;g.lineStyle(Math.max(1,4*k*(1-t)),colour,fade*.8);g.beginPath();g.arc(x,y,r*(.2+.8*travel),a,a+.9);g.strokePath();
      const px=x+Math.cos(a)*r*travel,py=y+Math.sin(a)*r*travel;g.fillStyle(0xf7edff,fade);g.fillRect(px-2*k,py-6*k,4*k,12*k);
    }
    g.lineStyle(Math.max(1,2*k),0xf1e5ff,fade*.6);g.strokeEllipse(x,y,r*(.4+travel)*2,r*(.15+travel*.4));return;
  }
  if(kind==='asteroid'){
    for(let i=0;i<9;i++){const a=i*2.399,d=r*(.2+travel*.8),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d,size=(5+i%3*3)*k*(1-t*.5);
      g.fillStyle(i%2?0x70505a:0x9b735e,fade);g.fillTriangle(px-size,py,px,py-size,px+size,py+size*.7);g.fillStyle(0xe7bd91,fade*.7);g.fillTriangle(px-size,py,px,py-size,px+size*.3,py);}
    g.lineStyle(Math.max(1,4*k*(1-t)),0xd6bba0,fade*.25);g.strokeEllipse(x,y,r*(.5+travel)*2,r*(.5+travel));return;
  }
  if(kind==='shot'){
    drawImpactSpark(g,at,t,0,19);drawImpactSpark(g,at,t,Math.PI,53);return;
  }
  if(kind==='ram'){
    const size=r*(.18+.8*travel);
    if(t<.5){cloud(g,x,y,r*(.18+travel*.38),0xb44d32,(1-t*2)*.85,t*3,.6);cloud(g,x-2*k,y-2*k,r*(.12+travel*.28),0xffa249,(1-t*2)*.95,t*3,.6);}
    g.lineStyle(Math.max(1,4*k*(1-t)),0xffa04d,fade);g.strokeEllipse(x,y,size*2,size*.7);
    for(let i=0;i<12;i++){const a=i*2.399,d=size*(.5+travel*.5),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d,w=(2+i%3)*k;
      g.fillStyle(i%3===0?0xfff0b9:i%2?0xffc16a:0xe46a36,fade);g.fillRect(px,py,w,w*(i%2?3:1));}
    for(const side of [-1,1]){const d=size*.7;g.lineStyle(Math.max(1,5*k),0xffb25d,fade);g.lineBetween(x+side*d,y-d*.35,x+side*d*.65,y);g.lineBetween(x+side*d*.65,y,x+side*d,y+d*.35);}
    if(t<.2){g.fillStyle(0xfff7d8,1-t/.2);g.fillRect(x-r*.32,y-2*k,r*.64,4*k);}return;
  }
  // Missile: pointed fire petals. Mine: a low, wider detonation with a segmented shock front.
  const mine=kind==='mine';
  if(t<.6){
    const hot=Math.min(1,(.6-t)*4),body=r*(.2+travel*.48);
    cloud(g,x,y+2*k,body*1.09,0x653840,hot,t*2,mine?.72:1);
    cloud(g,x,y,body,0xef7540,hot,t*2,mine?.72:1);
    cloud(g,x-2*k,y-3*k,body*.74,0xffb75b,hot,t*2+.3,mine?.72:1);
    cloud(g,x-2*k,y-4*k,body*.38,0xffedac,hot,t*2+.8,mine?.72:1);
  }
  g.lineStyle(Math.max(1,3*k*(1-t)),mine?0xffce86:0xff9d66,fade*.7);
  for(let i=0;i<8;i++){g.beginPath();g.arc(x,y,Math.max(1,r*(.15+travel*.85)),i*Math.PI/4,i*Math.PI/4+.5);g.strokePath();}
  if(t>.2){g.fillStyle(0x4e4856,fade*.3);for(let i=0;i<5;i++){const a=i*2.4,d=r*(.3+travel*.5);g.fillCircle(x+Math.cos(a)*d,y+Math.sin(a)*d,r*.13);}}
}

export function drawShieldShatter(g:Phaser.GameObjects.Graphics,at:At,t:number,radius:number):void {
  const k=at.scale,r=radius*k,fade=(1-t)**2;
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,d=r*(.62+t*.5),x=at.x+Math.cos(a)*d,y=at.y+Math.sin(a)*d,s=(8-i%3)*k*(1-t*.5),rot=a+t*(i%2?1:-1);
    const pts=Array.from({length:6},(_,j)=>({x:x+Math.cos(rot+j*Math.PI/3)*s,y:y+Math.sin(rot+j*Math.PI/3)*s}));
    g.fillStyle(0x438caf,fade*.35);g.fillPoints(pts,true);g.lineStyle(Math.max(.8,1.5*k),0xb9f1ff,fade*.9);g.strokePoints(pts,true);
  }
  g.lineStyle(Math.max(1,2*k),0x78d9f5,fade*.55);for(let i=0;i<6;i++){g.beginPath();g.arc(at.x,at.y,r*(.75+t*.25),i*Math.PI/3,i*Math.PI/3+.52);g.strokePath();}
}

/** Painted bodies stay at their existing world size; only exhaust/status lamps animate. */
export function drawOrdnanceCue(g:Phaser.GameObjects.Graphics,o:OrdnanceView,at:At,own:boolean,now:number,triggerRadius:number,seeking=false):void {
  const {x,y}=at,k=at.scale,signal=own?0x78e7ff:0xff8969,c=Math.cos(o.heading),s=Math.sin(o.heading);
  if(o.kind===0){
    const len=(12+3*Math.sin(now/35+o.id))*k,px=x-c*14*k,py=y-s*14*k;
    g.fillStyle(0xffa756,.8);g.fillTriangle(px-s*3*k,py+c*3*k,px+s*3*k,py-c*3*k,px-c*len,py-s*len);
    g.fillStyle(0xd3f9ff,1);g.fillTriangle(px-s*1.6*k,py+c*1.6*k,px+s*1.6*k,py-c*1.6*k,px-c*len*.6,py-s*len*.6);
    if(o.target){g.lineStyle(Math.max(.8,k),signal,.8);g.strokeCircle(x+c*10*k,y+s*10*k,3*k);}
  }else{
    const sweep=now/(seeking?160:o.armed?450:1000)+o.id;
    g.lineStyle(Math.max(.8,1.4*k),o.armed?signal:0xffd178,o.armed?.45:.2);
    for(let i=0;i<6;i++){g.beginPath();g.arc(x,y,triggerRadius*k,i*Math.PI/3+.1,i*Math.PI/3+.5);g.strokePath();}
    g.lineStyle(Math.max(1,2*k),o.armed?signal:0xffd178,.8);g.beginPath();g.arc(x,y,11*k,sweep,sweep+.9);g.strokePath();
    g.fillStyle(o.armed?signal:0xffd178,.7+.3*Math.sin(now/(o.armed?90:240)));g.fillCircle(x,y,2.4*k);
    if(seeking){const px=x-c*15*k,py=y-s*15*k;g.fillStyle(0xffe8b7,.9);g.fillTriangle(px-s*2*k,py+c*2*k,px+s*2*k,py-c*2*k,px-c*6*k,py-s*6*k);}
  }
  if(o.hp<1){g.fillStyle(0x071425,.9);g.fillRect(x-12*k,y-23*k,24*k,4*k);g.fillStyle(signal,.9);g.fillRect(x-12*k,y-23*k,24*k*Math.max(0,o.hp),4*k);}
}

/** Leading orange attack envelope, present only during active dash frames. */
export function drawRamAttack(g:Phaser.GameObjects.Graphics,at:At,angle:number,reach:number,width:number,now:number):void {
 const k=at.scale,c=Math.cos(angle),s=Math.sin(angle),nose={x:at.x+c*reach*k,y:at.y+s*reach*k};
 const point=(f:number,l:number)=>({x:nose.x+(c*f-s*l)*k,y:nose.y+(s*f+c*l)*k});
 g.fillStyle(0xed6a32,.23);g.fillPoints([point(-7,-width),point(12,0),point(-7,width),point(0,0)],true);
 for(const side of [-1,1]){const a=point(-3,side*width*.92),b=point(10,0),p=point(-1,side*width*.6),q=point(7,0);
 g.lineStyle(Math.max(1,3*k),0xff913d,.7+.15*Math.sin(now/65));g.lineBetween(a.x,a.y,b.x,b.y);
 g.lineStyle(Math.max(.7,k),0xffe0a3,.85);g.lineBetween(p.x,p.y,q.x,q.y);}
}
