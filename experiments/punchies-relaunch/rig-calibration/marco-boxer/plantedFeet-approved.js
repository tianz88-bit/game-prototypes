const clamp=v=>Math.max(0,Math.min(1,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class PlantedFeet {
 constructor(){this.feet=null;this.active=-1;this.next=0;this.lastLand=-Infinity;this.zoom=0;this.angle=0;}
 update(targets,now,k,angle,velocity){
  const moving=Math.hypot(velocity.x,velocity.y)>2,started=moving&&!this.wasMoving;
  this.wasMoving=moving;
  const reset=!this.feet||this.zoom!==k||Math.abs(wrap(angle-this.angle))>Math.PI/3||targets.some((t,i)=>Math.hypot(t.x-this.feet[i].x,t.y-this.feet[i].y)>65*k);
  if(reset){this.feet=targets.map(t=>({...t,lift:0,swing:null}));this.active=-1;this.next=0;this.lastLand=now-100;}
  this.zoom=k;this.angle=angle;
  if(this.active>=0){
   const foot=this.feet[this.active],s=foot.swing,t=clamp((now-s.time)/s.duration),ease=t*t*t*(t*(t*6-15)+10);
   foot.x=s.x+(s.endX-s.x)*ease;foot.y=s.y+(s.endY-s.y)*ease;
   foot.yaw=s.yaw+wrap(s.endYaw-s.yaw)*ease;foot.lift=Math.pow(Math.sin(Math.PI*t),.75);
   if(t>=1){foot.swing=null;foot.lift=0;this.next=1-this.active;this.active=-1;this.lastLand=now;}
  }
  if(this.active<0&&now-this.lastLand>=75){
   const threshold=(moving?4.4:1.1)*k;
   for(const i of [this.next,1-this.next]){
    const foot=this.feet[i],target=targets[i];
    if(!started&&Math.hypot(target.x-foot.x,target.y-foot.y)<threshold&&Math.abs(wrap(target.yaw-foot.yaw))<.16)continue;
    const duration=moving?125:115,lead=moving?(started?.18:duration*.00055):0;
    foot.swing={x:foot.x,y:foot.y,yaw:foot.yaw,endX:target.x+velocity.x*lead,endY:target.y+velocity.y*lead,endYaw:target.yaw,time:now,duration};this.active=i;break;
   }
  }
  // Between swings each shoe stays at a fixed world position: planted, not sliding.
  return this.feet;
 }
}
