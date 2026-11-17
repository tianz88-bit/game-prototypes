import Phaser from 'phaser';
import manifest from '../../art/buildings-v1/assets.json';
import damageManifest from '../../art/warzone-v1/assets.json';
import { damageStage, durability } from './buildingCondition';
import { clanArtColours, colourCss, remapBuildingPixels } from './buildingMaterials';
import { buildingPoint, buildingShadowPolygon, TOWER_BARREL_LIFT, TOWER_HEAD_LIFT } from './buildingGeometry';
import type { BuildingRigPose } from './buildingGeometry';
export type { BuildingAt, BuildingRigPose } from './buildingGeometry';

const sourceKey=(name:string)=>`building-src-${name}`;
const assets=[...manifest.assets,...damageManifest.assets];
export const buildingKey=(name:string,clan:number)=>`building-${name}-${clan===1?1:2}`;
export function queueBuildingArt(scene:Phaser.Scene):void {
  for(const a of assets)scene.load.image(sourceKey(a.name),`assets/loose/building-${a.name}.png`);
}
/** One shared texture per part/clan. Full source registration is preserved in the source pack. */
export function prepareBuildingArt(scene:Phaser.Scene):void {
  for(const a of assets){
    if(!scene.textures.exists(sourceKey(a.name)))continue;
    const src=scene.textures.get(sourceKey(a.name)).getSourceImage() as HTMLImageElement;
    for(const clan of [1,2]){
      const key=buildingKey(a.name,clan);if(scene.textures.exists(key))continue;
      const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(src,0,0);
      const image=ctx.getImageData(0,0,canvas.width,canvas.height);remapBuildingPixels(image.data,clan);ctx.putImageData(image,0,0);
      const texture=scene.textures.addCanvas(key,canvas);if(!texture)continue;
      const t=a.trimFrame,sx=canvas.width/a.sourceSize[0],sy=canvas.height/a.sourceSize[1],x=Math.floor(t.x*sx),y=Math.floor(t.y*sy);
      texture.add('body',0,x,y,Math.min(canvas.width-x,Math.ceil((t.x+t.w)*sx)-x),Math.min(canvas.height-y,Math.ceil((t.y+t.h)*sy)-y));
    }
    scene.textures.remove(sourceKey(a.name));
  }
}

