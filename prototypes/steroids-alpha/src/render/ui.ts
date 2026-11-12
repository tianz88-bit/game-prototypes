import type Phaser from 'phaser';
import { clientTune } from '../clientTune';

/** One canvas material language for the menu, cards, HUD and touch controls. */
export const UI = clientTune.render;
export const css = (colour:number):string => '#'+colour.toString(16).padStart(6,'0');

export function panel(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,
  accent=UI.uiBorder,active=false):void {
  const r=Math.max(0,Math.min(UI.uiRadius,h/3));
  g.fillStyle(0x050b15,.4);g.fillRoundedRect(x,y+3,w,h,r);
  g.fillStyle(UI.uiPanel,active?.98:.9);g.fillRoundedRect(x,y,w,h,r);
  g.lineStyle(active?1.7:1,accent,active?1:.8);g.strokeRoundedRect(x,y,w,h,r);
  g.lineStyle(1,UI.uiText,.12);g.lineBetween(x+r,y+2,x+w-r,y+2);
  g.fillStyle(accent,active?.95:.6);g.fillRect(x+1,y+r,2,Math.max(1,h-r*2));
}

export function controlFace(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,accent:number,active:boolean):void {
  g.fillStyle(UI.uiPanel,active?.95:.82);g.fillCircle(x,y,r);
  g.lineStyle(2,accent,active?1:.65);g.strokeCircle(x,y,r);
  g.lineStyle(1,accent,.18);g.strokeCircle(x,y,r-5);
}
