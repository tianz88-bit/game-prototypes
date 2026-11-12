import type Phaser from 'phaser';
import type { OrdnanceView } from '../../sim/protocol';

export function tint(c: number, light: number): number {
  const ch = (v: number) => Math.min(255, Math.max(0, Math.round(v * light)));
  return (ch(c >> 16) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/** Decoration stays inside the original projected rock outline; collision geometry is untouched. */
export function drawRock(
  g: Phaser.GameObjects.Graphics, pts: {x: number; y: number}[],
  at: {x: number; y: number; scale: number}, radius: number,
  colour: number, light: number, sun: {x: number; y: number}, hp: number, flash: boolean, seed: number,
): void {
  const kind=seed%3;
  const material=kind===0?colour:kind===1?0x557f8c:0x9b80b5;
  const cx = at.x + Math.sin(seed * 3.1) * radius * .13;
  const cy = at.y + Math.cos(seed * 2.7) * radius * .12;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const nx = (a.x + b.x) * .5 - at.x, ny = (a.y + b.y) * .5 - at.y;
    const n = Math.max(1, Math.hypot(nx, ny));
    const face = .80 + .24 * (nx * sun.x + ny * sun.y) / n + .08 * Math.sin(seed + i * 2.1);
    g.fillStyle(flash ? 0xfff8e8 : tint(material, light * face), 1);
    g.fillTriangle(cx, cy, a.x, a.y, b.x, b.y);
  }
  g.lineStyle(Math.max(1.2, 2.5 * at.scale), tint(0x302634, Math.max(.65, light)), 1);
  g.strokePoints(pts, true);
  if (flash) return;
  // Small inset pits, distinct from free-floating collidable asteroids.
  for (let i = 0; i < (kind===1?5:kind===0?2:0); i++) {
    const a = seed * 1.7 + i * 2.4;
    const x = at.x + Math.cos(a) * radius * .43, y = at.y + Math.sin(a) * radius * .32;
    const r = radius * (.09 + .035 * ((seed + i) % 3));
    g.fillStyle(tint(0x403542, light), .65);
    g.fillEllipse(x, y, r * 2, r * 1.45);
    g.lineStyle(Math.max(.7, at.scale), tint(0xd6b9a2, light), .55);
    g.lineBetween(x - r * .7, y + r * .65, x + r * .6, y + r * .65);
  }
  if(kind===0){
    g.lineStyle(Math.max(1,at.scale),tint(0xd7ab76,light),.5);
    for(let i=0;i<3;i++)g.lineBetween(at.x-radius*.55,at.y+radius*(i*.23-.35),at.x+radius*.5,at.y+radius*(i*.23-.15));
  }else if(kind===2){
    g.lineStyle(Math.max(1,at.scale*1.5),tint(0xe7b8e4,light),.8);
    for(let i=0;i<3;i++){const a=seed+i*2.1;g.lineBetween(cx,cy,at.x+Math.cos(a)*radius*.78,at.y+Math.sin(a)*radius*.78);}
  }
  const cracks = hp < .34 ? 3 : hp < .67 ? 2 : 0;
  g.lineStyle(Math.max(1, at.scale * 1.7), tint(0x261f2d, Math.max(.7, light)), .95);
  for (let i = 0; i < cracks; i++) {
    const a = seed + i * 2.1, c = Math.cos(a), s = Math.sin(a);
    g.lineBetween(cx, cy, cx + c * radius * .3 - s * radius * .12, cy + s * radius * .3 + c * radius * .12);
    g.lineBetween(cx + c * radius * .3 - s * radius * .12, cy + s * radius * .3 + c * radius * .12, at.x + c * radius * .85, at.y + s * radius * .85);
  }
}

/** Shared, low-cost pickup silhouettes: amber facets for value, a medical cross for healing. */
export function drawPickup(g: Phaser.GameObjects.Graphics, at: {x: number; y: number; scale: number},
  radius: number, mineral: boolean, id: number, now: number): void {
  const r = radius, x = at.x, y = at.y + Math.sin(now / 460 + id) * 2 * at.scale;
  const pulse = .65 + .35 * Math.sin(now / 310 + id);
  const colour = mineral ? 0xffbe4b : 0x75ffa8;
  g.fillStyle(colour, .08 + .04 * pulse);
  g.fillCircle(x, y, r * 1.6);
  g.fillStyle(0x172537, .75);
  if (mineral) {
    const kind=id%3;
    if(kind===1){
      // A three-pronged cluster; its extent still follows the pickup's value.
      for(let i=0;i<3;i++){const dx=(i-1)*r*.4,dy=i===1?-r*.25:r*.15,h=i===1?r:r*.7;
        const shard=[{x:x+dx,y:y+dy-h},{x:x+dx+r*.28,y:y+dy},{x:x+dx,y:y+dy+h*.65},{x:x+dx-r*.22,y:y+dy}];
        g.fillStyle(i===1?0xffd76c:0xeaa23d,1);g.fillPoints(shard,true);
        g.fillStyle(0xffefba,1);g.fillTriangle(x+dx,y+dy-h,x+dx+r*.28,y+dy,x+dx,y+dy+h*.65);
        g.lineStyle(Math.max(.7,at.scale),0x744527,1);g.strokePoints(shard,true);}
    }else if(kind===2){
      const pts=Array.from({length:6},(_,i)=>({x:x+Math.cos(i*Math.PI/3)*r*.9,y:y+Math.sin(i*Math.PI/3)*r*.75}));
      g.fillStyle(0xd78b35,1);g.fillPoints(pts,true);g.lineStyle(Math.max(1,at.scale*1.5),0xffe297,1);g.strokePoints(pts,true);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;g.fillStyle(i===0?0xffedb0:0xffbf52,1);g.fillTriangle(x,y,x+Math.cos(a)*r*.85,y+Math.sin(a)*r*.7,x+Math.cos(a+Math.PI/3)*r*.85,y+Math.sin(a+Math.PI/3)*r*.7);}
    }else{
    const pts = [{x, y:y-r}, {x:x+r*.65,y:y-r*.18}, {x:x+r*.44,y:y+r*.65}, {x:x-r*.42,y:y+r}, {x:x-r*.67,y:y-r*.12}];
    g.fillPoints(pts, true);
    g.fillStyle(0xf08b31, 1); g.fillPoints(pts, true);
    g.fillStyle(0xffd66c, 1);g.fillTriangle(x,y-r,x-r*.67,y-r*.12,x-r*.08,y+r*.5);
    g.fillStyle(0xfff0b3, 1);g.fillTriangle(x,y-r,x+r*.65,y-r*.18,x+r*.05,y+r*.25);
    g.lineStyle(Math.max(1,at.scale*1.5),0x5c351f,1);g.strokePoints(pts,true);
    g.lineStyle(Math.max(.8,at.scale),0xffefb3,.9);g.lineBetween(x-r*.08,y+r*.5,x-r*.42,y+r);
    }
  } else {
    g.fillRoundedRect(x-r*1.15,y-r*1.15,r*2.3,r*2.3,r*.35);
    g.lineStyle(Math.max(1,at.scale*1.8),colour,.85);g.strokeRoundedRect(x-r*1.15,y-r*1.15,r*2.3,r*2.3,r*.35);
    g.fillStyle(0x29b779,1);g.fillRect(x-r*.3,y-r*.7,r*.6,r*1.6);g.fillRect(x-r*.8,y-r*.2,r*1.6,r*.6);
    g.fillStyle(0xc0ffd1,1);g.fillRect(x-r*.25,y-r*.8,r*.5,r*1.4);g.fillRect(x-r*.7,y-r*.3,r*1.4,r*.5);
  }
  const a = now / 1000 + id, sx=x+Math.cos(a)*r*1.35, sy=y+Math.sin(a)*r;
  g.lineStyle(Math.max(.8,at.scale),0xfff6d8,.5+.4*pulse);
  g.lineBetween(sx-r*.18,sy,sx+r*.18,sy);g.lineBetween(sx,sy-r*.25,sx,sy+r*.25);
}

