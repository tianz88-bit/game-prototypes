/** Clan architecture has its own material ramps, independent of every pilot's paint scheme. */
export const CLAN_ART = {
  crimson: { hull:0xb43e51, mid:0xe35c65, shade:0x652d43, light:0xffb879, glow:0xff9e77, dark:0x291f35, structure:0x65565d },
  azure: { hull:0x286caf, mid:0x579fe1, shade:0x293b64, light:0xa2e5ec, glow:0x77e5f2, dark:0x152b45, structure:0x526572 },
};
export const clanArtColours=(clan:number)=>clan===1?CLAN_ART.crimson:CLAN_ART.azure;
export const colourCss=(colour:number):string=>'#'+colour.toString(16).padStart(6,'0');

/** Repaint the source's enamel, trim and glass by material; keep alpha, cream and dark linework. */
export function remapBuildingPixels(px:Uint8ClampedArray,clan:number):void {
  const palette=clanArtColours(clan);
  for(let i=0;i<px.length;i+=4){
    if(!px[i+3])continue;
    const r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255,v=Math.max(r,g,b),lo=Math.min(r,g,b),d=v-lo,s=v?d/v:0;
    if(s<.3||v<.25||d===0)continue;
    let h=(v===r?(g-b)/d+(g<b?6:0):v===g?(b-r)/d+2:(r-g)/d+4)/6;
    h=(h+1)%1;
    const material=h>.42&&h<.59&&v>.4?'glow':h>.54&&h<.76?'hull':h>.015&&h<.16&&s>.5?'light':null;
    if(!material)continue;
    const target=palette[material],level=Math.min(1.16,v/(material==='hull'?.92:1));
    for(const [channel,shift] of [[0,16],[1,8],[2,0]])px[i+channel]=Math.min(255,Math.round(((target>>shift)&255)*level));
  }
}
