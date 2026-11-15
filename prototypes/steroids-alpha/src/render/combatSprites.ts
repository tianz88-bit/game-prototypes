import Phaser from 'phaser';
import manifest from '../../art/combat-title-v1/assets.json';
import backlog from '../../art/combat-backlog-v1/assets.json';
import type { OrdnanceView } from '../../sim/protocol';
const assets=[...manifest.assets,...backlog.assets];

export const combatKey = (name:string):string => `combat-${name}`;
export function queueCombatArt(scene:Phaser.Scene):void {
  for(const a of assets)scene.load.image(combatKey(a.name),`assets/loose/combat-${a.name}.png`);
}
/** Runtime body frames retain the source registration metadata; no source art is cropped. */
export function prepareCombatArt(scene:Phaser.Scene):void {
  for(const a of assets){
    const key=combatKey(a.name);if(!scene.textures.exists(key))continue;
    const texture=scene.textures.get(key),image=texture.getSourceImage() as HTMLImageElement;
    const t='trimFrame' in a ? a.trimFrame : undefined;
    if(t){
      const sx=image.width/a.sourceSize[0],sy=image.height/a.sourceSize[1];
      const x=Math.floor(t.x*sx),y=Math.floor(t.y*sy);
      texture.add('body',0,x,y,Math.min(image.width-x,Math.ceil((t.x+t.w)*sx)-x),Math.min(image.height-y,Math.ceil((t.y+t.h)*sy)-y));
    }
  }
}

/** High-water-mark pool: shared bounded textures, baked glow, no per-shot effects or allocations. */
export class CombatSprites {
  private images:Phaser.GameObjects.Image[]=[];
  private used=0;
  constructor(private scene:Phaser.Scene){}
  begin():void {this.used=0;}
  private image(name:string,x:number,y:number,width:number,depth:number):Phaser.GameObjects.Image|null {
    const key=combatKey(name);if(!this.scene.textures.exists(key))return null;
    let image=this.images[this.used];
    if(!image){image=this.scene.add.image(0,0,key,'body');this.images.push(image);}
    this.used++;
    image.setTexture(key,'body').setVisible(true).setPosition(x,y).setOrigin(.5).setRotation(0).setAlpha(1).clearTint();
    image.setDisplaySize(width,width*image.frame.height/image.frame.width);
    if(image.depth!==depth)image.setDepth(depth);
    return image;
  }
  pickup(at:{x:number;y:number;scale:number},radius:number,kind:'mineral'|'salvage'|'heal',id:number,now:number):boolean {
    const phase=now/280+id;
    const name=kind==='heal'?'health-pod':kind==='salvage'?(Math.cos(phase)>.25?'salvage-coin-face':'salvage-coin-tilted'):['mineral-shard','mineral-cluster','mineral-nugget'][id%3];
    const image=this.image(name,at.x,at.y+Math.sin(now/460+id)*2*at.scale,radius*2,18);
    if(image && kind==='salvage'){
      // Both painted views share a fixed height as the token turns edge-on.
      image.setDisplaySize(radius*2*image.frame.width/image.frame.height,radius*2);
      image.setScale(image.scaleX*(.85+.15*Math.abs(Math.cos(phase))),image.scaleY);
    }
    return !!image;
  }
  bullet(head:{x:number;y:number;scale:number},tail:{x:number;y:number},own:boolean,small:boolean,look:number):boolean {
    const name=small?'energy-bolt-drone':look===1?'energy-pulse-heavy':'energy-bolt-standard';
    const width=Math.max((small?12:22)*head.scale,Math.hypot(head.x-tail.x,head.y-tail.y)+8*head.scale);
    const image=this.image(name,head.x,head.y,width,25);
    if(image){image.setOrigin(.88,.5).setRotation(Math.atan2(head.y-tail.y,head.x-tail.x));if(!own)image.setTint(0xffc4b2);}
    return !!image;
  }
  end():void {for(let i=this.used;i<this.images.length;i++)this.images[i].setVisible(false);}
  ordnance(o:OrdnanceView,at:{x:number;y:number;scale:number}):boolean {
    const image=this.image(o.kind===0?'missile':'mine',at.x,at.y,(o.kind===0?30:32)*at.scale,26);
    if(image)image.setRotation(o.heading).setAlpha(o.kind===1&&!o.armed?.72:1);
    return !!image;
  }
  destroy():void {for(const image of this.images)image.destroy();this.images=[];}
}
