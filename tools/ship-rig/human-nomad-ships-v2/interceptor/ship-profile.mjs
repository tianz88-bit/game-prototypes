export const ship={id:'human-nomad-interceptor-overhead-v2',name:'Human Nomad · Overhead interceptor',status:'draft',family:'Human Nomad',baseline:'human-nomad-scrappy-v1'};
export const textureFiles=Object.fromEntries(['chassis','armour','wing','booster-core','booster-cowling','cockpit-base','cockpit-canopy','gun'].map(id=>[id,'assets/new-v2/'+id+'.png']));
export const modules=[
 {id:'chassis',label:'Chassis · short lower frame',asset:'chassis',x:0,y:-10,width:196,band:20,height:0},
 {id:'wingL',label:'Left swept spar',asset:'wing',x:-105,y:25,width:130,band:10,height:3,side:-1,parent:'chassis'},
 {id:'wingR',label:'Right swept spar',asset:'wing',x:105,y:25,width:130,band:10,height:3,side:1,mirror:true,parent:'chassis'},
 {id:'armour',label:'Chassis · short upper deck',asset:'armour',x:0,y:-20,width:180,band:30,height:7,parent:'chassis',upGap:16},
 {id:'engineL',label:'Left rail engine · core',asset:'booster-core',x:-145,y:30,width:48,band:42,height:8,side:-1,parent:'chassis',motion:'engine',motionGroup:'engineL'},
 {id:'engineR',label:'Right rail engine · core',asset:'booster-core',x:145,y:30,width:48,band:43,height:8,side:1,parent:'chassis',motion:'engine',motionGroup:'engineR'},
 {id:'engineCapL',label:'Left rail engine · shell',asset:'booster-cowling',x:-145,y:8,width:52,band:44,height:16,side:-1,parent:'engineL',motion:'engine',motionGroup:'engineL',upGap:16},
 {id:'engineCapR',label:'Right rail engine · shell',asset:'booster-cowling',x:145,y:8,width:52,band:45,height:16,side:1,parent:'engineR',motion:'engine',motionGroup:'engineR',upGap:16},
 {id:'cockpit',label:'Cockpit · broad lower pod',asset:'cockpit-base',x:0,y:5,width:132,band:50,height:14,parent:'armour',upGap:6},
 {id:'canopy',label:'Cockpit · kite glass roof',asset:'cockpit-canopy',x:0,y:5,width:112,band:51,height:18,parent:'cockpit',upGap:9},
 {id:'gunL',label:'Left twin rail cannon',asset:'gun',x:-91,y:-14,width:30,band:60,height:10,side:-1,parent:'wingL'},
 {id:'gunR',label:'Right twin rail cannon',asset:'gun',x:91,y:-14,width:30,band:60,height:10,side:1,parent:'wingR'},
];
