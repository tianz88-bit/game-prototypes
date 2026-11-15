import type Phaser from 'phaser';
import { clientTune } from '../clientTune';

/** One canvas material language for the menu, cards, HUD and touch controls. */
export const UI = clientTune.render;
export const css = (colour:number):string => '#'+colour.toString(16).padStart(6,'0');

/** Left edge of the fire button's enlarged hit area, with a small visual gutter. */
export function controlClearRight(w:number):number {
  const t=clientTune.touch;
  return w-t.dashButtonMargin*2-t.dashButtonRadius*2-t.fireButtonRadius-t.fireButtonRadius*1.2-14;
}

export function panel(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,
  accent=UI.uiBorder,active=false):void {
  const r=Math.max(0,Math.min(UI.uiRadius,h/3));
  g.fillStyle(0x060e20,.85);g.fillRoundedRect(x-1,y+3,w+2,h,r);
  g.fillStyle(active?0x203955:UI.uiPanel,.96);g.fillRoundedRect(x,y,w,h,r);
  g.lineStyle(2,0x081426,1);g.strokeRoundedRect(x,y,w,h,r);
  g.lineStyle(1,accent,active?1:.65);g.strokeRoundedRect(x+1,y+1,w-2,h-2,r);
  g.lineStyle(2,0xffedc7,active?.3:.13);g.lineBetween(x+r+3,y+3,x+w-r-3,y+3);
  g.fillStyle(accent,active?1:.65);g.fillRoundedRect(x+3,y+5,3,Math.max(2,h-10),1);
}

export function controlFace(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,accent:number,active:boolean):void {
  g.fillStyle(0x071425,.9);g.fillCircle(x,y+3,r+1);
  g.fillStyle(active?0x254463:UI.uiPanel,active?.96:.87);g.fillCircle(x,y,r);
  g.lineStyle(3,0x071425,1);g.strokeCircle(x,y,r);
  g.lineStyle(2,accent,active?1:.65);g.strokeCircle(x,y,r-2);
  g.lineStyle(2,0xffedc7,.24);g.beginPath();g.arc(x,y,r-6,Math.PI*1.15,Math.PI*1.85);g.strokePath();
}
