import Phaser from 'phaser';
import { combatKey } from './combatSprites';
import { crystalChipPose, crystalChipProfile } from './crystalChipMotion';
import type { CrystalChipEvent } from './crystalChipMotion';
interface Burst {event:CrystalChipEvent;radius:number;at:number;seed:number;}
type Project=(x:number,y:number)=>{x:number;y:number;scale:number;visible:boolean};
/** Reuses existing painted mineral art. No physics objects, pickup state, emitters or timers. */
export class CrystalChips {
  private bursts:Burst[]=[];
  private images:Phaser.GameObjects.Image[]=[];
  private sparks:Phaser.GameObjects.Graphics;
  private used=0;
  private serial=0;
  hits=0; splits=0;
  constructor(private scene:Phaser.Scene){this.sparks=scene.add.graphics().setDepth(27.5).setBlendMode(Phaser.BlendModes.ADD);}
  emit(event:CrystalChipEvent,now:number,radius:number):void {
    if(this.bursts.length>=16){const hit=this.bursts.findIndex(b=>b.event.mode==='hit');this.bursts.splice(hit<0?0:hit,1);}
    this.bursts.push({event,radius,at:now,seed:++this.serial});
    if(event.mode==='hit')this.hits++;else this.splits++;
  }
  snapshot():{hits:number;splits:number;active:number;chips:number;pool:number} {
    return{hits:this.hits,splits:this.splits,active:this.bursts.length,chips:this.used,pool:this.images.length};
  }
  draw(now:number,project:Project,light:number):void {
    this.sparks.clear();this.used=0;this.bursts=this.bursts.filter(b=>now-b.at<crystalChipProfile(b.event.mode,b.event.size).life);
    for(const b of this.bursts){
      const e=b.event,age=now-b.at,profile=crystalChipProfile(e.mode,e.size),hit=e.mode==='hit';
      for(let i=0;i<profile.chips&&this.used<128;i++){
        const f=crystalChipPose(e,b.radius,i,age,b.seed),at=project(e.x+f.dx,e.y+f.dy);if(!at.visible)continue;
        const key=combatKey(i%4===0&&!hit?'mineral-cluster':'mineral-shard');
        if(!this.scene.textures.exists(key))continue;
        let image=this.images[this.used];if(!image){image=this.scene.add.image(0,0,key,'body').setDepth(27.2);this.images.push(image);}this.used++;
        const value=Math.round(255*Math.max(.45,light));
        image.setTexture(key,'body').setVisible(true).setPosition(at.x,at.y-f.lift*at.scale).setRotation(f.angle).setAlpha(f.alpha)
          .setDisplaySize(f.width*at.scale,f.width*at.scale*image.frame.height/image.frame.width).setTint((value<<16)|(value<<8)|value);
      }
      const sparkLife=hit?260:500;if(age>=sparkLife)continue;
      const fade=(1-age/sparkLife)**2;
      for(let i=0;i<profile.sparks;i++){
        const f=crystalChipPose(e,b.radius,i%profile.chips,Math.min(age,100),b.seed);
        const a=(hit?e.id*2.399-.8:b.seed*.37)+i*2.399963,t=age/1000,d=t*(hit?95+i%5*30:180+i%7*38);
        const at=project(e.x+f.dx+Math.cos(a)*d,e.y+f.dy+Math.sin(a)*d);if(!at.visible)continue;
        const size=Math.max(.8,(1.5+i%2)*at.scale),lift=f.lift*at.scale;
        this.sparks.fillStyle(i%3===0?0xfff6c9:i%3===1?0xffd64a:0xffa73e,fade);
        this.sparks.fillRect(at.x-size/2,at.y-lift-size,size,size*(i%3===0?3:1));
      }
    }
    for(let i=this.used;i<this.images.length;i++)this.images[i].setVisible(false);
  }
  destroy():void {this.sparks.destroy();this.images.forEach(i=>i.destroy());this.images=[];this.bursts=[];}
}
