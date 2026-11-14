import config from './palettes.json' with {type:'json'};
export const palettes=config.palettes.map((p,i)=>({...p,id:`palette.${i}`}));
function hsv(r,g,b){r/=255;g/=255;b/=255;const v=Math.max(r,g,b),n=Math.min(r,g,b),d=v-n;let h=0;if(d){h=v===r?(g-b)/d+(g<b?6:0):v===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return[h,v?d/v:0,v];}
function rgb(h,s,v){const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6].map(n=>Math.round(n*255));}
/** Apply to original RGBA, before depth/night shading. Never multiply the whole hull by a tint. */
export function remapRgba(source,index){
 if(!Number.isInteger(index)||index<0||index>=palettes.length)throw Error('Unknown palette');
 if(source.length%4)throw Error('RGBA length');const out=new Uint8ClampedArray(source);if(index===0)return out;
 const targets=Object.fromEntries(['primary','accent','glow'].map(k=>{const hex=palettes[index][k];return[k,hsv(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)))];}));
 for(let i=0;i<out.length;i+=4){const[h,s,v]=hsv(source[i],source[i+1],source[i+2]);const k=h>.42&&h<.59&&s>.3&&v>.4?'glow':h>.54&&h<.70&&s>.55&&v>.32?'primary':h>.015&&h<.16&&s>.55&&v>.4?'accent':null;if(!k||!source[i+3])continue;const[hh,ss,vv]=targets[k],c=rgb(hh,Math.min(1,s*ss),Math.min(1,v*vv/(k==='primary'?.949:1)));out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];}return out;
}
