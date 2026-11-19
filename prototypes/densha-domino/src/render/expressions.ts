import type Phaser from 'phaser';

const EXPRESSIONS=['sleep','wait','surprise','insist','happy','focus'] as const;
const phased=(expression:string)=>expression==='insist'||expression==='happy';
export function eyeFrame(expression:string,vertical:boolean,phase:number,gaze:number):string {
  const e=EXPRESSIONS.includes(expression as typeof EXPRESSIONS[number])?expression:'wait';
  return `${e}:${Number(vertical)}:${Math.sign(gaze)}:${phased(e)?Math.min(7,Math.max(0,Math.floor(phase*8))):0}`;
}

/** Bake the reviewed lab's exact eyelid paths and clipped pupils into one shared atlas.
 * Canvas paths preserve the small eye silhouettes without per-frame texture uploads. */
export function registerEyes(scene:Phaser.Scene):void {
  if(scene.textures.exists('dd_eyes'))return;
  const texture=scene.textures.createCanvas('dd_eyes',1280,512);if(!texture)return;
  const ctx=texture.context;let index=0;
  for(const expression of EXPRESSIONS)for(const vertical of [false,true])for(const gaze of [-1,0,1])for(let frame=0;frame<(phased(expression)?8:1);frame++){
    const x=(index%16)*80,y=Math.floor(index/16)*64,phase=(frame+.5)/8;
    ctx.save();ctx.translate(x+40,y+32);ctx.scale(2,2);
    const response=expression==='happy'&&phase<.24,surprise=expression==='surprise'||response,focus=expression==='focus',insist=expression==='insist',happy=expression==='happy'&&!response;
    const emphasis=insist?Math.pow(Math.sin(phase*Math.PI),4):0;
    const r=vertical?6.1:5,spread=vertical?7.6:5.55,h=surprise?9.3:focus?5.5:insist?5.5+3*emphasis:happy?7.2:7.7;
    for(const cx of [-spread,spread]){
      const path=new Path2D();
      if(expression==='sleep'){path.moveTo(cx-r+1,0);path.quadraticCurveTo(cx,4,cx+r-1,0);ctx.strokeStyle='#e9dcea';ctx.lineWidth=1.8;ctx.lineCap='round';ctx.stroke(path);continue;}
      if(happy){path.moveTo(cx-r,2);path.bezierCurveTo(cx-r,-h-3,cx+r,-h-3,cx+r,2);path.quadraticCurveTo(cx,-2,cx-r,2);path.closePath();}
      else if(focus||insist&&emphasis<.4){path.moveTo(cx-r,-3);path.lineTo(cx+r,-1);path.bezierCurveTo(cx+r+1,h+4,cx-r-1,h+4,cx-r,-3);path.closePath();}
      else path.ellipse(cx,0,r,h,0,0,Math.PI*2);
      ctx.fillStyle='#fffdf7';ctx.fill(path);ctx.save();ctx.clip(path);
      const px=cx+(vertical?.2:gaze*1.8),py=vertical?gaze*2.3:happy?-2.5:focus?1.4:surprise?-.4:.7;
      ctx.fillStyle='#44334f';ctx.beginPath();ctx.ellipse(px,py,surprise?1.9:2.7,surprise?3.2:4.4,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fffdf7';ctx.beginPath();ctx.ellipse(px-.7,py-1.7,.9,1.25,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.restore();texture.add(eyeFrame(expression,vertical,phase,gaze),0,x,y,80,64);index++;
  }
  texture.refresh();
}
