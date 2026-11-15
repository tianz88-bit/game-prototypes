import Phaser from 'phaser';
import manifest from '../../art/buildings-v1/assets.json';
import { remapPixels } from './palette';

const sourceKey=(name:string)=>`building-src-${name}`;
export const buildingKey=(name:string,clan:number)=>`building-${name}-${clan===1?1:2}`;
export function queueBuildingArt(scene:Phaser.Scene):void {
  for(const a of manifest.assets)scene.load.image(sourceKey(a.name),`assets/loose/building-${a.name}.png`);
}
/** One shared texture per part/clan. Full source registration is preserved in the source pack. */
export function prepareBuildingArt(scene:Phaser.Scene):void {
  for(const a of manifest.assets){
    if(!scene.textures.exists(sourceKey(a.name)))continue;
    const src=scene.textures.get(sourceKey(a.name)).getSourceImage() as HTMLImageElement;
    for(const clan of [1,2]){
      const key=buildingKey(a.name,clan);if(scene.textures.exists(key))continue;
      const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(src,0,0);
      if(clan===1){const image=ctx.getImageData(0,0,canvas.width,canvas.height);remapPixels(image.data,2);ctx.putImageData(image,0,0);}
      const texture=scene.textures.addCanvas(key,canvas);if(!texture)continue;
      const t=a.trimFrame,sx=canvas.width/a.sourceSize[0],sy=canvas.height/a.sourceSize[1],x=Math.floor(t.x*sx),y=Math.floor(t.y*sy);
      texture.add('body',0,x,y,Math.min(canvas.width-x,Math.ceil((t.x+t.w)*sx)-x),Math.min(canvas.height-y,Math.ceil((t.y+t.h)*sy)-y));
    }
    scene.textures.remove(sourceKey(a.name));
  }
}

