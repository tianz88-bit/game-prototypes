import type Phaser from 'phaser';
import { paletteTexture, profileFor } from './shipArt';
import { depth, layerBrightness, pose } from './shipRig';
import { chassisStats } from '../../sim/chassis';
import { TUNE } from '../../sim/tune';

/** Hangar previews turn this many degrees per second (owner, 15 November 2026). */
const SPIN_DEG_PER_SEC = 45;

export interface PreviewOptions {
  /** Turn slowly on the rig, as the ship does in flight. */
  spin?: boolean;
  /**
   * Draw at the ship's real size relative to the others (owner): the largest ship (the Battlecruiser)
   * fills the slot and smaller ships shrink by their hit radius.
   */
  relative?: boolean;
}

/** Real rig parts, fitted to a menu slot; no ground effects or gameplay objects. */
export function shipPreview(scene: Phaser.Scene, chassis: number, palette: number, x: number, y: number, w: number, h: number, opts: PreviewOptions = {}): Phaser.GameObjects.Container {
  const p = profileFor(chassis), cal = p.calibration;
  const box = scene.add.container(x,y);
  const parts: { m: (typeof p.modules)[number]; img: Phaser.GameObjects.Image }[] = [];
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const m of [...p.modules].sort((a,b)=>depth(a,cal,p.modules)-depth(b,cal,p.modules))){
    if(m.asset==='turret-head' && Number(m.id.slice(-1))>=chassisStats(chassis,TUNE).baseTurrets)continue;
    const key=paletteTexture(scene,p,m.asset,palette);
    if(!scene.textures.exists(key))continue;
    const at=pose(m,0,cal,0,0,0,0,p.modules);
    const img=scene.add.image(at.x,at.y,key).setFlipX(!!m.mirror);
    img.setScale(cal.modules[m.id].width/img.width);
    const v=Math.round(255*layerBrightness(m,cal,p.modules));img.setTint((v<<16)|(v<<8)|v);
    box.add(img);
    parts.push({ m, img });
    left=Math.min(left,at.x-img.displayWidth/2);right=Math.max(right,at.x+img.displayWidth/2);
    top=Math.min(top,at.y-img.displayHeight/2);bottom=Math.max(bottom,at.y+img.displayHeight/2);
  }
  if(!Number.isFinite(left))return box;
  const cx=(left+right)/2,cy=(top+bottom)/2;
  for(const {img} of parts){img.x-=cx;img.y-=cy;}
  if(!opts.spin && !opts.relative){
    box.setScale(Math.min(w/(right-left),h/(bottom-top)));
    return box;
  }
  // Turning or sized against other ships: fit a circle that holds the ship at any heading.
  const reach=Math.max(...parts.map(({img})=>Math.hypot(Math.abs(img.x)+img.displayWidth/2,Math.abs(img.y)+img.displayHeight/2)));
  const radius=(c:number)=>chassisStats(c,TUNE).radius;
  const share=opts.relative?radius(chassis)/Math.max(radius(0),radius(1),radius(2)):1;
  box.setScale((Math.min(w,h)/2)*share/reach);
  if(opts.spin){
    const turn=(time:number)=>{
      if(!box.active)return;
      const angle=(time/1000*SPIN_DEG_PER_SEC)%360;
      for(const {m,img} of parts){const at=pose(m,angle,cal,time,1,0,0,p.modules);img.setPosition(at.x-cx,at.y-cy).setRotation(at.rotation);}
    };
    turn(scene.time.now);
    const onUpdate=(time:number)=>turn(time);
    scene.events.on('update',onUpdate);
    box.once('destroy',()=>scene.events.off('update',onUpdate));
  }
  return box;
}
