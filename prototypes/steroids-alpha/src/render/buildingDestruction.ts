import Phaser from 'phaser';
import type { BuildingRigPose } from './buildingGeometry';
import { buildingGroundPoint, buildingPoint } from './buildingGeometry';
import { drawDeathCore } from './combatEffects';
import { BLAST_LIFE, buildingFragment } from './buildingBlast';
import type { BuildingKind } from './buildingBlast';

interface Burst {id:string;at:number;kind:BuildingKind;pose:BuildingRigPose;}
/** Eight simultaneous building blasts, bounded shared sprite pool, no timers or emitters. */
export class BuildingDestruction {
  private bursts:Burst[]=[];
  private pieces:Phaser.GameObjects.Image[]=[];
  private used=0;
  private fire:Phaser.GameObjects.Graphics;
  private ground:Phaser.GameObjects.Graphics;
  total=0;
  constructor(private scene:Phaser.Scene,private key:(name:string)=>string){
    this.fire=scene.add.graphics().setDepth(28);this.ground=scene.add.graphics().setDepth(13);
  }
  trigger(pose:BuildingRigPose,kind:BuildingKind):void {
    this.cancel(pose.id);if(this.bursts.length>=8)this.bursts.shift();
    this.bursts.push({id:pose.id,at:pose.now,pose,kind});this.total++;
  }
  cancel(id:string):void {this.bursts=this.bursts.filter(b=>b.id!==id);}
  clear():void {this.bursts=[];this.draw(this.scene.time.now,new Set());}
  follow(pose:BuildingRigPose):void {const b=this.bursts.find(b=>b.id===pose.id);if(b)b.pose=pose;}
  snapshot():{active:number;total:number;pieces:number;pool:number} {
    return{active:this.bursts.length,total:this.total,pieces:this.used,pool:this.pieces.length};
  }
  draw(now:number,visible:Set<string>):void {
    this.fire.clear();this.ground.clear();this.used=0;
    this.bursts=this.bursts.filter(b=>now-b.at<BLAST_LIFE[b.kind]);
    for(const b of this.bursts){
      if(!visible.has(b.id))continue;
      const p=b.pose,age=Math.max(0,now-b.at),big=b.kind==='nexus',k=p.at.scale;
      const core=buildingPoint(p,(big?100:60)*Math.max(0,1-age/700));
      drawDeathCore(this.fire,{...core,scale:k*(big?2.4:.85)},age/(big?1500:1100));
      if(big)for(let i=0;i<3;i++){
        const delayed=age-140-i*150;if(delayed<0||delayed>850)continue;
        const q=buildingPoint(p,50,Math.cos(i*2.4)*65,Math.sin(i*2.4)*65);
        drawDeathCore(this.fire,{...q,scale:k*.9},delayed/1100);
      }
      // Project the shock front and fragment shadows through the same planet-fixed surface.
      const t=Math.min(1,age/650),radius=(big?380:145)*(1-(1-t)**2);
      if(t<1){
        this.ground.lineStyle(Math.max(.7,2*k),0xffdb9c,(1-t)*.5);
        let previous:ReturnType<typeof buildingGroundPoint>|null=null;
        for(let i=0;i<=32;i++){
          const a=i*Math.PI/16,q=buildingGroundPoint(p,Math.cos(a)*radius,Math.sin(a)*radius);
          if(previous?.visible&&q.visible)this.ground.lineBetween(previous.x,previous.y,q.x,q.y);previous=q;
        }
      }
      for(let i=0;i<(big?36:16);i++){
        const f=buildingFragment(i,age,b.kind),root=buildingGroundPoint(p,f.dx,f.dy);if(!root.visible||f.alpha<=0)continue;
        const basis=p.basisAngle??0,x=root.x-Math.sin(basis)*f.lift*.35*root.scale,y=root.y-Math.cos(basis)*f.lift*root.scale;
        const name=i%3===0?'debris-tube':'debris-plate',key=this.key(name);if(!this.scene.textures.exists(key))continue;
        let image=this.pieces[this.used];if(!image){image=this.scene.add.image(0,0,key,'body').setDepth(28.2);this.pieces.push(image);}this.used++;
        image.setTexture(key,'body').setVisible(true).setPosition(x,y).setRotation(f.angle+basis).setAlpha(f.alpha)
          .setDisplaySize(f.width*root.scale,f.width*root.scale*image.frame.height/image.frame.width);
        const light=Math.round(255*(p.brightness??1));image.setTint((light<<16)|(light<<8)|light);
        this.ground.fillStyle(0x080d16,.18*f.alpha);this.ground.fillEllipse(root.x,root.y,f.width*root.scale,.4*f.width*root.scale);
      }
      // Fast rectangular sparks precede the heavier, slower painted metal fragments.
      if(age<800)for(let i=0;i<(big?72:36);i++){
        const a=i*2.39996,d=(18+(age/1000)*(140+i%7*36))*(big?1.8:1),q=buildingGroundPoint(p,Math.cos(a)*d,Math.sin(a)*d);
        if(!q.visible)continue;const alpha=(1-age/800)**2,size=(2+i%3)*q.scale;
        this.fire.fillStyle(i%3===0?0xf2fdff:i%3===1?0xffd28b:0xff9c58,alpha);
        this.fire.fillRect(q.x-size/2,q.y-size,size,size*(i%2?3:1));
      }
    }
    for(let i=this.used;i<this.pieces.length;i++)this.pieces[i].setVisible(false);
  }
  destroy():void {this.fire.destroy();this.ground.destroy();this.pieces.forEach(p=>p.destroy());this.pieces=[];this.bursts=[];}
}
