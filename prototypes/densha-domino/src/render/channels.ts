import type Phaser from 'phaser';
import type {Level} from '../game/types';
import {channelRuns} from './channelRuns';

/** One merged channel silhouette. Shading is clipped inside its actual union,
 * so crossings have neither raised rails nor overlapping rectangle borders. */
export function channelSurface(scene:Phaser.Scene,level:Level,cs:number):Phaser.GameObjects.Image {
  const {cols,rows}=level;
  const key='dd_channel_surface';if(scene.textures.exists(key))scene.textures.remove(key);
  const scale=2,width=cols*cs,height=rows*cs,w=width*scale,h=height*scale;
  const texture=scene.textures.createCanvas(key,w,h)!;const ctx=texture.context,path=new Path2D(),lane=cs*.46*scale;
  for(const run of channelRuns(level)){
    const begin=run.start*cs*scale,length=(run.end-run.start)*cs*scale,across=(run.line+.5)*cs*scale-lane/2;
    if(run.axis==='h')path.rect(begin,across,length,lane);else path.rect(across,begin,lane,length);
  }
  ctx.fillStyle='#abb7cc';ctx.fill(path);const image=ctx.getImageData(0,0,w,h),source=new Uint8ClampedArray(image.data),radius=Math.max(5,Math.round(cs*.1*scale));
  const inside=(x:number,y:number)=>x>=0&&x<w&&y>=0&&y<h&&source[(y*w+x)*4+3]>127;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=(y*w+x)*4;if(!source[p+3])continue;
    let up=radius,left=radius,down=radius,right=radius;
    for(let k=1;k<=radius;k++){if(up===radius&&!inside(x,y-k))up=k;if(left===radius&&!inside(x-k,y))left=k;if(down===radius&&!inside(x,y+k))down=k;if(right===radius&&!inside(x+k,y))right=k;}
    // A channel exits flush with the board; never shade an artificial rounded lip there.
    if(y<radius)up=radius;if(x<radius)left=radius;if(y>=h-radius)down=radius;if(x>=w-radius)right=radius;
    const edge=(d:number)=>Math.pow(1-d/radius,2),shade=-.30*edge(up)-.18*edge(left)+.18*edge(down)+.1*edge(right);
    for(let c=0;c<3;c++)image.data[p+c]=Math.round([171,183,204][c]*(1+shade));
  }
  ctx.putImageData(image,0,0);texture.refresh();return scene.add.image(0,0,key).setOrigin(0).setDisplaySize(width,height).setDepth(1);
}
