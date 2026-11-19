import Phaser from 'phaser';
import {Button} from 'dig-kit';
import {PIXEL_RATIO} from './pixelRatio';
import {tune} from './tune';
/** Local text treatment; shared dig-kit stays pinned and unchanged. */
export class GameButton extends Button {
  constructor(...args:ConstructorParameters<typeof Button>){super(...args);
    const scene=args[0],onTap=args[8],c=this.container;
    c.setScale(tune.feel.buttonIntroScale);scene.tweens.add({targets:c,scale:1,duration:tune.feel.uiBounceMs,ease:tune.feel.uiEase});
    c.removeAllListeners('pointerdown');
    c.on('pointerdown',()=>{
      scene.tweens.killTweensOf(c);c.setScale(tune.feel.buttonPressX,tune.feel.buttonPressY);
      scene.tweens.add({targets:c,scaleX:1,scaleY:1,duration:tune.feel.buttonReleaseMs,ease:tune.feel.uiEase});
      onTap();
    });
    c.once('destroy',()=>scene.tweens.killTweensOf(c));
    for(const child of this.container.list)if(child instanceof Phaser.GameObjects.Text)child.setStyle({fontFamily:'Trebuchet MS, Segoe UI, sans-serif',strokeThickness:0,color:'#fffaf0',resolution:PIXEL_RATIO});
  }
}
