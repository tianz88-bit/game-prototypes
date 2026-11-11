// Shallow relief mesh, projected with pitch/bank. Source artwork is untouched.
export function tiltPoint(x,y,z,pitch,bank){
 const p=pitch*Math.PI/180,b=bank*Math.PI/180;
 const yy=y*Math.cos(p)-z*Math.sin(p),zz=y*Math.sin(p)+z*Math.cos(p);
 const xx=x*Math.cos(b)+zz*Math.sin(b),depth=-x*Math.sin(b)+zz*Math.cos(b),f=900/(900+depth);
 return {x:xx*f,y:yy*f};
}
export function bodyTiltPoint(x,y,z,pitch,bank,heading=0){
 const a=heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a),q=tiltPoint(c*x+s*y,-s*x+c*y,z,pitch,bank);
 return {x:c*q.x-s*q.y,y:s*q.x+c*q.y};
}
export function relief(m,u,v){
 // Piecewise linear ridges keep the painted centre seam and panel bands crisp.
 const ridge=1-Math.abs(2*u-1);
 if(m.id==='armour')return 16*ridge*(v<.2?v/.2:v>.75?(1-v)/.25:1);
 if(m.asset==='booster-cowling')return 12*ridge;
 if(m.id==='chassis')return 5*ridge;
 return 0; // glass, guns, cores: rigid planes rather than rubber deformation
}
export function projectPanelPoint(m,u,v,width,height,pose,pitch,bank,heading=0){
 const x=(u-.5)*width,y=(v-.5)*height,c=Math.cos(pose.rotation),s=Math.sin(pose.rotation);
 return bodyTiltPoint(pose.x+c*x-s*y,pose.y+s*x+c*y,relief(m,u,v),pitch,bank,heading);
}
function triangle(ctx,image,s,d){
 const [a,b,c]=s,[p,q,r]=d,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
 const A=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det;
 const C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det;
 const B=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
 const D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
 const mx=(p.x+q.x+r.x)/3,my=(p.y+q.y+r.y)/3;
 ctx.save();ctx.beginPath();for(let i=0;i<3;i++){const t=d[i],dx=t.x-mx,dy=t.y-my,len=Math.hypot(dx,dy);const x=t.x+dx/len*.35,y=t.y+dy/len*.35;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.clip();
 ctx.setTransform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);ctx.drawImage(image,0,0);ctx.restore();
}
export class TiltFFD{
 constructor(scene,modules){this.parts=new Map();for(const m of modules){
  const s=scene.sprites.get(m.id),f=s.frame,source=document.createElement('canvas'),ratio=f.cutHeight/f.cutWidth;
  source.width=Math.round(Math.min(256,256/ratio));source.height=Math.round(source.width*ratio);
  const ctx=source.getContext('2d');if(m.mirror){ctx.translate(source.width,0);ctx.scale(-1,1);}ctx.drawImage(s.texture.getSourceImage(),f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,source.width,source.height);
  const padding=96,texture=scene.textures.createCanvas('ffd-'+m.id,source.width+padding*2,source.height+padding*2);
  this.parts.set(m.id,{source,texture,padding,originalTexture:s.texture.key,originalFrame:f,key:''});
 }}
 apply(m,s,pose,physicalWidth,cx,cy,scale,pitch,bank,enabled,heading=0){
  const part=this.parts.get(m.id),{source,texture,padding}=part;
  if(!enabled||Math.abs(pitch)+Math.abs(bank)<.001){s.setTexture(part.originalTexture,'part');s.setFlipX(!!m.mirror);s.setScale(physicalWidth/part.originalFrame.width*scale);return;}
  const centre=bodyTiltPoint(pose.x,pose.y,0,pitch,bank,heading),r=pose.rotation,c=Math.cos(r),sn=Math.sin(r),unit=physicalWidth/source.width;
  // Quantize only the expensive texture bake; position and engine shake stay live.
  const key=[Math.round(heading*2),Math.round(pitch*4),Math.round(bank*4),Math.round(r*180/Math.PI*2),Math.round(physicalWidth),Math.round(pose.x/4),Math.round(pose.y/4)].join('/');
  if(key!==part.key){part.key=key;const ctx=texture.context;ctx.clearRect(0,0,texture.width,texture.height);
   const us=[0,.22,.5,.78,1],vs=[0,.2,.45,.75,1],points=vs.map(v=>us.map(u=>{
    const q=projectPanelPoint(m,u,v,physicalWidth,source.height*unit,pose,pitch,bank,heading);
    const dx=q.x-centre.x,dy=q.y-centre.y;
    return {src:{x:u*source.width,y:v*source.height},dst:{x:padding+source.width/2+(c*dx+sn*dy)/unit,y:padding+source.height/2+(-sn*dx+c*dy)/unit}};
   }));
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){const a=points[y][x],b=points[y][x+1],c=points[y+1][x],d=points[y+1][x+1];for(const tri of [[a,b,d],[a,d,c]])triangle(ctx,source,tri.map(v=>v.src),tri.map(v=>v.dst));}
   texture.refresh();
  }
  s.setTexture(texture.key).setFlipX(false).setPosition(cx+centre.x*scale,cy+centre.y*scale).setScale(unit*scale);
 }
}
