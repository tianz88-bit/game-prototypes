import type {Zone} from '../steroids-alpha/src/input/intents';
import {toLogical} from '../steroids-alpha/src/base';
/** Lab-only hold control. Device events remain in an input adapter, never in the scene/model. */
export class DuelHoldInput{
 zone:Zone|null=null;private pointers=new Set<number>();
 get held():boolean{return this.pointers.size>0;}
 clear():void{this.pointers.clear();}
 attach(canvas:HTMLElement):void{
  canvas.addEventListener('pointerdown',e=>{const p=toLogical(e.clientX,e.clientY),z=this.zone;if(z&&Math.abs(p.x-z.x)<=z.hw&&Math.abs(p.y-z.y)<=z.hh)this.pointers.add(e.pointerId);});
  window.addEventListener('pointerup',e=>this.pointers.delete(e.pointerId));window.addEventListener('pointercancel',e=>this.pointers.delete(e.pointerId));
  window.addEventListener('blur',()=>this.clear());
 }
}