export interface TurretRigPose extends BuildingRigPose {angle:number;firedAt:number;groundMuzzle?:{x:number;y:number};}
export interface BuildingRigBounds {top:number;bottom:number;left:number;right:number;labelY:number;}
interface BuildingView {
  kind:'nexus'|'turret';clan:number;parts:Phaser.GameObjects.Image[];shadow:Phaser.GameObjects.Image;
  columns:Phaser.GameObjects.Image[];cast:Phaser.GameObjects.Graphics;
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

/** Baked, shared steel cylinder. Discrete side planes, collars and bolts match the painted kit. */
function columnTexture(scene:Phaser.Scene,clan:number):string {
  const key=`building-column-${clan===1?1:2}`;if(scene.textures.exists(key))return key;
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=160;
  const c=canvas.getContext('2d')!,p=clanArtColours(clan),body=colourCss(p.structure);
  c.fillStyle=colourCss(p.dark);c.fillRect(3,10,90,140);c.beginPath();c.ellipse(48,150,45,9,0,0,Math.PI*2);c.fill();
  c.fillStyle=body;c.fillRect(6,10,84,139);
  c.fillStyle=colourCss(p.shade);c.fillRect(7,10,13,138);c.fillRect(78,10,11,138);
  c.fillStyle='#8c9394';c.globalAlpha=.3;c.fillRect(28,12,8,134);c.globalAlpha=1;
  for(const y of [20,132]){
    c.fillStyle=colourCss(p.dark);c.fillRect(6,y,84,6);
    c.fillStyle=body;c.fillRect(7,y+1,82,2);
    c.fillStyle='#aaa99e';for(const x of [20,69])c.fillRect(x,y+1,4,3);
  }
  c.fillStyle=colourCss(p.dark);c.beginPath();c.ellipse(48,10,45,10,0,0,Math.PI*2);c.fill();
  c.fillStyle=body;c.beginPath();c.ellipse(48,9,41,7,0,0,Math.PI*2);c.fill();
  scene.textures.addCanvas(key,canvas);return key;
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
      const columns=[0,1].map(i=>this.scene.add.image(0,0,columnTexture(this.scene,p.clan)).setDepth(16.3+i*.65));
      view={kind,clan:p.clan,parts,columns,cast:this.scene.add.graphics().setDepth(12.5),shadow:this.scene.add.image(0,0,shadowTexture(this.scene)).setDepth(12.6),used:true,lastShot:-1e9,barrel:0};
      this.views.set(p.id,view);
    }
    view.used=true;view.shadow.setVisible(true);view.cast.setVisible(true);view.parts.forEach(part=>part.setVisible(true));view.columns.forEach(part=>part.setVisible(true));return view;
  }
  private point(p:BuildingRigPose,lift:number,forward=0,lateral=0,angle=p.basisAngle??0):{x:number;y:number} {
    return buildingPoint(p,lift,forward,lateral,angle);
  }
  private part(image:Phaser.GameObjects.Image,p:BuildingRigPose,width:number,lift:number,depthShade:number,rotation=p.basisAngle??0,forward=0,lateral=0,originY=.5):void {
    const at=this.point(p,lift,forward,lateral,rotation-Math.PI/2);
    image.setPosition(at.x,at.y).setOrigin(.5,originY).setRotation(rotation);
    image.setDisplaySize(width*p.at.scale,width*p.at.scale*image.frame.height/image.frame.width*clamp(p.foreshorten??1,.55,1.15));
    image.setTint(shade((p.brightness??1)*depthShade));
  }
  private shadow(view:BuildingView,p:BuildingRigPose,width:number,height:number,lift:number):void {
    const k=p.at.scale,day=clamp(p.daylight??1,0,1);
    // Contact never slides away from the foundation. Night only removes the directional cast.
    view.shadow.setPosition(p.at.x,p.at.y).setDisplaySize(width*k,height*k*clamp(p.foreshorten??1,.55,1.15))
      .setRotation(p.basisAngle??0).setAlpha(.18+.12*day);
    const points=buildingShadowPolygon(p,width*.82,height*.72,lift);
    view.cast.clear();if(day>.001&&points.length>=3)view.cast.fillStyle(0x07101b,.25*day).fillPoints(points,true);
  }
  private column(image:Phaser.GameObjects.Image,p:BuildingRigPose,from:number,to:number,width:number):void {
    const a=this.point(p,from),b=this.point(p,to),length=Math.hypot(b.x-a.x,b.y-a.y);
    image.setPosition((a.x+b.x)/2,(a.y+b.y)/2).setRotation(Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2)
      .setScale(width*p.at.scale/90,length/140).setTint(shade(p.brightness??1));
  }
  private skin(image:Phaser.GameObjects.Image,name:string,p:BuildingRigPose):void {
    const key=buildingKey(name,p.clan);
    if(this.scene.textures.exists(key)&&image.texture.key!==key)image.setTexture(key,'body');
  }
  private condition(p:BuildingRigPose,width:number,lift:number):void {
    if(p.health===undefined)return;
    const h=durability(p.health),stage=damageStage(h),k=p.at.scale,g=this.flashes;
    const q=this.point(p,0),y=q.y+width*.64*k,step=width*k/10;
    g.fillStyle(0x091420,.82);g.fillRoundedRect(q.x-width*k/2-3*k,y-3*k,width*k+6*k,7*k,2*k);
    for(let i=0;i<10;i++){
      const fill=Math.max(0,Math.min(1,h*10-i));
      g.fillStyle(0x586374,.4);g.fillRect(q.x-width*k/2+i*step,y,step-k,2*k);
      if(fill>0){g.fillStyle(h<.3?0xff8872:h<.65?0xffc17a:clanArtColours(p.clan).glow,.9);g.fillRect(q.x-width*k/2+i*step,y,(step-k)*fill,2*k);}
    }
    if(stage==='healthy'||stage==='destroyed')return;
    const root=this.point(p,lift),count=stage==='critical'?5:2;
    // Bounded, deterministic square embers/soot: no emitters or per-frame game objects.
    for(let i=0;i<count;i++){
      const phase=((p.now/1600+i*.237)%1),dx=Math.sin(i*4.7)*width*.19*k;
      g.fillStyle(i%2?0x222735:0xffb87d,(1-phase)*(stage==='critical'?.55:.3));
      const size=(i%2?5:2)*k;g.fillRect(root.x+dx+phase*7*k,root.y-phase*24*k,size,size*(i%2?1:2));
    }
  }
  drawTreasury(p:BuildingRigPose):BuildingRigBounds|null {
    const view=this.view(p,'nexus');if(!view)return null;
    const stage=damageStage(p.health),damaged=stage!=='healthy';
    this.skin(view.parts[1],damaged?'nexus-reactor-damaged':'nexus-reactor',p);
    this.skin(view.parts[2],damaged?'nexus-crown-damaged':'nexus-crown',p);
    this.shadow(view,p,265,190,100);
    this.column(view.columns[0],p,0,45,160);this.column(view.columns[1],p,45,100,92);
    this.part(view.parts[0],p,260,0,.91);
    this.part(view.parts[1],p,190,45,.97);
    this.part(view.parts[2],p,180,100,1);
    if(stage==='destroyed'){view.parts[1].setTint(shade(.38*(p.brightness??1)));view.parts[2].setTint(shade(.32*(p.brightness??1)));}
    this.condition(p,140,100);
    const k=p.at.scale;return{top:p.at.y-205*k,bottom:p.at.y+140*k,left:p.at.x-130*k,right:p.at.x+130*k,labelY:p.at.y+158*k};
  }
  drawTurret(p:TurretRigPose):boolean {
    const view=this.view(p,'turret');if(!view)return false;
    const stage=damageStage(p.health);
    this.skin(view.parts[0],stage==='destroyed'?'tower-wreck':'tower-foundation',p);
    this.skin(view.parts[2],stage==='healthy'?'tower-head':'tower-head-damaged',p);
    if(stage==='destroyed'){
      this.shadow(view,p,63,46,8);this.part(view.parts[0],p,55,0,.85);
      view.parts.slice(1).forEach(part=>part.setVisible(false));view.columns.forEach(part=>part.setVisible(false));
      view.lastShot=p.firedAt;this.condition(p,46,0);return true;
    }
    this.shadow(view,p,63,46,TOWER_BARREL_LIFT);
    this.column(view.columns[0],p,0,20,19);this.column(view.columns[1],p,20,TOWER_HEAD_LIFT,20);
    this.part(view.parts[0],p,44,0,.91);
    this.part(view.parts[1],p,29,20,.94);
    this.part(view.parts[2],p,48,TOWER_HEAD_LIFT,.97,p.angle+Math.PI/2);
    if(p.firedAt>view.lastShot){view.lastShot=p.firedAt;view.barrel=1-view.barrel;}
    const age=p.now-p.firedAt;
    for(let side=0;side<2;side++){
      const barrel=view.parts[3+side],active=side===view.barrel&&age>=0&&age<180;
      const recoil=active?6*Math.exp(-age/65):0,lateral=side===0?-8:8;
      // The barrel source points up: its lower breech is the pivot, duplicated without pixel edits.
      const width=38*barrel.frame.width/barrel.frame.height;
      const at=this.point(p,TOWER_BARREL_LIFT,4-recoil,lateral,p.angle);
      barrel.setPosition(at.x,at.y).setOrigin(.5,.9).setRotation(p.angle+Math.PI/2)
        .setDisplaySize(width*p.at.scale,38*p.at.scale*clamp(p.foreshorten??1,.55,1.15)).setTint(shade(p.brightness??1));
      if(active&&age<85){
        const q=this.point(p,TOWER_BARREL_LIFT,39-recoil,lateral,p.angle),k=p.at.scale,c=Math.cos(p.angle),s=Math.sin(p.angle),g=this.flashes;
        g.fillStyle(0xffa766,.7*(1-age/85));g.fillTriangle(q.x+c*13*k,q.y+s*13*k,q.x-s*5*k,q.y+c*5*k,q.x+s*5*k,q.y-c*5*k);
        g.fillStyle(0xf1ffeb,1-age/85);g.fillCircle(q.x+c*3*k,q.y+s*3*k,3*k);
      }
    }
    this.condition(p,46,TOWER_HEAD_LIFT);return true;
  }
  end():void {for(const view of this.views.values())if(!view.used){view.shadow.setVisible(false);view.cast.setVisible(false);view.parts.forEach(part=>part.setVisible(false));view.columns.forEach(part=>part.setVisible(false));}}
  private dispose(view:BuildingView):void {view.shadow.destroy();view.cast.destroy();view.parts.forEach(part=>part.destroy());view.columns.forEach(part=>part.destroy());}
  destroy():void {for(const view of this.views.values())this.dispose(view);this.views.clear();this.flashes.destroy();}
}
