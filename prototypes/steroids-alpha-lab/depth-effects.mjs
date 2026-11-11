import {modules,depth} from './rig.mjs';
export function drawDepth(m,angle,calibration){return depth(m,angle,calibration);}
export function layerBrightness(m,angle,calibration){
 const z=depth(m,angle,calibration);
 return .97**modules.filter(n=>depth(n,angle,calibration)>z).length;
}
