// Punchies lab offsetAt / fistDepth pattern, adapted to a nose-up ship.
export const directions=['up','right','down','left'];
export const modules=[
 {id:'chassis',label:'Chassis · lower frame',asset:'chassis',x:0,y:0,width:178,band:20,height:0},
 {id:'wingL',label:'Left wing',asset:'wing',x:-125,y:45,width:144,band:10,height:3,side:-1,parent:'chassis'},
 {id:'wingR',label:'Right wing',asset:'wing',x:125,y:45,width:144,band:10,height:3,side:1,mirror:true,parent:'chassis'},
 {id:'armour',label:'Chassis · upper deck',asset:'armour',x:0,y:-15,width:172,band:30,height:7,parent:'chassis',upGap:24},
 {id:'engineL',label:'Left thruster · core',asset:'booster-core',x:-78,y:108,width:83,band:42,height:8,side:-1,parent:'chassis',motion:'engine',motionGroup:'engineL'},
 {id:'engineR',label:'Right thruster · core',asset:'booster-core',x:78,y:108,width:83,band:43,height:8,side:1,parent:'chassis',motion:'engine',motionGroup:'engineR'},
 {id:'engineCapL',label:'Left thruster · cowling',asset:'booster-cowling',x:-78,y:88,width:86,band:44,height:16,side:-1,parent:'engineL',motion:'engine',motionGroup:'engineL',upGap:20},
 {id:'engineCapR',label:'Right thruster · cowling',asset:'booster-cowling',x:78,y:88,width:86,band:45,height:16,side:1,parent:'engineR',motion:'engine',motionGroup:'engineR',upGap:20},
 {id:'cockpit',label:'Cockpit · lower pod',asset:'cockpit-base',x:0,y:40,width:124,band:50,height:14,parent:'armour',upGap:8},
 {id:'canopy',label:'Cockpit · upper canopy',asset:'cockpit-canopy',x:0,y:40,width:106,band:51,height:18,parent:'cockpit',upGap:12},
 {id:'gunL',label:'Left gun',asset:'gun',x:-170,y:0,width:34,band:60,height:10,side:-1,parent:'wingL'},
 {id:'gunR',label:'Right gun',asset:'gun',x:170,y:0,width:34,band:60,height:10,side:1,parent:'wingR'},
];
// Real interleaving across the hull, analogous to Punchies fists crossing torso/head.
// Rows follow modules[]; columns are Up, Right, Down, Left.
const orders={chassis:[20,20,20,20],wingL:[10,10,10,10],wingR:[11,11,11,11],armour:[30,30,30,30],engineL:[42,42,42,42],engineR:[43,43,43,43],engineCapL:[44,44,44,44],engineCapR:[45,45,45,45],cockpit:[50,50,50,50],canopy:[51,51,51,51],gunL:[60,60,60,60],gunR:[61,61,61,61]};
export function seed(){return {version:7,hoverLift:28,shadow:{x:24,y:38,opacity:.55},modules:Object.fromEntries(modules.map(m=>[m.id,{width:m.width,order:Object.fromEntries(directions.map((d,i)=>[d,orders[m.id][i]])),offsets:Object.fromEntries(directions.map(d=>[d,{x:d==='right'?m.height*.12:d==='left'?-m.height*.12:0,y:-(m.upGap??m.height)*(d==='up'?1:d==='down'?.25:.625)}]))}]))};}
export function blendOffsets(angle,offsets){
 const phase=(((angle%360)+360)%360)/90,i=Math.floor(phase),t=phase-i;
 // Periodic monotone Hermite: continuous velocity through cardinal views,
 // exact edited endpoints, and no overshoot between adjacent values.
 const tangent=(a,b)=>a*b<=0?0:2*a*b/(a+b);
 return Object.fromEntries(['x','y'].map(axis=>{
  const p=[-1,0,1,2].map(n=>offsets[directions[(i+n+4)%4]][axis]);
  const d=p[2]-p[1],m0=tangent(p[1]-p[0],d),m1=tangent(d,p[3]-p[2]);
  const t2=t*t,t3=t2*t;
  return [axis,(2*t3-3*t2+1)*p[1]+(t3-2*t2+t)*m0+(-2*t3+3*t2)*p[2]+(t3-t2)*m1];
 }));
}
export function sector(angle){return Math.floor((((angle%360)+360)%360+45)/90)%4;}
export function depth(m,angle,calibration=seed()){
 return calibration.modules[m.id].order['up']+modules.indexOf(m)*.001;
}
export function stackOffset(m,angle,calibration){
 const own=blendOffsets(angle,calibration.modules[m.id].offsets);
 const parent=m.parent?stackOffset(modules.find(p=>p.id===m.parent),angle,calibration):{x:0,y:0};
 return {x:parent.x+own.x,y:parent.y+own.y};
}
export function pose(m,angle,calibration,time=0,motion=0,turn=0,recoil=0){
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),off=blendOffsets(angle,calibration.modules[m.id].offsets);
 const accumulated=stackOffset(m,angle,calibration);
 const phase=modules.findIndex(p=>p.id===(m.motionGroup||m.id))*2.17,engine=m.motion==='engine',gun=m.asset==='gun',wing=m.asset==='wing';
 const core=m.asset==='booster-core';
 const strength=core?1:.12;
 const vibration=engine?(Math.sin(time*.067+phase)*.65+Math.sin(time*.113+phase*1.7)*.25)*strength*motion:0;
 const axial=engine?(Math.sin(time*.049+phase)*1.6+Math.sin(time*.097+phase*.8)*.6)*strength*motion:0;
 const flex=wing?Math.sin(time*.003+phase)*.45*motion:0;
 const slide=gun?recoil*7:0;
 return {x:c*m.x-s*(m.y+slide)+accumulated.x+c*vibration-s*axial,y:s*m.x+c*(m.y+slide)+accumulated.y+s*vibration+c*axial,
 rotation:a+(engine?Math.sin(time*.061+phase)*.006*strength*motion:wing?flex*.006:0)-turn*(m.id==='canopy'?.022:m.id==='cockpit'?.012:engine?.012:0)*motion,
 depth:depth(m,angle,calibration),offset:off,accumulated};
}
export function validate(data){
 if(![1,2,3,4,5,6,7].includes(data?.version)||!data.modules)throw Error('Unknown calibration format');
 const out=seed();
 for(const m of modules){const entry=data.modules[m.id];if(!entry){if(data.version<3&&['engineCapL','engineCapR','canopy'].includes(m.id))continue;throw Error('Missing '+m.id);}
 if(!Number.isFinite(entry.width)||entry.width<12||entry.width>300)throw Error('Invalid width');out.modules[m.id].width=entry.width;
 for(const d of directions){if(data.version>=2){const z=entry.order?.[d];if(!Number.isFinite(z)||Math.abs(z)>100)throw Error('Invalid draw order');out.modules[m.id].order[d]=z;}
 for(const axis of ['x','y']){const n=entry.offsets?.[d]?.[axis];if(!Number.isFinite(n)||Math.abs(n)>100)throw Error('Invalid '+m.id+' '+d+' '+axis);out.modules[m.id].offsets[d][axis]=n;}}}
 if(data.version<3){const initial=seed();out.modules.cockpit.width=initial.modules.cockpit.width;
 for(const id of ['armour','cockpit'])for(const d of directions)out.modules[id].offsets[d].y=initial.modules[id].offsets[d].y;}
 else{for(const axis of ['x','y']){const n=data.shadow?.[axis];if(!Number.isFinite(n)||Math.abs(n)>100)throw Error('Invalid shadow offset');out.shadow[axis]=n;}
 const opacity=data.shadow?.opacity;if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw Error('Invalid shadow opacity');out.shadow.opacity=opacity;}
 if(data.version<4){for(const m of modules){const baseline=out.modules[m.id].offsets.up.y;out.modules[m.id].offsets.right.y=baseline*.625;out.modules[m.id].offsets.left.y=baseline*.625;out.modules[m.id].offsets.down.y=baseline*.25;}out.shadow.opacity=.55;}
 else{const n=data.hoverLift;if(!Number.isFinite(n)||n<0||n>100)throw Error('Invalid hoverLift');out.hoverLift=n;}
 for(const m of modules){if(data.version<5)out.modules[m.id].order=seed().modules[m.id].order;else for(const d of directions)out.modules[m.id].order[d]=out.modules[m.id].order.up;}
 if(data.version<7)for(const id of ['engineL','engineR','engineCapL','engineCapR','cockpit','canopy'])out.modules[id].order=seed().modules[id].order;
 return out;
}
