export const flightSeed=()=>({speed:0,pitch:0,bank:0});
export function advanceFlight(state,input,dt){
 dt=Math.max(0,Math.min(.05,dt));
 const throttle=(input.accelerate?1:0)-(input.brake?1:0),yaw=(input.right?1:0)-(input.left?1:0);
 const acceleration=throttle>0&&state.speed<300?160:throttle<0&&state.speed>0?-220:0;
 const speed=Math.max(0,Math.min(300,state.speed+acceleration*dt));
 const ease=1-Math.exp(-9*dt),targetPitch=acceleration>0?-13:acceleration<0?17:0,targetBank=-yaw*22;
 return {speed,pitch:state.pitch+(targetPitch-state.pitch)*ease,bank:state.bank+(targetBank-state.bank)*ease,yawDelta:yaw*95*dt};
}
export function recoilPose(age){
 if(age<0||age>=600)return {kick:0,scaleX:1,scaleY:1};
 const kick=(1-Math.exp(-age/9))*Math.exp(-age/110);
 const rebound=Math.sin(Math.max(0,age-65)/70)*Math.exp(-Math.max(0,age-65)/125)*(age>65?1:0);
 return {kick:28*kick-5*rebound,scaleX:1+.28*kick-.08*rebound,scaleY:1-.34*kick+.22*rebound};
}
