import Phaser from 'phaser';
import {Button} from 'dig-kit';
import {PIXEL_RATIO} from './pixelRatio';
import {tune} from './tune';
/** Local text treatment; shared dig-kit stays pinned and unchanged. */
export class GameButton extends Button {
  constructor(...args:ConstructorParameters<typeof Button>){super(...args);
    const scene=args[0],onTap=args[8],c=this.container;
    c.setScale(.86);scene.tweens.add({targets:c,scale:1,duration:tune.feel.uiBounceMs,ease:'Back.Out'});
    c.removeAllListeners('pointerdown');
    c.on('pointerdown',()=>{
      scene.tweens.killTweensOf(c);c.setScale(.94,.88);
      scene.tweens.add({targets:c,scaleX:1,scaleY:1,duration:tune.feel.uiBounceMs,ease:'Elastic.Out'});
      onTap();
    });
    c.once('destroy',()=>scene.tweens.killTweensOf(c));
    for(const child of this.container.list)if(child instanceof Phaser.GameObjects.Text)child.setStyle({fontFamily:'Trebuchet MS, Segoe UI, sans-serif',strokeThickness:0,color:'#fffaf0',resolution:PIXEL_RATIO});
  }
}
