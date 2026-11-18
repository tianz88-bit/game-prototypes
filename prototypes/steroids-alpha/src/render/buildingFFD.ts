import Phaser from 'phaser';
import {clientTune} from '../clientTune';
import { buildingTiltPoint } from './buildingGeometry';
import type { Point } from './buildingGeometry';

/** Reusable nine-point mesh per plate; original sprite is the Canvas/context-loss fallback. */
export class BuildingFFD {
  private mesh:Phaser.GameObjects.Mesh|null=null;
  private links:{vertex:Phaser.Geom.Mesh.Vertex;u:number;v:number}[]=[];
  private failed=false;
  constructor(private scene:Phaser.Scene){}
  draw(image:Phaser.GameObjects.Image,lean:Point):void {
    const gl=(this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    if(!image.visible||clientTune.render.ffdEnabled<.5||!gl||gl.isContextLost()||this.failed||Math.hypot(lean.x,lean.y)<.001){this.mesh?.setVisible(false);return;}
    try{
      if(!this.mesh){
        const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
        for(let y=0;y<3;y++)for(let x=0;x<3;x++){positions.push(x/2,y/2);uvs.push(x/2,y/2);}
        for(let y=0;y<2;y++)for(let x=0;x<2;x++){const q=y*3+x;indices.push(q,q+3,q+1,q+1,q+3,q+4);}
        this.mesh=this.scene.add.mesh(0,0,image.texture.key,undefined,positions,uvs,indices).setActive(false);
        this.mesh.hideCCW=false;
        this.links=this.mesh.vertices.map(vertex=>({vertex,u:Math.round(vertex.u*2)/2,v:Math.round(vertex.v*2)/2}));
      }
      const mesh=this.mesh,frame=image.frame,c=Math.cos(image.rotation),s=Math.sin(image.rotation);
      if(mesh.texture.key!==image.texture.key)mesh.setTexture(image.texture.key);
      mesh.setPosition(image.x,image.y).setDepth(image.depth).setAlpha(image.alpha).setVisible(true);
      for(const {vertex,u,v} of this.links){
        const x=(u-image.originX)*image.displayWidth,y=(v-image.originY)*image.displayHeight;
        // Deform in unscaled part units so zoom never changes the tilt strength.
        const scale=Math.max(.001,image.displayWidth/frame.width),p=buildingTiltPoint((c*x-s*y)/scale,(s*x+c*y)/scale,lean);
        vertex.vx=p.x*scale;vertex.vy=p.y*scale;vertex.vz=0;vertex.u=frame.u0+(frame.u1-frame.u0)*u;vertex.v=frame.v0+(frame.v1-frame.v0)*v;vertex.color=image.tintTopLeft;
      }
      image.setVisible(false);
    }catch{this.failed=true;this.mesh?.setVisible(false);image.setVisible(true);}
  }
  hide():void{this.mesh?.setVisible(false);}
  destroy():void{this.mesh?.destroy();this.mesh=null;this.links=[];}
}
