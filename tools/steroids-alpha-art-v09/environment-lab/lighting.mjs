// One distant sun stays fixed in space. The rolling-sphere frame moves beneath it.
export function sunState(azimuth=238,elevation=60){const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;return {x:Math.cos(a)*Math.cos(e),y:Math.sin(a)*Math.cos(e),z:Math.sin(e)};}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function planetFrame(travelX=0,travelY=0,rotationDegrees=0,radius=608.2476923076923){const rotation=rotationDegrees*Math.PI/180,camera={x:travelX+rotation*radius,y:travelY},lon=camera.x/radius,lat=camera.y/radius,S=sunState(),c=Math.cos(lon),s=Math.sin(lon),cb=Math.cos(lat),sb=Math.sin(lat),z=s*S.x+c*S.z;const sun={x:c*S.x-s*S.z,y:cb*S.y-sb*z,z:sb*S.y+cb*z};return {camera,sun,daylight:smooth(-.04,.22,sun.z),brightness:.30+.70*smooth(-.12,.65,sun.z)};}
export function shipShadow(sun,reach=56){const slope=Math.max(.16,sun.z),x=-sun.x/slope*reach,y=-sun.y/slope*reach,length=Math.hypot(x,y),limit=reach*2.5,k=length>limit?limit/length:1;return {x:x*k,y:y*k};}
export function advanceRotation(angle,dt,degreesPerSecond=4){return angle+dt*degreesPerSecond;}