/** Stable shot families: lance, paired tracer, and a compact drone bolt. */
export function drawBullet(g:Phaser.GameObjects.Graphics,head:{x:number;y:number;scale:number},tail:{x:number;y:number},own:boolean,small:boolean,look:number):void {
  const dx=head.x-tail.x,dy=head.y-tail.y,n=Math.max(.001,Math.hypot(dx,dy)),sx=-dy/n,sy=dx/n;
  const colour=own?0x79e2ff:0xffad79,k=head.scale,w=Math.max(1,(small?1.6:3)*k);
  g.lineStyle(w+2*k,colour,.16);g.lineBetween(head.x,head.y,tail.x,tail.y);
  if(small){g.lineStyle(w,colour,1);g.lineBetween(head.x,head.y,tail.x,tail.y);g.fillStyle(0xf2f9de,1);g.fillCircle(head.x,head.y,Math.max(1,2*k));}
  else if(look===1){
    g.lineStyle(Math.max(1,k),colour,1);
    for(const side of [-1,1])g.lineBetween(head.x+sx*side*2*k,head.y+sy*side*2*k,tail.x+sx*side*2*k,tail.y+sy*side*2*k);
    g.lineStyle(w,0xfff1cf,1);g.lineBetween(head.x,head.y,head.x-dx*.25,head.y-dy*.25);
  }else{
    g.fillStyle(colour,1);g.fillTriangle(head.x+dx/n*3*k,head.y+dy/n*3*k,tail.x+sx*2.4*k,tail.y+sy*2.4*k,tail.x-sx*2.4*k,tail.y-sy*2.4*k);
    g.lineStyle(Math.max(1,k),0xeafff8,1);g.lineBetween(head.x,head.y,tail.x+dx*.45,tail.y+dy*.45);
  }
}

