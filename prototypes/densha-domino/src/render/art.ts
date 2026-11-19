import sets from '../../art-sets.json';
import type Phaser from 'phaser';
import {registerEyes} from './expressions';
import {registerSignalArt} from './signalArt';
import {registerTunnelLayers} from './tunnelArt';

export const BODY_BOXES = [[40,34,310,160],[432,34,289,161],[807,34,298,160],[1170,39,338,154],[40,245,307,157],[432,246,290,157],[807,246,303,157],[1170,252,340,150],[122,449,139,257],[506,449,140,257],[890,449,140,257],[1274,447,139,257],[121,738,140,255],[505,738,141,254],[890,738,141,255],[1274,738,141,255]];
export const FOOD_BOXES = [[31,109,390,282],[513,120,318,243],[956,120,317,242],[1401,120,317,246],[111,555,223,241],[550,539,234,258],[952,529,343,267]];
export const PROP_BOXES = [[132,46,278,288],[602,35,338,295],[1159,44,232,283],[163,366,221,299],[549,423,441,205],[1135,429,268,191],[1182,693,176,300]];
export const TUNNEL_BOXES = [[204,46,414,508],[915,46,416,508],[60,637,644,326],[829,637,648,326]];


/** Optional manifest/loose-art loader. Missing art never prevents starting a game. */
export function preloadArt(scene: Phaser.Scene): void {
  if(new URLSearchParams(location.search).get('art')==='0')return;
  scene.load.once('filecomplete-json-dd_manifest',()=>{
    const manifest=scene.cache.json.get('dd_manifest') as {path:string;hash?:string}[];
    if(!Array.isArray(manifest))return;
    const catalog:Record<string,Record<string,string>>=sets.sets;
    const requested=new URLSearchParams(location.search).get('artSet')??sets.defaultSet;
    const active=Object.prototype.hasOwnProperty.call(catalog,requested)?catalog[requested]:catalog[sets.defaultSet];
    const files=new Map(manifest.map(entry=>[entry.path,entry]));
    for(const [key,path] of Object.entries({...sets.shared,...active})){
      const entry=files.get(path);
      if(entry&&!scene.textures.exists(key))scene.load.image(key,'assets/'+path+(entry.hash?'?v='+encodeURIComponent(entry.hash):''));
    }
  });
  scene.load.json('dd_manifest','assets/manifest.json');
}

export function hasArt(scene: Phaser.Scene,key: string): boolean {return scene.textures.exists(key);}
function frames(scene: Phaser.Scene,key:string,boxes:number[][]): void {
  if(!hasArt(scene,key))return;
  const texture=scene.textures.get(key);
  boxes.forEach(([x,y,w,h],i)=>{if(!texture.has(String(i)))texture.add(String(i),0,x,y,w,h);});
}

/** Shared atlases; peach-only livery replacement keeps teal paint and glass consistent. */
export function registerArt(scene: Phaser.Scene): void {
  registerEyes(scene);
  for(const [key,boxes]of [['dd_family',BODY_BOXES],['dd_food',FOOD_BOXES],['dd_props',PROP_BOXES],['dd_tunnels',TUNNEL_BOXES]] as const)frames(scene,key,boxes);
  registerTunnelLayers(scene);
  if(!hasArt(scene,'dd_family'))return;
  const source=scene.textures.get('dd_family').getSourceImage() as HTMLImageElement;
  registerSignalArt(scene,source);
  // Bake an alpha-threshold silhouette once; no per-car postprocessing.
  if(!hasArt(scene,'dd_outline')){
    const atlas=scene.textures.createCanvas('dd_outline',source.width,source.height)!;
    for(const [i,[x,y,w,h]] of BODY_BOXES.entries()){
      const mask=document.createElement('canvas');mask.width=w+16;mask.height=h+16;
      const ctx=mask.getContext('2d')!;ctx.drawImage(source,x,y,w,h,8,8,w,h);
      const pixels=ctx.getImageData(0,0,w+16,h+16);
      for(let n=0;n<pixels.data.length;n+=4){pixels.data[n]=100;pixels.data[n+1]=64;pixels.data[n+2]=88;pixels.data[n+3]=pixels.data[n+3]>160?255:0;}
      ctx.putImageData(pixels,0,0);
      for(let a=0;a<16;a++){const angle=a*Math.PI/8;atlas.context.drawImage(mask,x-8+Math.cos(angle)*4,y-8+Math.sin(angle)*4);}
      atlas.add(String(i),0,x-8,y-8,w+16,h+16);
    }
    atlas.refresh();
  }

  // The two livery sheets hold five colours each, with sixteen registered car frames per colour.
  for (let colour = 0; colour < 10; colour++) {
    const key = 'dd_liveries_' + Math.floor(colour / 5);
    if (!hasArt(scene, key)) continue;
    const atlas = scene.textures.get(key);
    BODY_BOXES.forEach((box, cell) => {
      const frame = colour + '-' + cell;
      if (!atlas.has(frame)) atlas.add(frame, 0, 2 + cell % 8 * 176,
        2 + ((colour % 5) * 2 + Math.floor(cell / 8)) * 140,
        Math.ceil(box[2] / 2), Math.ceil(box[3] / 2));
    });
  }
}

export function bodyCell(vertical:boolean,headDir:number,count:number,i:number):number {
  if(!vertical){if(count===1)return headDir<0?3:7;if(i>0&&i<count-1)return 1;return i===0?(headDir<0?0:4):(headDir>0?6:2);}
  if(count===1)return headDir<0?11:15;if(i>0&&i<count-1)return 9;return i===0?(headDir<0?8:12):(headDir>0?14:10);
}
