export const ship={id:'human-nomad-battlecruiser-v1',name:'Human Nomad · Bulwark battlecruiser',status:'draft',family:'Human Nomad',baseline:'human-nomad-scrappy-v1'};
export const textureFiles=Object.fromEntries(['chassis','armour','wing','booster-core','booster-cowling','cockpit-base','cockpit-canopy','gun','shield-emitter'].map(id=>[id,'assets/capital-v1/'+id+'.png']));
export const modules=[
 {id:'chassis',label:'Capital lower hull',asset:'chassis',x:0,y:0,width:580,band:20,height:0},
 {id:'wingL',label:'Port armour bastion',asset:'wing',x:-280,y:-70,width:300,band:10,height:8,side:-1,parent:'chassis'},
 {id:'wingR',label:'Starboard armour bastion',asset:'wing',x:280,y:-70,width:300,band:11,height:8,side:1,mirror:true,parent:'chassis'},
 {id:'armour',label:'Raised capital armour deck',asset:'armour',x:0,y:0,width:550,band:30,height:14,parent:'chassis',upGap:28},
 {id:'engineL',label:'Port twin-vent engine bank',asset:'booster-core',x:-230,y:280,width:160,band:42,height:12,side:-1,parent:'chassis',motion:'engine',motionGroup:'engineL'},
 {id:'engineR',label:'Starboard twin-vent engine bank',asset:'booster-core',x:230,y:280,width:160,band:43,height:12,side:1,parent:'chassis',motion:'engine',motionGroup:'engineR'},
 {id:'engineCapL',label:'Port engine armour hood',asset:'booster-cowling',x:-230,y:220,width:170,band:44,height:25,side:-1,parent:'engineL',motion:'engine',motionGroup:'engineL',upGap:24},
 {id:'engineCapR',label:'Starboard engine armour hood',asset:'booster-cowling',x:230,y:220,width:170,band:45,height:25,side:1,parent:'engineR',motion:'engine',motionGroup:'engineR',upGap:24},
 {id:'shieldL',label:'Port heavy shield projector',asset:'shield-emitter',x:-145,y:0,width:125,band:48,height:22,side:-1,parent:'armour',upGap:18},
 {id:'shieldR',label:'Starboard heavy shield projector',asset:'shield-emitter',x:145,y:0,width:125,band:49,height:22,side:1,parent:'armour',upGap:18},
 {id:'cockpit',label:'Aft command bridge · pedestal',asset:'cockpit-base',x:0,y:180,width:250,band:50,height:26,parent:'armour',upGap:12},
 {id:'canopy',label:'Command bridge · glass roof',asset:'cockpit-canopy',x:0,y:180,width:218,band:51,height:34,parent:'cockpit',upGap:14},
 {id:'gunL',label:'Cannon 1 · port inner',asset:'gun',x:-115,y:-350,width:90,band:60,height:18,side:-1,parent:'armour',recoilDelay:0,recoilScale:2.6},
 {id:'gunR',label:'Cannon 2 · starboard inner',asset:'gun',x:115,y:-350,width:90,band:61,height:18,side:1,parent:'armour',recoilDelay:70,recoilScale:2.6},
 {id:'gunOuterL',label:'Cannon 3 · port shoulder',asset:'gun',x:-310,y:-280,width:90,band:62,height:18,side:-1,parent:'wingL',recoilDelay:140,recoilScale:2.6},
 {id:'gunOuterR',label:'Cannon 4 · starboard shoulder',asset:'gun',x:310,y:-280,width:90,band:63,height:18,side:1,parent:'wingR',recoilDelay:210,recoilScale:2.6},
];

