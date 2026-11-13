import Phaser from 'phaser';

// Authored at 64px: six opaque colours per material, broad clusters, no AA/noise.
// Runtime canvases are fixed sprite textures, built once; no per-frame painting.
export const ROCK_PALETTES = [
  ['#302637','#644355','#a46155','#d28b59','#edb76d','#ffe0a0'],
  ['#253044','#355469','#447e87','#65a99d','#9bd6b6','#d9efd0'],
  ['#30283f','#534566','#805b93','#ad7dab','#d7a8cb','#f6d5da'],
];
export const ROCK_PATCHES = [
  [[10,18,17,9],[15,11,22,8],[9,27,14,14],[20,19,26,15],[21,40,22,10],[41,32,10,13]],
  [[14,12,24,10],[9,23,13,15],[24,22,25,15],[17,39,18,13],[39,38,12,9]],
  [[11,17,17,15],[24,10,20,12],[26,25,25,14],[12,34,17,13],[30,43,14,9]],
];
const key = (variant:number,damage:number) => `pixel-rock-${variant}-${damage}`;

/** Every opaque silhouette contains the 24px collision disc, including between steps. */
function silhouette(x:number,y:number,variant:number):boolean {
  const dx=x+.5-32,dy=y+.5-32,a=Math.atan2(dy,dx);
  const lobes=28.2+1.8*Math.sin(a*[5,7,4][variant%3]+variant*1.7)+.9*Math.cos(a*3+variant);
  return Math.hypot(dx,dy)<lobes;
}

export function buildRockPixels(scene:Phaser.Scene):void {
  for(let variant=0;variant<9;variant++)for(let damage=0;damage<3;damage++){
    if(scene.textures.exists(key(variant,damage)))continue;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d')!;const p=ROCK_PALETTES[variant%3];
    const mask=Array.from({length:64},(_,y)=>Array.from({length:64},(_,x)=>silhouette(x,y,variant)));
    const put=(x:number,y:number,c:number)=>{if(x>=0&&x<64&&y>=0&&y<64&&mask[y][x]){ctx.fillStyle=p[c];ctx.fillRect(x,y,1,1);}};
    // Broad stepped planes: shadows cooler, the upper-left shoulder warm and bright.
    for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(mask[y][x]){
      const edge=!mask[y-1]?.[x]||!mask[y+1]?.[x]||!mask[y][x-1]||!mask[y][x+1];
      const plane=x*.55+y+(x>36?4:0);
      put(x,y,edge?(x+y<48?3:0):plane<34?4:plane<56?3:plane<75?2:1);
    }
    const patches=ROCK_PATCHES[Math.floor(variant/3)];
    for(const [i,[x,y,w,h]]of patches.entries()){
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
        if((xx<x+3&&yy<y+3)||(xx>x+w-4&&yy>y+h-4))continue;
        put(xx,yy,i%3===0?3:i%3===1?2:3);
      }
    }
    // Asymmetric inset pits, a dark floor and a short bright lower lip.
    const pits=variant%3===1?[[23,23,6],[41,37,4],[23,44,3]]:[[25,27,7],[43,41,4]];
    for(const [cx,cy,r]of pits)for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){
      if(xx*xx+yy*yy>r*r)continue;
      put(cx+xx,cy+yy,yy<0?1:yy>r-2?4:2);
    }
    for(const [x,y,w,h]of [[16,13,7,2],[13,17,3,4],[34,16,5,2]])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(xx,yy,5);
    // Crack steps are grouped into blocks instead of smooth vector lines.
    for(let branch=0;branch<damage;branch++)for(let i=0;i<14;i++){
      const x=30+Math.floor(i*.65)*(branch?-1:1),y=29+i;
      put(x,y,0);put(x+1,y,0);if(i%4<2)put(x+2,y,1);
    }
    scene.textures.addCanvas(key(variant,damage),canvas)!.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** Pixel sprites bent through the same planet projection, using a small 4x4 surface grid. */
export class PixelRocks {
  private active=new Map<number,Phaser.GameObjects.Mesh|Phaser.GameObjects.Image>();
  private pool:(Phaser.GameObjects.Mesh|Phaser.GameObjects.Image)[]=[];
  private seen=new Set<number>();
  constructor(private scene:Phaser.Scene){buildRockPixels(scene);}
  begin():void{this.seen.clear();}
  draw(id:number,x:number,y:number,r:number,hp:number,flash:boolean,light:number,sun:{x:number;y:number},project:(x:number,y:number)=>{x:number;y:number;visible:boolean}):void{
    const extent=r*64/48;
    const points=Array.from({length:25},(_,i)=>project(x+(i%5/4*2-1)*extent,y+(Math.floor(i/5)/4*2-1)*extent));
    if(points.some(p=>!p.visible))return;
    const damage=hp<.34?2:hp<.67?1:0,texture=key(id%9,damage);
    let mesh=this.active.get(id);
    if(!mesh){
      mesh=this.pool.pop();
      if(!mesh){
        if(this.scene.game.renderer.type===Phaser.CANVAS){
          mesh=this.scene.add.image(0,0,texture).setDepth(14).setActive(false);
        }else{
        const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
        for(let j=0;j<5;j++)for(let i=0;i<5;i++){vertices.push(i,j);uvs.push(i/4,j/4);}
        for(let j=0;j<4;j++)for(let i=0;i<4;i++){const a=j*5+i;indices.push(a,a+5,a+1,a+1,a+5,a+6);}
        mesh=this.scene.add.mesh(0,0,texture,undefined,vertices,uvs,indices).setDepth(14).setActive(false);
        mesh.hideCCW=false;
        }
      }
      this.active.set(id,mesh);
    }
    mesh.setTexture(texture).setVisible(true);mesh.tintFill=flash;this.seen.add(id);
    if(mesh instanceof Phaser.GameObjects.Image){
      const left=points[10],right=points[14],top=points[2],bottom=points[22],at=points[12];
      mesh.setPosition(at.x,at.y).setDisplaySize(Math.hypot(right.x-left.x,right.y-left.y),Math.hypot(bottom.x-top.x,bottom.y-top.y))
        .setRotation(Math.atan2(right.y-left.y,right.x-left.x));
      return;
    }
    // The planet projection already provides camera-space coordinates. Inactive meshes skip
    // Phaser's separate 3D preUpdate; the documented transformed vertex fields feed its renderer.
    for(const v of mesh.vertices){
      const i=Math.round(v.u*4),j=Math.round(v.v*4),q=points[j*5+i];
      v.vx=q.x;v.vy=q.y;v.vz=0;
      const shade=Math.min(1,Math.max(.22,light*(.91+.09*((i-2)*sun.x+(j-2)*sun.y)/2)));
      const c=flash?255:Math.round(shade*255);v.color=(c<<16)|(c<<8)|c;
    }
  }
  end():void{for(const [id,mesh]of this.active)if(!this.seen.has(id)){mesh.setVisible(false);this.pool.push(mesh);this.active.delete(id);}}
}
