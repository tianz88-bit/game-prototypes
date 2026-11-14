import type Phaser from 'phaser';
import { paletteTexture, profileFor } from './shipArt';
import { depth, layerBrightness, pose } from './shipRig';

/** Real rig parts, fitted to a menu slot; no ground effects or gameplay objects. */
export function shipPreview(scene: Phaser.Scene, chassis: number, palette: number, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const p = profileFor(chassis), cal = p.calibration;
  const box = scene.add.container(x,y);
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const m of [...p.modules].sort((a,b)=>depth(a,cal,p.modules)-depth(b,cal,p.modules))){
    const key=paletteTexture(scene,p,m.asset,palette);
    if(!scene.textures.exists(key))continue;
    const at=pose(m,0,cal,0,0,0,0,p.modules);
    const img=scene.add.image(at.x,at.y,key).setFlipX(!!m.mirror);
    img.setScale(cal.modules[m.id].width/img.width);
    const v=Math.round(255*layerBrightness(m,cal,p.modules));img.setTint((v<<16)|(v<<8)|v);
    box.add(img);
    left=Math.min(left,at.x-img.displayWidth/2);right=Math.max(right,at.x+img.displayWidth/2);
    top=Math.min(top,at.y-img.displayHeight/2);bottom=Math.max(bottom,at.y+img.displayHeight/2);
  }
  if(Number.isFinite(left)){
    for(const child of box.list){const img=child as Phaser.GameObjects.Image;img.x-=(left+right)/2;img.y-=(top+bottom)/2;}
    box.setScale(Math.min(w/(right-left),h/(bottom-top)));
  }
  return box;
}