export interface BuildingAt {x:number;y:number;scale:number;visible:boolean;}
export interface BuildingRigPose {
  id:string;at:BuildingAt;clan:number;now:number;
  /** Projected local +X axis and local Y/X scale ratio, derived from neighbouring world points. */
  basisAngle?:number;foreshorten?:number;
  sun?:{x:number;y:number;z:number};daylight?:number;brightness?:number;
}
export interface TurretRigPose extends BuildingRigPose {angle:number;firedAt:number;groundMuzzle?:{x:number;y:number};}
export interface BuildingRigBounds {top:number;bottom:number;left:number;right:number;labelY:number;}
interface BuildingView {
  kind:'nexus'|'turret';clan:number;parts:Phaser.GameObjects.Image[];shadow:Phaser.GameObjects.Image;
  used:boolean;lastShot:number;barrel:number;
}
const NEXUS=['nexus-plinth','nexus-reactor','nexus-crown'];
const TOWER=['tower-foundation','tower-shaft','tower-head','tower-barrel','tower-barrel'];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const shade=(brightness:number):number=>{const n=Math.round(clamp(brightness,0,1)*255);return(n<<16)|(n<<8)|n;};
function shadowTexture(scene:Phaser.Scene):string {
  const key='building-ground-shadow';if(scene.textures.exists(key))return key;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(64,64,8,64,64,62);gradient.addColorStop(0,'rgba(3,10,24,.8)');gradient.addColorStop(.7,'rgba(3,10,24,.55)');gradient.addColorStop(1,'rgba(3,10,24,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);scene.textures.addCanvas(key,canvas);return key;
}

/** Fixed-Z layered sprite rig, with independent heads/barrels and ground-locked foundations. */
export class BuildingRigs {
  private views=new Map<string,BuildingView>();
  private flashes:Phaser.GameObjects.Graphics;
  constructor(private scene:Phaser.Scene){this.flashes=scene.add.graphics().setDepth(19.8);}
  begin():void {for(const view of this.views.values())view.used=false;this.flashes.clear();}
  private view(p:BuildingRigPose,kind:'nexus'|'turret'):BuildingView|null {
    const names=kind==='nexus'?NEXUS:TOWER;
    if(!p.at.visible||names.some(name=>!this.scene.textures.exists(buildingKey(name,p.clan))))return null;
    let view=this.views.get(p.id);
    if(view&&(view.kind!==kind||view.clan!==p.clan)){this.dispose(view);this.views.delete(p.id);view=undefined;}
    if(!view){
      const parts=names.map((name,i)=>this.scene.add.image(0,0,buildingKey(name,p.clan),'body').setDepth(16+i*.65));
      view={kind,clan:p.clan,parts,shadow:this.scene.add.image(0,0,shadowTexture(this.scene)).setDepth(12.6),used:true,lastShot:-1e9,barrel:0};
      this.views.set(p.id,view);
    }
    view.used=true;view.shadow.setVisible(true);view.parts.forEach(part=>part.setVisible(true));return view;
  }
  private point(p:BuildingRigPose,lift:number,forward=0,lateral=0,angle=p.basisAngle??0):{x:number;y:number} {
    const k=p.at.scale,b=p.basisAngle??0,c=Math.cos(angle),s=Math.sin(angle);
    return{x:p.at.x+(c*forward-s*lateral-Math.sin(b)*lift*.35)*k,y:p.at.y+(s*forward+c*lateral-Math.cos(b)*lift)*k};
  }
  private part(image:Phaser.GameObjects.Image,p:BuildingRigPose,width:number,lift:number,depthShade:number,rotation=p.basisAngle??0,forward=0,lateral=0,originY=.5):void {
    const at=this.point(p,lift,forward,lateral,rotation-Math.PI/2);
    image.setPosition(at.x,at.y).setOrigin(.5,originY).setRotation(rotation);
    image.setDisplaySize(width*p.at.scale,width*p.at.scale*image.frame.height/image.frame.width*clamp(p.foreshorten??1,.55,1.15));
    image.setTint(shade((p.brightness??1)*depthShade));
  }
  private shadow(view:BuildingView,p:BuildingRigPose,width:number,height:number,lift:number):void {
    const sun=p.sun??{x:-.6,y:-.5,z:.6},k=p.at.scale,reach=lift*.48;
    view.shadow.setPosition(p.at.x-sun.x*reach*k,p.at.y-sun.y*reach*k+8*k).setDisplaySize(width*k,height*k)
      .setRotation(p.basisAngle??0).setAlpha(.38*clamp(p.daylight??1,0,1));
  }
  drawTreasury(p:BuildingRigPose):BuildingRigBounds|null {
    const view=this.view(p,'nexus');if(!view)return null;
    this.shadow(view,p,265,190,100);
    this.part(view.parts[0],p,260,0,.91);
    this.part(view.parts[1],p,190,45,.97);
    this.part(view.parts[2],p,180,100,1);
    const k=p.at.scale;return{top:p.at.y-205*k,bottom:p.at.y+140*k,left:p.at.x-130*k,right:p.at.x+130*k,labelY:p.at.y+158*k};
  }
  drawTurret(p:TurretRigPose):boolean {
    const view=this.view(p,'turret');if(!view)return false;
    this.shadow(view,p,63,46,45);
    this.part(view.parts[0],p,44,0,.91);
    this.part(view.parts[1],p,29,20,.94);
    this.part(view.parts[2],p,48,40,.97,p.angle+Math.PI/2);
    if(p.firedAt>view.lastShot){view.lastShot=p.firedAt;view.barrel=1-view.barrel;}
    const age=p.now-p.firedAt;
    for(let side=0;side<2;side++){
      const barrel=view.parts[3+side],active=side===view.barrel&&age>=0&&age<180;
      const recoil=active?6*Math.exp(-age/65):0,lateral=side===0?-8:8;
      // The barrel source points up: its lower breech is the pivot, duplicated without pixel edits.
      const width=38*barrel.frame.width/barrel.frame.height;
      const at=this.point(p,42,4-recoil,lateral,p.angle);
      barrel.setPosition(at.x,at.y).setOrigin(.5,.9).setRotation(p.angle+Math.PI/2)
        .setDisplaySize(width*p.at.scale,38*p.at.scale*clamp(p.foreshorten??1,.55,1.15)).setTint(shade(p.brightness??1));
      if(active&&age<85){
        const q=this.point(p,42,39-recoil,lateral,p.angle),k=p.at.scale,c=Math.cos(p.angle),s=Math.sin(p.angle),g=this.flashes;
        g.fillStyle(0xffa766,.7*(1-age/85));g.fillTriangle(q.x+c*13*k,q.y+s*13*k,q.x-s*5*k,q.y+c*5*k,q.x+s*5*k,q.y-c*5*k);
        g.fillStyle(0xf1ffeb,1-age/85);g.fillCircle(q.x+c*3*k,q.y+s*3*k,3*k);
      }
    }
    return true;
  }
  end():void {for(const view of this.views.values())if(!view.used){view.shadow.setVisible(false);view.parts.forEach(part=>part.setVisible(false));}}
  private dispose(view:BuildingView):void {view.shadow.destroy();view.parts.forEach(part=>part.destroy());}
  destroy():void {for(const view of this.views.values())this.dispose(view);this.views.clear();this.flashes.destroy();}
}
