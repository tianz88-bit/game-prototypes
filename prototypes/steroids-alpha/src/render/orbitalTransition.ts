// Camera/art only. The network and prediction tick normally throughout arrival and departure.
export const ORBIT_ENTRY_MS = 1800;
export const ORBIT_EXIT_MS = 1500;
const clamp = (v:number):number => Math.max(0,Math.min(1,v));
const smooth = (v:number):number => v*v*(3-2*v);
export interface OrbitalPose {
  phase:'waiting'|'entry'|'flight'|'exit'|'complete';
  progress:number;
  zoom:number;
  /** Height above the normal flight anchor, as a fraction of viewport height. */
  lift:number;
  groundAlpha:number;
  arrivalPulse:number;
}
export class OrbitalTransition {
  private phase:OrbitalPose['phase']='waiting';
  private started=0;
  reset():void {this.phase='waiting';this.started=0;}
  update(now:number,hasShip:boolean,extracted:boolean,dead:boolean):OrbitalPose {
    if(dead){this.phase='flight';return this.pose(now);}
    if(this.phase==='waiting' && hasShip){this.phase='entry';this.started=now;}
    if(extracted && this.phase!=='exit' && this.phase!=='complete'){
      this.phase='exit';this.started=now;
    }
    if(this.phase==='entry' && now-this.started>=ORBIT_ENTRY_MS)this.phase='flight';
    if(this.phase==='exit' && now-this.started>=ORBIT_EXIT_MS)this.phase='complete';
    return this.pose(now);
  }
  private pose(now:number):OrbitalPose {
    const phase=this.phase;
    const p=clamp((now-this.started)/(phase==='entry'?ORBIT_ENTRY_MS:ORBIT_EXIT_MS));
    if(phase==='entry'){
      const approach=1-Math.pow(1-p,3);
      const descent=smooth(clamp(p/.84));
      // Start below the fixed header, so the craft never disappears behind the Warp chip.
      return {phase,progress:p,zoom:.34+.66*approach,lift:.31*(1-descent),groundAlpha:smooth(clamp((p-.5)/.34)),arrivalPulse:p>=.8?(p-.8)/.2:-1};
    }
    if(phase==='exit')return {phase,progress:p,zoom:1-.66*smooth(p),lift:.68*p*p,groundAlpha:1-smooth(clamp(p/.4)),arrivalPulse:-1};
    return {phase,progress:phase==='complete'?1:0,zoom:phase==='waiting'||phase==='complete'?.34:1,lift:0,groundAlpha:phase==='complete'?0:1,arrivalPulse:-1};
  }
}