/** A weapon drone hovers over a detached hard shadow; its gun axis and muzzle stay at the original mount. */
export function drawDrone(g:Phaser.GameObjects.Graphics,x:number,y:number,k:number,a:number,now:number,seed:number,light:number,firing:boolean):void {
  const r=5.5*k,c=Math.cos(a),s=Math.sin(a),bob=Math.sin(now/210+seed)*k;
  const p=(u:number,v:number)=>({x:x+(c*u-s*v)*k,y:y+(s*u+c*v)*k});
  g.fillStyle(0x07121d,.45);g.fillEllipse(x+2*k,y+8*k,22*k,8*k);
  const aft=p(-8,0);g.fillStyle(0x6ce1ff,.65);g.fillEllipse(aft.x,aft.y+2*k,5*k,9*k+bob);
  const hull=[p(6,0),p(2,-5),p(-5,-4),p(-8,0),p(-5,4),p(2,5)];
  g.fillStyle(tint(0xd6c6a6,light),1);g.fillPoints(hull,true);g.lineStyle(Math.max(1,k*1.5),0x253c50,1);g.strokePoints(hull,true);
  for(const side of [-1,1]){const q=p(-2,side*(7+bob/Math.max(.01,k)));g.fillStyle(tint(0xe3914e,light),1);g.fillEllipse(q.x,q.y,8*k,4*k);g.fillStyle(0xc2f8ff,.9);g.fillCircle(q.x,q.y,1.3*k);}
  g.lineStyle(Math.max(3,5*k),0x1a2638,1);g.lineBetween(x,y,x+c*r*2,y+s*r*2);
  g.lineStyle(Math.max(1,2*k),tint(0xdce8e1,light),1);g.lineBetween(x,y,x+c*r*2,y+s*r*2);
  g.fillStyle(0x235c75,1);g.fillCircle(x,y,3*k);g.fillStyle(0xb6faff,.95);g.fillCircle(x+c*k,y+s*k,1.6*k);
  if(firing){const q=p(14,0),l=p(10,-3),rr=p(10,3);g.fillStyle(0xf8ffd9,1);g.fillTriangle(q.x,q.y,l.x,l.y,rr.x,rr.y);}
}

export function drawHitSpark(g:Phaser.GameObjects.Graphics,at:{x:number;y:number;scale:number},t:number,angle:number,seed:number):void {
  const k=at.scale,fade=(1-t)**2,travel=1-(1-t)**2;
  for(let i=0;i<9;i++){
    const a=angle+(i-4)*.25+Math.sin(seed+i*7)*.12;
    const d=(3+travel*(18+(i%3)*8))*k,len=(4+9*(1-t))*k,c=Math.cos(a),s=Math.sin(a);
    g.lineStyle(Math.max(.8,(i%3===0?2.3:1.4)*k),i%3===0?0xff9561:i%3===1?0xffd785:0xf2fff1,fade);
    g.lineBetween(at.x+c*d,at.y+s*d,at.x+c*(d+len),at.y+s*(d+len));
  }
  if(t<.3){const r=(4+6*t)*k;g.fillStyle(0xfff7d7,(1-t/.3)*.9);g.fillRect(at.x-r,at.y-k,r*2,k*2);g.fillRect(at.x-k,at.y-r,k*2,r*2);}
  g.fillStyle(0x586576,fade*.85);
  for(let i=0;i<2;i++){const a=angle+(i?1:-1),d=travel*18*k;g.fillRect(at.x+Math.cos(a)*d,at.y+Math.sin(a)*d,3*k,2*k);}
}

