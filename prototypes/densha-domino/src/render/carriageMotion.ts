export type Reaction='brake'|'honk'|'ack'|'startup'|'blocked';
import {tune} from '../tune';
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const p=clamp(x);return p*p*(3-2*p);};
/** Reviewed lab curves, sampled independently by each carriage. */
export function carriagePose(kind:Reaction,p:number){
  p=clamp(p);const t=kind==='brake'?.12+.95*p:kind==='honk'?1.2+.99*p:kind==='ack'?2.2+.89*p:kind==='startup'?3.1+1.5*p:0;
  const brake=t>.12&&t<1.07?Math.sin((t-.12)/.95*Math.PI):0;
  const ack=t>2.2&&t<3.1?Math.sin((t-2.2)/.9*Math.PI):0;
  const depart=smooth((t-3.1)/1.5),start=t>3.1?Math.exp(-(t-3.1)*5)*Math.sin((t-3.1)*15):0;
  const scale=kind==='brake'||kind==='honk'?1-tune.feel.artBrakeSquash*brake:kind==='ack'?1-tune.feel.acknowledgementSquash*ack:kind==='startup'?1+tune.feel.spookStretch*Math.sin(depart*Math.PI):1-.1*Math.sin(p*Math.PI);
  const expression=kind==='blocked'?'focus':t<1.2?'surprise':t<2.2?'insist':t<3.1?'happy':'focus';
  const eyePhase=t<1.2?clamp(t/1.2):t<2.2?clamp(t-1.2):t<3.1?clamp((t-2.2)/.9):clamp((t-3.1)/2.9);
  return {scale,cross:1+(1-scale)*.72,expression,eyePhase,spring:brake*1.5+Math.max(0,start)*3,lean:brake*2.2-start*1.5,skew:kind==='startup'?-1.2*start:-2*brake};
}

/** R(u) · scale(s1,s2) · R(-v) equals a pure X shear. Nested native
 * containers can therefore preserve the lab's affine skew without tilting or
 * hopping the final car, changing engines, or baking it into one animated image. */
export function shearTransform(degrees:number){
  const k=Math.tan(degrees*Math.PI/180);if(Math.abs(k)<1e-8)return {u:0,v:0,s1:1,s2:1};
  const s1=(Math.sqrt(k*k+4)+Math.abs(k))/2;
  return {u:.5*Math.atan2(2*k,k*k),v:.5*Math.atan2(2*k,-k*k),s1,s2:1/s1};
}
