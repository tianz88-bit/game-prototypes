import type Phaser from 'phaser';
import { clientTune } from '../clientTune';
import {flightControls} from './hudLayout';

/** One canvas material language for the menu, cards, HUD and touch controls. */
export const UI = clientTune.render;
export const css = (colour:number):string => '#'+colour.toString(16).padStart(6,'0');

/** Left edge of the fire button's enlarged hit area, with a small visual gutter. */
export function controlClearRight(w:number,h=0):number {
  const t=clientTune.touch;
  const c=flightControls(w,h,t.dashButtonMargin,t.dashButtonRadius,t.fireButtonRadius);
  return Math.min(...Object.values(c).map(c=>c.x-c.hw))-14;
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

export function flightButton(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,active=false,locked=false):void {
  g.fillStyle(locked?0x181d22:active?0x34404a:0x272e35,.97).fillRoundedRect(x,y,w,h,4);
  g.lineStyle(1,active?0xc5d2dc:0x9caab5,locked?.3:.65).strokeRoundedRect(x+.5,y+.5,w-1,h-1,4);
  g.lineStyle(1,0xc5d2dc,locked?.13:.42).lineBetween(x+6,y+3,x+w-6,y+3);
}

export function flightControlFace(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,active:boolean):void {
  g.fillStyle(0x14191e,.9).fillCircle(x,y+2,r+1);
  g.fillStyle(active?0x303942:0x20262c,.95).fillCircle(x,y,r);
  g.lineStyle(1.5,active?0xc5d2dc:0x88949f,active?.9:.55).strokeCircle(x,y,r-1);
  g.lineStyle(1,0xc5d2dc,active?.5:.22);g.beginPath();g.arc(x,y,r-4,Math.PI*1.18,Math.PI*1.82);g.strokePath();
}

export function controlFace(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,accent:number,active:boolean):void {
  g.fillStyle(0x071425,.9);g.fillCircle(x,y+3,r+1);
  g.fillStyle(active?0x254463:UI.uiPanel,active?.96:.87);g.fillCircle(x,y,r);
  g.lineStyle(3,0x071425,1);g.strokeCircle(x,y,r);
  g.lineStyle(2,accent,active?1:.65);g.strokeCircle(x,y,r-2);
  g.lineStyle(2,0xffedc7,.24);g.beginPath();g.arc(x,y,r-6,Math.PI*1.15,Math.PI*1.85);g.strokePath();
}