export function drawOrdnance(g: Phaser.GameObjects.Graphics, o: OrdnanceView,
  at: {x: number; y: number; scale: number}, own: boolean, now: number, triggerRadius: number): void {
  const {x,y}=at,k=at.scale,signal=own?0x75e7ff:0xff8664;
  const c=Math.cos(o.heading),s=Math.sin(o.heading);
  const p=(u:number,v:number)=>({x:x+(c*u-s*v)*k,y:y+(s*u+c*v)*k});
  if(o.kind===0){
    const shape=[p(14,0),p(5,-4),p(-8,-4),p(-13,-9),p(-11,0),p(-13,9),p(-8,4),p(5,4)];
    g.fillStyle(0x1a293b,1);g.fillPoints(shape,true);g.lineStyle(Math.max(1,k*2),signal,1);g.strokePoints(shape,true);
    const a=p(-7,-2),b=p(7,0),d=p(-7,2);g.fillStyle(0xf3f7e9,1);g.fillTriangle(a.x,a.y,b.x,b.y,d.x,d.y);
    const f=p(-12,0),tip=p(-24-4*Math.sin(now/30),0),l=p(-12,-3.5),r=p(-12,3.5);
    g.fillStyle(0xff9d4b,.8);g.fillTriangle(l.x,l.y,tip.x,tip.y,r.x,r.y);
    g.fillStyle(0xc6f7ff,1);g.fillCircle(f.x,f.y,2.5*k);
  }else{
    // Broken trigger perimeter stays faint enough to leave bullets and the mine body readable.
    g.lineStyle(Math.max(1,k),signal,o.armed?.25:.12);
    for(let i=0;i<8;i++){g.beginPath();g.arc(x,y,triggerRadius*k,i*Math.PI/4,i*Math.PI/4+.24);g.strokePath();}
    for(let i=0;i<6;i++){const a=i*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a);
      g.fillStyle(0x8e9eac,1);g.fillTriangle(x+ca*16*k,y+sa*16*k,x+(ca*7-sa*3)*k,y+(sa*7+ca*3)*k,x+(ca*7+sa*3)*k,y+(sa*7-ca*3)*k);}
    g.fillStyle(0x172536,1);g.fillCircle(x,y,10*k);g.lineStyle(Math.max(1,2*k),0xabbac5,1);g.strokeCircle(x,y,10*k);
    g.fillStyle(o.armed?signal:0xffd272,1);g.fillCircle(x,y,5*k);
    g.fillStyle(0xfff4d2,o.armed?.55+.4*Math.sin(now/85):.35);g.fillCircle(x-k,y-k,2.2*k);
  }
  if(o.hp<1){g.fillStyle(0x0d1524,.9);g.fillRect(x-12*k,y-23*k,24*k,4*k);
    g.fillStyle(signal,1);g.fillRect(x-12*k,y-23*k,24*k*Math.max(0,o.hp),4*k);}
}

export function drawExplosionCore(g:Phaser.GameObjects.Graphics,at:{x:number;y:number;scale:number},t:number):void {
  const {x,y}=at,k=at.scale;
  if(t>.08 && t<.7){
    g.fillStyle(0x29313e,.25*(1-t/.7));
    for(let i=0;i<5;i++){const a=i*2.4,d=(28+t*65)*k;g.fillCircle(x+Math.cos(a)*d,y+Math.sin(a)*d,(16+t*22)*k);}
  }
  if(t<.32){
    const f=t/.32,r=(25+65*Math.sqrt(f))*k;
    g.fillStyle(0xff8854,.55*(1-f));
    for(let i=0;i<6;i++){const a=i*Math.PI/3;g.fillTriangle(x+Math.cos(a)*r*1.45,y+Math.sin(a)*r*1.45,
      x+Math.cos(a-.4)*r*.5,y+Math.sin(a-.4)*r*.5,x+Math.cos(a+.4)*r*.5,y+Math.sin(a+.4)*r*.5);}
    g.fillStyle(0xffbf6c,.75*(1-f));g.fillCircle(x,y,r*.6);
    g.fillStyle(0xfff4cd,.9*(1-f));g.fillCircle(x,y,r*.34);
  }
  if(t<.08){g.fillStyle(0xe5fbff,1-t/.08);g.fillCircle(x,y,(22+80*t)*k);}
}
