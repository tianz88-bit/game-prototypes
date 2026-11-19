import type {Level,Axis} from '../game/types';

export interface ChannelRun {axis:Axis;line:number;start:number;end:number;}
/** Fixed blocks divide a lane. Only the component occupied by a train is usable. */
export function channelRuns(level:Level):ChannelRun[] {
  const runs:ChannelRun[]=[];
  for(const axis of ['h','v'] as const){
    const trains=level.trains.filter(t=>t.axis===axis),length=axis==='h'?level.cols:level.rows;
    for(const line of new Set(trains.map(t=>t.line))){
      let start=0;
      for(let n=0;n<=length;n++){
        const blocked=n===length||level.obstacles.has(axis==='h'?line*level.cols+n:n*level.cols+line);
        if(!blocked)continue;
        if(n>start&&trains.some(t=>t.line===line&&t.start>=start&&t.start<n))runs.push({axis,line,start,end:n});
        start=n+1;
      }
    }
  }
  return runs;
}
