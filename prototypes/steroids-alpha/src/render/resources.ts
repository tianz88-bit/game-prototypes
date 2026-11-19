import type Phaser from 'phaser';
import type {PickupKind} from '../../sim/pickups';
export const RESOURCE_ART={mineral:{asset:'mineral-cluster',colour:0xffc14a,label:'MIN'},salvage:{asset:'salvage-case',colour:0xbd7cf6,label:'SALVAGE'},fuel:{asset:'fuel-canister',colour:0x4de0ed,label:'FUEL'},heal:{asset:'health-pod',colour:0x82e6a0,label:'REPAIR'}} as const;
/** Small solid fallback glyphs share silhouettes/palette with the painted bodies. No extra emitters. */
export function resourceGlyph(g:Phaser.GameObjects.Graphics,kind:PickupKind,x:number,y:number,size:number):void{
 const k=size/16,c=RESOURCE_ART[kind].colour,poly=(p:number[][],fill:number)=>{g.fillStyle(fill);g.fillPoints(p.map(([a,b])=>({x:x+a*k,y:y+b*k})),true)};
 if(kind==='mineral'){poly([[-7,2],[-5,-4],[-1,-1],[1,-7],[5,-3],[4,4],[0,7],[-5,6]],0x08162b);poly([[-5,2],[-4,-2],[-1,1],[1,-5],[3,-2],[2,4],[0,5],[-4,4]],c);poly([[0,-2],[1,-4],[2,-2],[1,3]],0xffefd0);return;}
 if(kind==='heal'){g.fillStyle(0x102634);g.fillRoundedRect(x-7*k,y-6*k,14*k,12*k,2*k);g.fillStyle(0xffeed0);g.fillRect(x-5*k,y-4*k,10*k,8*k);g.fillStyle(c);g.fillRect(x-1.5*k,y-4*k,3*k,8*k);g.fillRect(x-4*k,y-1.5*k,8*k,3*k);return;}
 if(kind==='salvage'){g.fillStyle(0x09172c);g.fillRoundedRect(x-7*k,y-5*k,14*k,11*k,2*k);g.fillStyle(c);g.fillRoundedRect(x-5*k,y-3*k,10*k,7*k,k);g.lineStyle(2*k,0xffe8b9);g.lineBetween(x-3*k,y-2*k,x-3*k,y+3*k);g.lineBetween(x+3*k,y-2*k,x+3*k,y+3*k);g.lineStyle(k,c);g.strokeRect(x-2*k,y-7*k,4*k,2*k);return;}
 g.fillStyle(0x08162b);g.fillRoundedRect(x-4*k,y-7*k,8*k,14*k,2*k);g.fillStyle(c);g.fillRoundedRect(x-3*k,y-4*k,6*k,9*k,2*k);g.fillStyle(0x245ec7);g.fillRect(x-2.5*k,y-7*k,5*k,2*k);poly([[0,-3],[-2,1],[0,1],[-1,4],[2,-1],[0,-1]],0xfff0cd);
}
