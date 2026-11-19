import type Phaser from 'phaser';
import {TUNNEL_BOXES} from './art';

export const TUNNEL_FRAME={width:512,height:260,split:28};
/** All four views come from the original plastic-tunnel atlas. */
export function registerTunnelLayers(scene:Phaser.Scene):void {
 if(!scene.textures.exists('dd_tunnels')||scene.textures.exists('dd_tunnel_set'))return;
 const source=scene.textures.get('dd_tunnels').getSourceImage() as HTMLImageElement,t=scene.textures.createCanvas('dd_tunnel_set',1024,768)!,ctx=t.context;
 // Undo the generated sheet's slight trapezoid projection, retaining its two
 // vertical views, entrance detailing and cover-only end at constant width.
 for(let i=0;i<2;i++){
  const [sx,sy,sw,sh]=TUNNEL_BOXES[i];
  for(let row=0;row<160;row++){const y=row/160*sh,inset=Math.max(0,1-y/410)*55;ctx.drawImage(source,sx+inset,sy+y,sw-inset*2,sh/160,i*128,row,128,1);}
  t.add(i===0?'north-art':'south-art',0,i*128,0,128,160);
 }
 for(let i=0;i<2;i++)for(let part=0;part<2;part++){
  const [sx,sy,sw,sh]=TUNNEL_BOXES[i===0?3:2],x=part*512,y=192+i*260;
  ctx.save();if(part){ctx.beginPath();ctx.rect(x+(i?0:28),y,484,260);ctx.clip();}
  ctx.drawImage(source,sx,sy,sw,sh,x,y,512,260);ctx.restore();t.add(i+'-'+(part?'front':'back'),0,x,y,512,260);
 }
 // The existing green interior becomes a neutral blue-grey to match the recess.
 const pixels=ctx.getImageData(0,0,1024,768),p=pixels.data;
 for(let n=0;n<p.length;n+=4)if(p[n+3]>0&&p[n]<175&&p[n+1]>p[n]+9&&p[n+1]>p[n+2]+4){const l=(p[n]+p[n+1]+p[n+2])/3;p[n]=l*.7;p[n+1]=l*.85;p[n+2]=l;}
 ctx.putImageData(pixels,0,0);t.refresh();
}

/** Bake once per level/direction; stretch only the straight body, not the mouth. */
export function planTunnelTexture(scene:Phaser.Scene,dir:'up'|'down',cs:number,extent:number):string {
 const key='dd_active_plan_'+dir;if(scene.textures.exists(key))return key;
 const w=Math.ceil(cs*1.04*2),h=Math.ceil(extent*2),t=scene.textures.createCanvas(key,w,h)!,ctx=t.context,cap=Math.min(h,Math.ceil(w*24/128));
 if(scene.textures.exists('dd_tunnel_set')){
  const source=scene.textures.get('dd_tunnel_set').getSourceImage() as HTMLCanvasElement,x=dir==='up'?0:128;
  ctx.save();if(dir==='down'){ctx.translate(0,h);ctx.scale(1,-1);}
  ctx.drawImage(source,x,0,128,136,0,0,w,h-cap);ctx.drawImage(source,x,136,128,24,0,h-cap,w,cap);ctx.restore();
 }else{ctx.fillStyle='#fff5e7';ctx.fillRect(0,0,w,h);}
 ctx.globalCompositeOperation='destination-in';const fade=ctx.createLinearGradient(0,0,0,h);
 fade.addColorStop(0,dir==='up'?'transparent':'#ffffff');fade.addColorStop(dir==='up'?.75:.25,'#ffffff');fade.addColorStop(1,dir==='up'?'#ffffff':'transparent');ctx.fillStyle=fade;ctx.fillRect(0,0,w,h);t.refresh();return key;
}
