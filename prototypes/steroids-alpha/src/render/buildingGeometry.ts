import { shipShadow } from './planet';
export const TOWER_HEAD_LIFT=60;
export const TOWER_BARREL_LIFT=62;

export interface BuildingAt {x:number;y:number;scale:number;visible:boolean;}
export interface BuildingRigPose {
  id:string;at:BuildingAt;clan:number;now:number;
  basisAngle?:number;foreshorten?:number;
  sun?:{x:number;y:number;z:number};daylight?:number;brightness?:number;
  /** World offsets from this foundation, through the same ground projection as the terrain. */
  projectGround?:(dx:number,dy:number)=>BuildingAt;
}
export interface Point {x:number;y:number;}

/** Every plate, connecting column and barrel derives from this single foundation. */
export function buildingPoint(p:BuildingRigPose,lift:number,forward=0,lateral=0,angle=p.basisAngle??0):Point {
  const k=p.at.scale,b=p.basisAngle??0,c=Math.cos(angle),s=Math.sin(angle);
  return{x:p.at.x+(c*forward-s*lateral-Math.sin(b)*lift*.35)*k,y:p.at.y+(s*forward+c*lateral-Math.cos(b)*lift)*k};
}

export function buildingGroundPoint(p:BuildingRigPose,dx:number,dy:number):BuildingAt {
  if(p.projectGround)return p.projectGround(dx,dy);
  const a=p.basisAngle??0,c=Math.cos(a),s=Math.sin(a),k=p.at.scale;
  return{x:p.at.x+(c*dx-s*dy)*k,y:p.at.y+(s*dx+c*dy)*k*(p.foreshorten??1),scale:k,visible:p.at.visible};
}

function hull(points:Point[]):Point[]{
  points.sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o:Point,a:Point,b:Point)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lower:Point[]=[],upper:Point[]=[];
  for(const p of points){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

/** A ground-plane extrusion of the footprint: its near end always includes the root.
 * Only the far end moves with the sun; each vertex uses the surface projection. */
export function buildingShadowPolygon(p:BuildingRigPose,width:number,height:number,lift:number):Point[]{
  const offset=shipShadow(p.sun??{x:-.6,y:-.5,z:.6},lift*.48),points:Point[]=[];
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,dx=Math.cos(a)*width/2,dy=Math.sin(a)*height/2;
    for(const shift of [false,true]){
      const q=buildingGroundPoint(p,dx+(shift?offset.x:0),dy+(shift?offset.y:0));
      if(q.visible)points.push(q);
    }
  }
  return hull(points);
}
