import type Phaser from 'phaser';
import {BODY_BOXES} from './art';

/** Derive emission from the real cream diffuser pixels, so lights cannot float
 * off a hand-approximated curve. Bodies and the emission atlas share registration. */
export function registerSignalArt(scene:Phaser.Scene,source:HTMLImageElement):void {
  if(scene.textures.exists('dd_signals'))return;
  const out=scene.textures.createCanvas('dd_signals',source.width,source.height);if(!out)return;
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(source,0,0);
  const raw=ctx.getImageData(0,0,source.width,source.height),mask=ctx.createImageData(source.width,source.height),data=raw.data;
  for(const [bx,by,w,h]of BODY_BOXES){
    const visited=new Uint8Array(w*h);
    const cream=(x:number,y:number)=>{const p=((by+y)*source.width+bx+x)*4;return data[p+3]>=180&&data[p]>=205&&data[p+1]>=190&&data[p]-data[p+1]<=35&&data[p+1]-data[p+2]>=10;};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(visited[y*w+x]||!cream(x,y))continue;
      const stack=[y*w+x],points:number[]=[];visited[y*w+x]=1;
      while(stack.length){const a=stack.pop()!,px=a%w,py=Math.floor(a/w);points.push(a);
        for(const [nx,ny]of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]])if(nx>=0&&nx<w&&ny>=0&&ny<h&&!visited[ny*w+nx]&&cream(nx,ny)){visited[ny*w+nx]=1;stack.push(ny*w+nx);}
      }
      if(points.length<60)continue;
      for(const a of points){const p=((by+Math.floor(a/w))*source.width+bx+a%w)*4;mask.data[p]=255;mask.data[p+1]=255;mask.data[p+2]=255;mask.data[p+3]=255;}
    }
  }
  ctx.clearRect(0,0,source.width,source.height);ctx.putImageData(mask,0,0);
  out.context.shadowBlur=7;out.context.shadowColor='#ffffff';out.context.drawImage(canvas,0,0);out.context.shadowBlur=0;out.context.drawImage(canvas,0,0);out.refresh();
  BODY_BOXES.forEach(([x,y,w,h],i)=>out.add(String(i),0,x,y,w,h));
}
