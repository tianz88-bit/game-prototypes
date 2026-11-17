import Phaser from 'phaser';
import { PLANETS, CLANS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { clientTune } from '../clientTune';
import { text } from '../scenes/common';
import { PlanetGround } from './planetGround';
import { panel, UI, css } from './ui';

interface Rect { x: number; y: number; w: number; h: number; }
interface Globe extends Rect { id: PlanetId; radius: number; ground: PlanetGround; }
export type MapAction = { kind: 'close' } | { kind: 'select' | 'warp'; planet: PlanetId } | { kind: 'joinAs' | 'chooseSide'; clan: number } | { kind: 'notify' };
/** Warzone round state from the server's planet list (owner, 17 November 2026). */
export interface WarStatus { phase: string; left: number }

const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
/** Warzone state in words for the map. */
export function warLabel(st: WarStatus | null | undefined): { text: string; open: boolean } {
  if (!st) return { text: 'Status unknown', open: true };
  switch (st.phase) {
    case 'countdown': return { text: `Starts in ${st.left}s · join now`, open: true };
    case 'war': case 'release': return { text: `Battle in progress · ${mmss(st.left)}`, open: false };
    case 'over': return { text: 'Round ending', open: false };
    case 'cooldown': return { text: `Opens in ${st.left}s`, open: false };
    default: return { text: 'Open · waiting for both sides', open: true };
  }
}

/** Territory rules are the existing game rules; no generated populations or resource estimates. */
export function planetIntel(id: PlanetId, clan: number): { relation: string; colour: number; resources: string; note: string } {
  const p = PLANETS.find(p => p.id === id)!;
  if (p.id === 'warzone') return { relation: 'CLAN WAR', colour: 0xff9a6a, resources: 'Temporary minerals · no banked rewards',
    note: 'Crimson attacks; Azure defends the Nexus. Destroy towers and shields to reach the Nexus. The map locks during battle.' };
  if (p.clan) {
    const own = p.clan === clan;
    return { relation: own ? 'FRIENDLY HOME' : 'ENEMY TERRITORY', colour: own ? 0x8bd9ba : UI.uiDanger,
      resources: own?'Minerals + fuel':'No mining for visitors',
      note: own ? 'Collect fuel, then dock at a Nexus pad to unload it.' : `${CLANS.find(c => c.id === p.clan)?.name} defence towers. Visitors cannot mine.` };
  }
  return { relation: p.bots ? 'DRONES + PVP' : 'OPEN PVP', colour: p.bots ? UI.uiDanger : UI.uiAccent,
    resources: 'Minerals + salvage · bank salvage by warping out',
    note: p.bots ? 'Enemy drones and rival pilots can attack you.' : 'No defence towers or drones. Other pilots can still attack you.' };
}

/** Five bounded uses of the actual terrain shader; shared textures, no per-frame canvas uploads. */
export class StellarMap {
  readonly planets: Globe[] = [];
  readonly closeButton: Rect;
  private orbit: Phaser.GameObjects.Graphics;
  private selection: Phaser.GameObjects.Graphics;
  private meta!:Phaser.GameObjects.Text;
  private detailTop=0;
  private short=false;
  private infoButton!:Rect;
  infoOpen=false;
  private infoClose:Rect|null=null;
  private infoObjects:Phaser.GameObjects.GameObject[]=[];
  private detail: Phaser.GameObjects.Text;
  private resource: Phaser.GameObjects.Text;
  private note: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;
  private populations = new Map<PlanetId, Phaser.GameObjects.Text>();
  private bounds: Rect;

  constructor(private scene: Phaser.Scene, w: number, h: number, private clan: number,
    public selected: PlanetId | null, private counts: Record<string, number> | null, private war: WarStatus | null = null, public notify = false) {
    const width = Math.min(960, w - 24), height = Math.min(610, h - 24);
    const left = (w - width) / 2, top = (h - height) / 2;
    this.bounds = { x: w / 2, y: h / 2, w: width, h: height };
    const g = scene.add.graphics().setDepth(200);
    g.fillStyle(0x020710, .88); g.fillRect(0, 0, w, h);
    panel(g, left, top, width, height, UI.uiAccent);
    // A chart, rather than a physically scaled solar system: destinations remain easy to tap.
    for (let i = 0; i < 48; i++) {
      const x = left + 18 + ((i * 113.7) % (width - 36));
      const y = top + 54 + ((i * 47.3) % Math.max(1, height - 174));
      g.fillStyle(i % 3 ? 0x5e7995 : 0xc7d9df, i % 3 ? .25 : .5); g.fillRect(x, y, i % 5 ? 1 : 2, 1);
    }
    text(scene, left + 20, top + 17, 'Choose a planet', 16, css(UI.uiText)).setDepth(204);
    this.closeButton = { x: left + width - 31, y: top + 28, w: 44, h: 40 };
    panel(g, this.closeButton.x - 22, top + 8, 44, 40, UI.uiBorder);
    text(scene, this.closeButton.x, top + 27, '×', 24).setOrigin(.5).setDepth(204);
    this.orbit = scene.add.graphics().setDepth(201);
    this.selection = scene.add.graphics().setDepth(203);
    const compact=height<420,narrow=width<560&&!compact;
    const short=this.short=height<280,detailHeight=narrow?160:short?104:136;
    const bodyTop = top + 56, bodyHeight = height - 56 - detailHeight;
    const radius=Math.max(14,Math.min(compact?34:48,bodyHeight/(narrow?8:3.2),width/14));
    this.orbit.lineStyle(1, UI.uiBorder, .5);
    this.orbit.strokeEllipse(w / 2, bodyTop + bodyHeight * .48, width * .85, bodyHeight * .55);
    PLANETS.forEach((p, i) => {
      // Five destinations (Warzone added 16 November 2026): a row of five, or a 2-2-1 grid when narrow.
      const x = narrow ? left + width * (i === 4 ? .5 : i % 2 ? .73 : .27) : left + width * [.11, .3, .5, .7, .89][i];
      const y = narrow ? bodyTop + bodyHeight * [.1,.1,.42,.42,.74][i] : bodyTop+bodyHeight*(compact?.22:[.48,.29,.56,.36,.5][i]);
      const tint: [number, number, number] = p.id === 'warzone' ? [1.4, .78, .5] : p.clan === 1 ? [1.35, .72, .74] : p.clan === 2 ? [.55, .82, 1.55] : p.id === 'alpha' ? [.8, .95, 1.08] : [1, .84, 1];
      const ground = new PlanetGround(scene, 202, tint, p.id==='warzone'?'warzone':undefined);
      const globe = { id: p.id, x, y, w: radius * 2 + 22, h: radius * 2 + 42, radius, ground };
      this.planets.push(globe);
      text(scene, x, y + radius + (short?5:9), (width<560&&!narrow&&p.clan&&p.id!=='warzone'?CLANS.find(c=>c.id===p.clan)!.name:p.label).toUpperCase(), short?9:compact?10:12, css(UI.uiText)).setOrigin(.5, 0).setDepth(204);
      this.populations.set(p.id, text(scene, x, y + radius + 24, '', 10, '#a5bdcf').setOrigin(.5, 0).setDepth(204).setVisible(!short));
    });
    const dy=this.detailTop=top+height-detailHeight;
    g.lineStyle(1,UI.uiBorder,.7).lineBetween(left+16,dy,left+width-16,dy);
    this.detail=text(scene,left+16,dy+(short?6:8),'',short?16:compact?18:20).setWordWrapWidth(width-100).setDepth(204);
    this.meta=text(scene,left+16,dy+(short?26:32),'',short?10:11,'#a5bdcf').setDepth(204);
    this.resource=text(scene,left+16,dy+(short?40:51),'',short?10:11,'#ebc17c').setWordWrapWidth(width-32).setDepth(204);
    this.note=text(scene,left+16,dy+68,'',11,'#9fb5c7').setWordWrapWidth(width-32).setDepth(204).setVisible(!short);
    this.prompt=text(scene,w/2,top+height-15,'',11,css(UI.uiAccent)).setOrigin(.5,1).setDepth(204);
    this.infoButton={x:left+width-42,y:dy+22,w:52,h:40};panel(g,this.infoButton.x-26,dy+2,52,40,UI.uiBorder);text(scene,this.infoButton.x,dy+22,'Info',11).setOrigin(.5).setDepth(204);
    this.showDetails(); this.setCounts(counts); this.update(0);
  }

  /** Warzone buttons under the details: side selection/join (no clan yet) or auto-join (closed). */
  private buttons: { action: MapAction; x: number; y: number; w: number; h: number }[] = [];
  private buttonGfx: Phaser.GameObjects.Graphics | null = null;
  private buttonTexts: Phaser.GameObjects.Text[] = [];

  setCounts(counts: Record<string, number> | null, war: WarStatus | null = this.war): void {
    this.war = war;
    this.counts = counts;
    for (const [id, t] of this.populations) t.setText(this.population(id));
    this.showDetails();
  }

  private population(id: PlanetId): string {
    const n = this.counts?.[id];
    const players = n === undefined || n < 0 ? 'Players unknown' : `${n} ${n === 1 ? 'player' : 'players'}`;
    return id === 'warzone' ? `${players}\n${warLabel(this.war).text.split(' · ')[0]}` : players;
  }

  private drawButtons():void{
    this.buttonGfx?.destroy();this.buttonTexts.forEach(t=>t.destroy());this.buttonTexts=[];this.buttons=[];
    if(this.selected!=='warzone')return;
    const b=this.bounds,y=b.y+b.h/2-30,g=this.buttonGfx=this.scene.add.graphics().setDepth(205),open=warLabel(this.war).open;
    const add=(label:string,x:number,w:number,colour:number,action:MapAction,on=false)=>{panel(g,x-w/2,y-22,w,44,colour,on);this.buttonTexts.push(text(this.scene,x,y,label,11,on?'#ffffff':css(colour)).setOrigin(.5).setDepth(206));this.buttons.push({action,x,y,w,h:44});};
    if(!this.clan){const bw=Math.min(170,(b.w-48)/2);add('CRIMSON · ATTACK',b.x-bw/2-5,bw,CLANS[0].colour,{kind:open?'joinAs':'chooseSide',clan:1});add('AZURE · DEFEND',b.x+bw/2+5,bw,CLANS[1].colour,{kind:open?'joinAs':'chooseSide',clan:2});}
    else if(!open)add(this.notify?'CANCEL AUTO-JOIN':'AUTO-JOIN WHEN OPEN',b.x,Math.min(240,b.w-32),UI.uiGold,{kind:'notify'},this.notify);
  }
  private showDetails():void{
    if(!this.selected){this.detail.setText('Where to?').setColor(css(UI.uiText));this.meta.setText('Tap a planet to see its details.');this.resource.setText('');this.note.setText('');this.prompt.setText('Tap a planet to select');this.drawButtons();return;}
    const p=PLANETS.find(p=>p.id===this.selected)!,intel=planetIntel(p.id,this.clan),war=p.id==='warzone'?warLabel(this.war):null;
    this.detail.setText(p.label).setColor(css(UI.uiText));this.meta.setText(`${intel.relation} · ${this.population(p.id).split('\n')[0]}`).setColor(css(intel.colour));if(this.short&&war)this.meta.setText(`${war.open?'OPEN':'CLOSED'} · ${this.population(p.id).split('\n')[0]}`);this.resource.setText(intel.resources);
    this.note.setText(war?war.text:'');
    this.prompt.setText(war&&(!this.clan||!war.open)?'':`Tap ${p.label} again to warp`);
    this.drawButtons();if(this.infoOpen)this.drawInfo();
  }
  private drawInfo():void{
    this.infoObjects.forEach(o=>o.destroy());this.infoObjects=[];
    const b=this.bounds,left=b.x-b.w/2+12,top=b.y-b.h/2+54,w=b.w-24,h=b.h-66,g=this.scene.add.graphics().setDepth(208);
    panel(g,left,top,w,h,UI.uiBorder);this.infoObjects.push(g);
    const add=(x:number,y:number,s:string,size=12)=>{const t=text(this.scene,x,y,s,size,'#dfe8ff').setDepth(209);this.infoObjects.push(t);return t;};
    add(left+16,top+14,this.selected?PLANETS.find(p=>p.id===this.selected)!.label:'Planet map',18);
    const message=this.selected?planetIntel(this.selected,this.clan).note:'Choose a planet to inspect its danger, players and resources. Tap it again to warp in.';
    const rules=add(left+16,top+48,message,this.short?10:12).setWordWrapWidth(w-32);
    if(this.selected==='warzone'&&!this.short)add(left+16,top+56+rules.height,'No banked rewards. Auto-join waits here until it opens.',11).setWordWrapWidth(w-32);
    this.infoClose={x:left+w/2,y:top+h-28,w:Math.min(180,w-32),h:44};panel(g,this.infoClose.x-this.infoClose.w/2,this.infoClose.y-22,this.infoClose.w,44,UI.uiBorder);add(this.infoClose.x,this.infoClose.y,'Back to map',12).setOrigin(.5);
  }
  tap(x:number,y:number):MapAction|null{
    const hit=(r:Rect)=>Math.abs(x-r.x)<=r.w/2&&Math.abs(y-r.y)<=r.h/2;
    if(hit(this.closeButton)||!hit(this.bounds))return{kind:'close'};
    if(this.infoOpen){if(this.infoClose&&hit(this.infoClose))this.dismissInfo();return null;}
    if(hit(this.infoButton)){this.infoOpen=true;this.drawInfo();return null;}
    const button=this.buttons.find(hit);if(button)return button.action;
    const p=this.planets.find(p=>Math.abs(x-p.x)<=p.w/2&&y>=p.y-p.radius-8&&y<=p.y+p.radius+40);if(!p)return null;
    if(this.selected===p.id){if(p.id==='warzone'&&(!warLabel(this.war).open||!this.clan))return null;return{kind:'warp',planet:p.id};}
    this.selected=p.id;this.showDetails();return{kind:'select',planet:p.id};
  }
  dismissInfo():boolean{if(!this.infoOpen)return false;this.infoOpen=false;this.infoObjects.forEach(o=>o.destroy());this.infoObjects=[];this.infoClose=null;return true;}

  update(time: number): void {
    this.selection.clear();
    this.planets.forEach((p, i) => {
      const size = Math.ceil(p.radius * 2.3), turn = time * .07 + i * 710;
      p.ground.update(size, size, p.radius / clientTune.render.planetRadius, {
        camera: { x: turn, y: i * 260 }, sun: { x: -.6, y: -.35, z: .72 }, daylight: .9, brightness: .9,
      });
      p.ground.setPosition(p.x - size / 2, p.y - size / 2);
      // Canvas compatibility: projected surface marks rotate over the shared disc as well.
      if (this.scene.game.renderer.type !== Phaser.WEBGL) {
        for (let j = 0; j < 14; j++) {
          const lon = j * 2.4 + time * .00024 + i, lat = Math.asin((j + .5) / 7 - 1);
          const z = Math.cos(lon) * Math.cos(lat); if (z <= .05) continue;
          const x = p.x + Math.sin(lon) * Math.cos(lat) * p.radius, y = p.y + Math.sin(lat) * p.radius;
          this.selection.lineStyle(1, 0xd7c4b0, .24 * z);
          this.selection.strokeEllipse(x, y, p.radius * .28 * z, p.radius * .2);
        }
        const shade: { x: number; y: number }[] = [];
        for (let j = 0; j <= 24; j++) { const a = -Math.PI / 2 + j * Math.PI / 24; shade.push({ x: p.x + Math.cos(a) * p.radius, y: p.y + Math.sin(a) * p.radius }); }
        for (let j = 24; j >= 0; j--) { const a = -Math.PI / 2 + j * Math.PI / 24; shade.push({ x: p.x + Math.cos(a) * p.radius * .22, y: p.y + Math.sin(a) * p.radius }); }
        this.selection.fillStyle(0x020710, .48); this.selection.fillPoints(shade, true);
      }
      if (p.id === this.selected) {
        this.selection.lineStyle(2, UI.uiGold, .8 + Math.sin(time / 250) * .18);
        this.selection.strokeCircle(p.x, p.y, p.radius + 7);
        this.selection.lineStyle(1, UI.uiGold, .22); this.selection.strokeCircle(p.x, p.y, p.radius + 11);
      }
    });
  }

  destroy(): void {this.infoObjects.forEach(o=>o.destroy());this.infoObjects=[]; for (const p of this.planets) p.ground.destroy(); this.buttonGfx?.destroy(); this.buttonTexts.forEach((t) => t.destroy()); }
}
