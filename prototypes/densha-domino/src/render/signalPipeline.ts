import Phaser from 'phaser';
import {tune} from '../tune';
import type {Dir} from '../game/types';
const sockets=new WeakMap<Phaser.GameObjects.Image,{shine:Phaser.GameObjects.Image;vertical:boolean;end:Dir}>();
/** Both layers use the normal sprite batch; no per-cab shader flush. */
export function attachSocketLight(image:Phaser.GameObjects.Image,vertical:boolean,end:Dir):Phaser.GameObjects.Image {
 const shine=image.scene.add.image(image.x,image.y,image.texture.key,image.frame.name).setDisplaySize(image.displayWidth,image.displayHeight).setVisible(false);
 shine.setTint(0xffc480);image.setTint(0xff791a);sockets.set(image,{shine,vertical,end});return shine;
}
export function updateSocketLight(image:Phaser.GameObjects.Image,active:boolean,moving:boolean,clock:number):void {
 const socket=sockets.get(image);
 if(!active){if(image.visible)image.setVisible(false);if(socket?.shine.visible)socket.shine.setVisible(false);return;}
 const phase=clock/tune.feel.lightFlashMs,pulse=moving?1:.12+.88*Math.pow(.5+.5*Math.cos(phase*Math.PI*2),2);
 image.setVisible(active).setAlpha(pulse);
 if(!socket)return;
 const {shine,vertical,end}=socket,w=image.frame.width,h=image.frame.height,half=Math.floor((vertical?h:w)/2);
 const band=(vertical?w:h)*.18,scan=(phase%1)*((vertical?w:h)+band)-band;
 const x=vertical?Math.max(0,scan):end<0?0:half,y=vertical?(end<0?0:half):Math.max(0,scan);
 const cw=vertical?Math.min(w,scan+band)-x:(end<0?half:w-half),ch=vertical?(end<0?half:h-half):Math.min(h,scan+band)-y;
 shine.setVisible(active&&cw>0&&ch>0).setAlpha(pulse).setCrop(x,y,Math.max(0,cw),Math.max(0,ch));
}
