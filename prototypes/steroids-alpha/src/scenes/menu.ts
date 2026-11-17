import { selectedFighter } from '../../sim/unlocks';
import { combatKey } from '../render/combatSprites';
import { shipPreview } from '../render/shipPreview';
import { PALETTES } from '../render/palette';
// Main menu: name, clan, loadout and a two-step destination choice through the Warp stellar map.
import Phaser from 'phaser';
import { CLANS, PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { TUTORIAL } from '../../sim/planets';
import { guide } from '../tutorial/guide';
import { SHARE_URL, logicalSize, serverOrigin } from '../base';
import QRCode from 'qrcode';
import { goImmersive } from '../input/immersive';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';
import { cleanName } from '../../sim/protocol';
import { loadSave, writeSave } from '../save';
import { clientTune } from '../clientTune';
import { UI, css, panel } from '../render/ui';
import { ensureAccount, recoverAccount } from '../net/account';
import {landingLayout,menuDialog} from '../render/landingLayout';
import { StellarMap, warLabel } from '../render/stellarMap';
import type { WarStatus } from '../render/stellarMap';

export interface MenuButton {
  id: PlanetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Phones only open their keyboard when the player taps a real text field themselves (a field focused
 * from script does not count on iOS, and a touch's pointerdown is not a user gesture). So the name box
 * is drawn on the canvas and one see-through input element sits exactly on top of it: the tap lands on
 * the field and the browser opens the keyboard. Nothing else on the page is DOM.
 */
let field: HTMLInputElement | null = null;
function nameField(): HTMLInputElement {
  if (!field) {
    field = document.createElement('input');
    field.type = 'text';
    field.maxLength = 16;
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('aria-label', 'Pilot name');
    field.enterKeyHint = 'done';
    // 16px stops iOS zooming in. The canvas draws the text and caret, so the field shows nothing itself.
    field.style.cssText =
      'position:fixed;display:none;margin:0;padding:0;border:0;outline:none;background:transparent;' +
      'color:transparent;caret-color:transparent;font-size:16px;z-index:5;touch-action:manipulation;';
    // Inside the game's container, so it turns with the game when drawn sideways (base.placeContainer);
    // the container's transform makes this fixed field position in the game's logical space.
    (document.getElementById('app') ?? document.body).appendChild(field);
  }
  return field;
}

export class MenuScene extends Phaser.Scene {
  buttons: MenuButton[] = [];
  nameBox = { x: 0, y: 0, w: 0, h: 0 };
  clanButtons: { id: number; x: number; y: number; w: number; h: number }[] = [];
  /** PC controls setting (owner, 16 November 2026): mouse marker (default) or keyboard steering. */
  controlButtons: { id: 'marker' | 'craft'; x: number; y: number; w: number; h: number }[] = [];
  /** KEY HINTS on/off (PC only). */
  hintButtons: { on: boolean; x: number; y: number; w: number; h: number }[] = [];
  private nameText!: Phaser.GameObjects.Text;
  private nameFrame!: Phaser.GameObjects.Rectangle;
  warpButton: { x: number; y: number; w: number; h: number } | null = null;
  stellarMap: StellarMap | null = null;
  private mapOpen = false;
  private selectedPlanet: PlanetId | null = null;
  /** Tutorial planet (owner, 16 November 2026): single player, from the menu only. */
  private tutorialButton: { x: number; y: number; w: number; h: number } | null = null;
  utility:'settings'|'account'|'share'|null=null;
  utilityButtons:{id:string;x:number;y:number;w:number;h:number}[]=[];
  panelClose:{x:number;y:number;w:number;h:number}|null=null;
  restoreButton:{x:number;y:number;w:number;h:number}|null=null;
  settingsTabs:{id:'clan'|'controls';x:number;y:number;w:number;h:number}[]=[];
  settingsTab:'clan'|'controls'='clan';
  heroPreview:Phaser.GameObjects.Container|null=null;
  private warpPulse!: Phaser.GameObjects.Graphics;
  shareBox:{x:number;y:number;size:number}|null=null;
  private shareHint!:Phaser.GameObjects.Text;
  private shareHintUntil=0;

  constructor() {
    super('menu');
  }

  create(): void {
    this.utility=null;this.codeMode=false;
    this.mapOpen = false;
    this.selectedPlanet = null;
    this.layout();
    this.game.events.on('dpr', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('dpr', this.layout, this);
      const f = nameField();
      f.blur();
      f.style.display = 'none';
      intents.textBox = null;
      intents.copyZone = null;
      this.stellarMap?.destroy();
      this.stellarMap = null;
    });
    nameField().onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      if (this.codeMode) void this.submitCode();
      nameField().blur();
    };
    intents.drainTaps();
    void this.refreshAccount();
  }

  /** Bank balance (null until known, or when the bank is unreachable) and the account panel state. */
  credits: number | null = null;
  unlocks: string[] = [];
  private codeMode = false;
  private accountNote = '';
  private recoveryPending=false;
  private async refreshAccount(): Promise<void> {
    const a = await ensureAccount();
    this.credits = a?.balance ?? null;
    this.unlocks = a?.unlocks ?? [];
    if (this.scene.isActive()) this.layout();
  }

  /** Restore: the name box takes a recovery code instead; Enter (or RESTORE again) submits. */
  private async submitCode(): Promise<void> {
    if(this.recoveryPending)return;this.recoveryPending=true;
    const code = nameField().value;
    this.accountNote = 'Checking code…';
    this.layout();
    const r = await recoverAccount(code);
    if ('error' in r) this.accountNote = r.error;
    else {
      this.credits = r.balance;
      this.unlocks = r.unlocks;
      this.accountNote = 'Account restored';
      this.codeMode = false;
      nameField().value = loadSave().name ?? '';
    }
    this.recoveryPending=false;
    if (this.scene.isActive()) this.layout();
  }

  accountButton: { x: number; y: number; w: number; h: number } | null = null;
  hangarButton: { x: number; y: number; w: number; h: number } | null = null;
  private drawName(x:number,y:number,w:number,label:string,depth=0):void{
    const f=nameField();this.nameBox={x,y,w,h:40};
    text(this,x-w/2,y-31,label,10,'#9fb3c7').setDepth(depth);
    panel(this.add.graphics().setDepth(depth),x-w/2,y-20,w,40,UI.uiBorder);
    this.nameFrame=this.add.rectangle(x,y,w,40,UI.uiPanel,1).setStrokeStyle(1,UI.uiBorder).setDepth(depth);
    this.nameText=text(this,x-w/2+10,y,'',16).setOrigin(0,.5).setDepth(depth+1);
    if(document.activeElement!==f&&!this.codeMode)f.value=loadSave().name??'';
    f.maxLength=this.codeMode?64:16;f.setAttribute('aria-label',this.codeMode?'Recovery code':'Pilot name');
    Object.assign(f.style,{display:'block',left:`${x-w/2}px`,top:`${y-20}px`,width:`${w}px`,height:'40px'});
    intents.textBox={zone:{x,y,hw:w/2,hh:20},field:f};
  }

  private layout():void{
    this.stellarMap?.destroy();this.stellarMap=null;
    this.children.getAll().forEach(child=>child.destroy());fitCamera(this);
    const {w,h}=logicalSize(),l=landingLayout(w,h),g=this.add.graphics();
    this.buttons=[];this.clanButtons=[];this.controlButtons=[];this.hintButtons=[];this.settingsTabs=[];this.panelClose=null;this.restoreButton=null;this.shareBox=null;this.accountButton=null;this.hangarButton=null;this.heroPreview=null;
    intents.copyZone=null;intents.textBox=null;
    if(document.activeElement!==nameField()||this.mapOpen||this.utility==='settings'||this.utility==='share')nameField().style.display='none';
    this.add.rectangle(w/2,h/2,w,h,0x07101c).setDepth(-1);
    g.lineStyle(1,UI.uiBorder,.14);for(let i=0;i<12;i++)g.lineBetween(i*w/8-h*.3,0,i*w/8+h*.3,h);
    if(this.textures.exists(combatKey('title-portals')))this.add.image(l.logo.x,l.logo.y,combatKey('title-portals')).setDisplaySize(l.logo.w,l.logo.h);
    else text(this,16,12,'STEROIDS–α',Math.min(30,w/13),css(UI.uiText));
    if(!l.compact)text(this,16,l.pitchY,'Mine. Upgrade. Fight. Warp out with salvage.',11,'#9fb5c7');
    text(this,w-16,12,'BANKED CREDITS',10,'#9fb5c7').setOrigin(1,0);
    text(this,w-16,28,this.credits===null?'—':String(this.credits),18,'#ffd27a').setOrigin(1,0);
    g.lineStyle(1,UI.uiAccent,.18);g.strokeEllipse(l.hero.x,l.hero.y+12,l.hero.w*.78,Math.max(24,l.hero.h*.55));
    const look=loadSave().look??{},ship=selectedFighter(look,this.unlocks),palette=Number((look.palette??'palette.0').split('.')[1]);
    this.heroPreview=shipPreview(this,ship.index!,palette,l.hero.x,l.hero.y,l.hero.w*.9,l.hero.h,{spin:true});
    text(this,l.hero.x,l.shipY,ship.name.toUpperCase(),l.compact?12:18,css(UI.uiText)).setOrigin(.5);
    if(!l.compact)text(this,l.hero.x,l.paletteY,PALETTES[palette]?.name.split(' / ')[0]??'Cobalt',11,'#b5ccdc').setOrigin(.5);
    this.hangarButton=l.hangar;panel(g,l.hangar.x-l.hangar.w/2,l.hangar.y-22,l.hangar.w,44,UI.uiGold);
    text(this,l.hangar.x,l.hangar.y,'HANGAR · ship & colour',l.hero.w<180?10:12,'#e7c587').setOrigin(.5);
    // A compact layout may move the editable pilot field into Account; it never removes access.
    this.nameBox={x:-1000,y:-1000,w:0,h:0};
    this.nameFrame=this.add.rectangle(-1000,-1000,1,1,0,0);this.nameText=text(this,-1000,-1000,'',16).setVisible(false);
    if(l.name)this.drawName(l.name.x,l.name.y,l.name.w,'PILOT');
    this.warpButton=l.warp;panel(g,l.warp.x-l.warp.w/2,l.warp.y-27,l.warp.w,54,UI.uiAccent,true);
    this.warpPulse=this.add.graphics();text(this,l.warp.x,l.warp.y-6,'WARP',24,css(UI.uiText)).setOrigin(.5);text(this,l.warp.x,l.warp.y+15,'Choose a planet',11,css(UI.uiAccent)).setOrigin(.5);
    this.tutorialButton=l.tutorial;panel(g,l.tutorial.x-l.tutorial.w/2,l.tutorial.y-22,l.tutorial.w,44,UI.uiBorder);text(this,l.tutorial.x,l.tutorial.y,'Learn to fly',13,'#b5ccdc').setOrigin(.5);
    this.utilityButtons=l.utilities;
    for(const b of l.utilities){panel(g,b.x-b.w/2,b.y-b.h/2,b.w,b.h,UI.uiBorder);text(this,b.x,b.y,b.id.toUpperCase(),11,'#9fb5c7').setOrigin(.5);if(b.id==='account')this.accountButton=b;}
    versionStamp(this);this.showCounts();
    if(this.utility)this.drawUtility(w,h);
    if(this.mapOpen){nameField().blur();nameField().style.display='none';intents.textBox=null;intents.copyZone=null;this.stellarMap=new StellarMap(this,w,h,loadSave().clan??0,this.selectedPlanet,this.counts,this.war,this.notifyWar);this.buttons=this.stellarMap.planets.map(({id,x,y,w,h})=>({id,x,y,w,h}));}
  }

  private drawUtility(w:number,h:number):void{
    const b=menuDialog(w,h),left=b.x-b.w/2,top=b.y-b.h/2,g=this.add.graphics().setDepth(100);
    if(this.utility!=='account'){nameField().blur();nameField().style.display='none';intents.textBox=null;}
    g.fillStyle(0x020710,.86).fillRect(0,0,w,h);panel(g,left,top,b.w,b.h,UI.uiBorder);
    this.panelClose={x:left+b.w-26,y:top+24,w:44,h:40};panel(g,this.panelClose.x-22,top+4,44,40,UI.uiBorder);text(this,this.panelClose.x,top+24,'×',23).setOrigin(.5).setDepth(102);
    const label=(x:number,y:number,s:string,size=12,c='#dfe8ff')=>text(this,x,y,s,size,c).setOrigin(.5).setDepth(102);
    const button=(x:number,y:number,w:number,s:string,on=false)=>{panel(g,x-w/2,y-22,w,44,on?UI.uiAccent:UI.uiBorder,on);label(x,y,s,11);return{x,y,w,h:44};};
    label(left+18,top+23,this.utility==='settings'?'Settings':this.utility==='share'?'Share':this.codeMode?'Recover account':'Account',18).setOrigin(0,.5);
    if(this.utility==='settings'){
      this.settingsTabs=(['clan','controls'] as const).map((id,i)=>({id,...button(b.x+(i?1:-1)*b.w*.22,top+65,b.w*.4,id==='clan'?'CLAN':'CONTROLS',this.settingsTab===id)}));
      if(this.settingsTab==='clan'){
        label(b.x,top+103,'Clan is optional outside Warzone.',11,'#9fb5c7');const bw=(b.w-40)/3;
        this.clanButtons=[{id:0,name:'NONE'},...CLANS].map((c,i)=>({id:c.id,...button(left+20+bw*(i+.5),top+143,bw-6,c.name.toUpperCase(),(loadSave().clan??0)===c.id)}));
      }else if(intents.touch)label(b.x,top+120,'Drag to steer. Use FIRE and DASH.',11,'#9fb5c7');
      else{
        label(b.x,top+100,'Steering',10,'#9fb5c7');
        this.controlButtons=(['marker','craft'] as const).map((id,i)=>({id,...button(b.x+(i?1:-1)*b.w*.22,top+127,b.w*.4,id==='marker'?'MOUSE':'KEYBOARD',intents.scheme===id)}));
        label(b.x,top+159,'Key hints',10,'#9fb5c7');this.hintButtons=[true,false].map((on,i)=>({on,...button(b.x+(i?1:-1)*b.w*.22,top+186,b.w*.4,on?'ON':'OFF',(loadSave().keyHints!==false)===on)}));
      }
    }else if(this.utility==='account'){
      if(this.codeMode){
        label(b.x,top+56,'Enter your recovery code.',11,'#9fb5c7');this.drawName(b.x,top+107,b.w-40,'RECOVERY CODE',101);
        this.nameText.setDepth(102);this.nameFrame.setDepth(101).setFillStyle(UI.uiPanel,1);this.restoreButton=button(b.x,top+158,b.w-40,this.recoveryPending?'CHECKING…':'RECOVER');
        if(this.accountNote)label(b.x,top+194,this.accountNote,11,'#ffd98a').setWordWrapWidth(b.w-32);
      }else{
        this.drawName(b.x,top+88,b.w-40,'PILOT',101);this.nameText.setDepth(102);this.nameFrame.setDepth(101);
        label(b.x,top+126,this.accountNote||'Recovery code',10,'#9fb5c7');label(b.x,top+148,loadSave().account?.recovery??'Unavailable',12);
        this.restoreButton=button(b.x,top+190,b.w-40,'RECOVER ACCOUNT');
      }
    }else{
      const size=Math.floor(Math.min(150,b.h-116)),x=b.x,y=top+44+size/2,qr=QRCode.create(SHARE_URL,{errorCorrectionLevel:'M'}),n=qr.modules.size+8,cell=size/n;
      g.fillStyle(0xffffff,1).fillRoundedRect(x-size/2,y-size/2,size,size,4);g.fillStyle(0x05070d,1);
      for(let row=0;row<qr.modules.size;row++)for(let col=0;col<qr.modules.size;col++)if(qr.modules.get(row,col))g.fillRect(x-size/2+(col+4)*cell,y-size/2+(row+4)*cell,Math.ceil(cell),Math.ceil(cell));
      label(x,y+size/2+8,'Scan to join',11,'#9fb5c7');const copy=button(b.x,top+b.h-34,b.w-40,'');
      this.shareHint=label(copy.x,copy.y,'Copy link',12);this.shareBox={x,y,size};intents.copyZone={zone:{x:b.x,y:top+44+(b.h-56)/2,hw:(b.w-40)/2,hh:(b.h-56)/2},text:SHARE_URL};
    }
  }

  /** Pilots on each planet, from the server; refreshed every few seconds while the menu is open. */
  private counts: Record<string, number> | null = null;
  /** Warzone round state from the planet list, and the auto-join request (owner, 17 November 2026). */
  private war: WarStatus | null = null;
  private notifyWar = false;
  private countsAt = -1e9;
  private async pollCounts(): Promise<void> {
    try {
      const url = serverOrigin().replace(/^ws/, 'http') + '/planets';
      const r = await fetch(url, { cache: 'no-store' });
      const j = r.ok ? ((await r.json()) as { planets: Record<string, number>; status?: Record<string, WarStatus> }) : null;
      this.counts = j?.planets ?? null;
      this.war = j?.status?.warzone ?? null;
    } catch {
      this.counts = null;this.war=null;
    }
    if (!this.scene.isActive()) return;
    this.showCounts();
    // Auto-join: warp in as soon as the Warzone opens (the map stays open meanwhile).
    if (this.notifyWar && this.stellarMap && this.selectedPlanet==='warzone' && this.war && warLabel(this.war).open && (loadSave().clan ?? 0)) {
      this.notifyWar = false;
      goImmersive(intents.touch);
      this.scene.start('flight', { planet: 'warzone' });
    }
  }

  /** The real player counts shown under the globes (test hook). */
  countLabels(): Record<string, string> {
    return Object.fromEntries(PLANETS.map(p => {
      const n = this.counts?.[p.id];
      return [p.id, n === undefined || n < 0 ? 'Players unavailable' : `${n} ${n === 1 ? 'player' : 'players'}`];
    }));
  }

  private showCounts(): void {
    this.stellarMap?.setCounts(this.counts, this.war);
  }

  private openUtility(next:'settings'|'account'|'share'|null):void{
    if(!this.codeMode)writeSave({name:cleanName(nameField().value)});
    nameField().blur();this.utility=next;this.codeMode=false;this.accountNote='';nameField().value=loadSave().name??'';this.layout();
  }

  update(time: number): void {
    intents.consume('shop');intents.consume('board');
    this.stellarMap?.update(time);
    if (!this.mapOpen && !this.utility && this.warpButton) {
      const b = this.warpButton, pulse = .5 + .5 * Math.sin(time / 330);
      this.warpPulse.clear().lineStyle(1.5, UI.uiAccent, .25 + pulse * .65);
      this.warpPulse.strokeRoundedRect(b.x - b.w / 2 - 3 - pulse * 3, b.y - b.h / 2 - 3 - pulse * 3,
        b.w + 6 + pulse * 6, b.h + 6 + pulse * 6, UI.uiRadius + 3);
    }
    const closeMap = intents.consume('pause');
    if (this.mapOpen && closeMap) {if(this.stellarMap?.dismissInfo())return;this.mapOpen = false;this.notifyWar=false; this.layout(); return; }
    if(this.utility&&closeMap){this.openUtility(null);return;}
    const copied = intents.consume('copied');
    const failed = intents.consume('copyFailed');
    if (this.shareHint?.active && (copied || failed)) {
      this.shareHint.setText(copied ? 'Link copied!' : SHARE_URL.replace('https://', '')).setColor(copied ? '#7dff9a' : '#ffd98a');
      this.shareHintUntil = time + (copied ? 1800 : 6000);
    }
    if (this.shareHint?.active && this.shareHintUntil && time > this.shareHintUntil) {
      this.shareHint.setText('Copy link').setColor('#8fa2c8');
      this.shareHintUntil = 0;
    }
    if (time - this.countsAt > clientTune.net.planetCountRefreshMs) {
      this.countsAt = time;
      void this.pollCounts();
    }
    const input = nameField();
    const editing = document.activeElement === input;
    const caret = editing && Math.floor(time / 500) % 2 === 0 ? '|' : '';
    if (this.codeMode) {
      const code = input.value.toUpperCase();
      this.nameText.setText(code || editing ? code + caret : 'Tap to type your code').setColor(code || editing ? '#ffd98a' : '#6d7a96');
    }
    const name = this.codeMode ? loadSave().name ?? '' : cleanName(input.value);
    if (!this.codeMode) this.nameText.setText(name || editing ? name + caret : 'Tap to enter a name').setColor(name || editing ? '#e8f0ff' : '#6d7a96');
    let shown=this.nameText.text;while(this.nameText.width>this.nameBox.w-20&&shown.length>1){shown=shown.slice(1);this.nameText.setText('…'+shown);}
    this.nameFrame.setStrokeStyle(1, editing ? UI.uiAccent : UI.uiBorder);
    for (const t of intents.drainTaps()) {
      if (this.stellarMap) {
        const action = this.stellarMap.tap(t.x, t.y);
        if (action?.kind === 'close') { this.mapOpen = false;this.notifyWar=false; this.layout(); return; }
        if (action?.kind === 'select'){this.selectedPlanet=action.planet;if(action.planet!=='warzone'){this.notifyWar=false;this.stellarMap.notify=false;}}
        if(action?.kind==='chooseSide'){writeSave({name,clan:action.clan});this.layout();return;}
        if (action?.kind === 'joinAs') {
          writeSave({ name, clan: action.clan }); goImmersive(intents.touch);
          this.scene.start('flight', { planet: 'warzone' }); return;
        }
        if (action?.kind === 'notify') {
          this.notifyWar = !this.notifyWar;
          this.layout();
          return;
        }
        if (action?.kind === 'warp') {
          writeSave({ name }); goImmersive(intents.touch);
          this.scene.start('flight', { planet: action.planet }); return;
        }
        continue;
      }
      const hit=(b:{x:number;y:number;w:number;h:number}|null)=>!!b&&Math.abs(t.x-b.x)<=b.w/2&&Math.abs(t.y-b.y)<=b.h/2;
      if(this.utility){
        const frame=menuDialog(logicalSize().w,logicalSize().h);
        if(hit(this.panelClose)||!hit(frame)){this.openUtility(null);return;}
        const tab=this.settingsTabs.find(hit);if(tab){this.settingsTab=tab.id;this.layout();return;}
        const clan=this.clanButtons.find(hit);if(clan){writeSave({clan:clan.id});this.layout();return;}
        const controls=this.controlButtons.find(hit);if(controls){intents.setScheme(controls.id);this.layout();return;}
        const hints=this.hintButtons.find(hit);if(hints){writeSave({keyHints:hints.on});this.layout();return;}
        if(hit(this.restoreButton)){if(this.codeMode)void this.submitCode();else{writeSave({name});this.codeMode=true;this.accountNote='';input.value='';this.layout();}return;}
        continue;
      }
      const utility=this.utilityButtons.find(hit);if(utility){this.openUtility(utility.id as 'settings'|'account'|'share');return;}
      const n = this.nameBox;
      // Taps on the name box belong to the text field over it.
      if (Math.abs(t.x - n.x) <= n.w / 2 && Math.abs(t.y - n.y) <= n.h / 2) continue;
      const hb = this.hangarButton;
      if (hb && !this.codeMode && Math.abs(t.x - hb.x) <= hb.w / 2 && Math.abs(t.y - hb.y) <= hb.h / 2) {
        writeSave({ name });
        this.scene.start('hangar', { credits: this.credits, unlocks: this.unlocks });
        return;
      }
      const tb = this.tutorialButton;
      if (tb && !this.codeMode && Math.abs(t.x - tb.x) <= tb.w / 2 && Math.abs(t.y - tb.y) <= tb.h / 2) {
        writeSave({ name });
        goImmersive(intents.touch);
        guide.reset();
        this.scene.start('flight', { planet: TUTORIAL });
        return;
      }
      const b = this.warpButton;
      if (b && !this.codeMode && Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2) {
        writeSave({ name });
        this.mapOpen = true; this.selectedPlanet = null; this.layout();
        return;
      }
    }
    if (!this.codeMode && !editing && (loadSave().name ?? '') !== name) writeSave({ name });
  }
}
