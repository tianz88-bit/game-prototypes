export interface MenuRect{x:number;y:number;w:number;h:number;}
/** Ship/action hierarchy reflows without removing utilities on small screens. */
export function landingLayout(w:number,h:number){
 const compact=h<300,logoH=Math.min(100,h*.15,w/6),top=logoH+(compact?20:38),bottom=h-64;
 const bodyH=Math.max(94,bottom-top),stack=w<520&&h>=480,actionH=compact?104:168;
 const actionW=stack?w-32:Math.min(340,(w-48)*.52),actionX=stack?w/2:w-16-actionW/2;
 const heroH=stack?Math.max(100,bodyH-actionH-8):bodyH,heroW=stack?w-32:w-actionW-48,heroX=stack?w/2:16+heroW/2;
 const actionTop=stack?top+heroH+8:top+Math.max(0,(bodyH-actionH)/2);
 const name=compact?null:{x:actionX,y:actionTop+34,w:actionW,h:40};
 const warp={x:actionX,y:actionTop+(compact?27:91),w:actionW,h:54};
 const tutorial={x:actionX,y:actionTop+(compact?82:146),w:actionW,h:44};
 const hangar={x:heroX,y:top+heroH-20,w:Math.min(248,heroW),h:44};
 const utilities=['settings','account','share'].map((id,i)=>({id,x:w/2+(i-1)*(Math.min(116,(w-48)/3)+8),y:h-30,w:Math.min(116,(w-48)/3),h:44}));
 return{compact,stack,logo:{x:16+logoH*1.5,y:8+logoH/2,w:logoH*3,h:logoH},pitchY:logoH+22,hero:{x:heroX,y:top+Math.max(28,(heroH-84)/2),w:heroW,h:Math.max(34,Math.min(320,heroH-84))},shipY:top+heroH-(compact?64:70),paletteY:top+heroH-50,hangar,name,warp,tutorial,utilities};
}
export function menuDialog(w:number,h:number){return{x:w/2,y:h/2,w:Math.min(440,w-24),h:Math.min(360,h-24)};}
