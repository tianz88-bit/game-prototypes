import { TUNE } from '../../sim/tune';
const clamp=(v:number):number=>Math.max(0,Math.min(1,v));
const smooth=(v:number):number=>{const p=clamp(v);return p*p*(3-2*p);};
export interface OrbitalPose {
  phase:'waiting'|'entry'|'flight'|'exit'|'complete';progress:number;zoom:number;lift:number;
  groundAlpha:number;arrivalPulse:number;spaceAlpha:number;speedlines:number;travel:number;
}
/** Arrival follows authoritative remaining time, rather than starting a second client immunity clock. */
export class OrbitalTransition {
  private phase:OrbitalPose['phase']='waiting';
  private started=0;
  reset():void{this.phase='waiting';this.started=0;}
  update(now:number,hasShip:boolean,extracted:boolean,dead:boolean,remaining?:number):OrbitalPose {
    if(dead){this.phase='flight';return this.pose(0);}
    if(this.phase==='waiting'&&hasShip){this.phase=remaining===0?'flight':'entry';this.started=now;}
    if(extracted&&this.phase!=='exit'&&this.phase!=='complete'){this.phase='exit';this.started=now;}
    if(this.phase==='entry'){
      const p=remaining===undefined?(now-this.started)/(TUNE.warp.arrivalSeconds*1000):1-remaining/TUNE.warp.arrivalSeconds;
      if(p>=1)this.phase='flight';else return this.pose(clamp(p));
    }
    if(this.phase==='exit'){
      const p=(now-this.started)/(TUNE.warp.departureSeconds*1000);
      if(p>=1)this.phase='complete';else return this.pose(clamp(p));
    }
    return this.pose(this.phase==='complete'?1:0);
  }
  private pose(progress:number):OrbitalPose {
    const phase=this.phase,active=phase==='entry'||phase==='exit';
    // Reversing the approach produces the departure: pull away, accelerate, disappear into hyperspace.
    const p=phase==='exit'?1-progress:progress;
    const zoom=.2+.8*smooth((p-.4)/.55),spaceAlpha=1-smooth((p-.18)/.22);
    return{phase,progress,zoom:active?zoom:phase==='waiting'||phase==='complete'?.2:1,lift:0,
      groundAlpha:active?smooth((p-.72)/.28):phase==='complete'?0:1,arrivalPulse:-1,
      spaceAlpha:active?spaceAlpha:phase==='waiting'||phase==='complete'?1:0,speedlines:active?1-smooth((p-.18)/.22):phase==='waiting'?1:0,
      travel:active?(phase==='entry'?-1:1)*2400*Math.pow(1-p,3):0};
  }
}

export interface RemoteArrivalPose {alpha:number;offset:number;trail:number;}
/** The arrival's last fraction is a short fade-in, hard brake and spring-back at the real position. */
export function remoteArrivalPose(remaining:number):RemoteArrivalPose {
  const p=clamp(1-remaining/TUNE.warp.remoteArrivalSeconds);
  const fast=clamp(p/.72);
  const offset=p<.72?-220*Math.pow(1-fast,2)+14*Math.sin(fast*Math.PI/2):14*(1-smooth((p-.72)/.28));
  return{alpha:smooth(p/.3),offset,trail:Math.sin(p*Math.PI)*.7+.3};
}
