import type Phaser from 'phaser';
import { GAME_FONT } from './gameFont';
import { PIXEL_RATIO, WIDTH } from './pixelRatio';

/** A single player carries the user's audio permission from the title into play. */
export function startMusic(scene: Phaser.Scene, title: boolean): () => void {
  const audio = new Audio();
  const format = audio.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  const files = scene.cache.json.get('dd_manifest') as {path: string; hash?: string}[] | undefined;
  const titleTrack = files?.find(file => file.path === 'loose/title-loop.' + format);
  const gameplayTrack = files?.find(file => file.path === 'loose/gameplay-loop.' + format);
  if (!titleTrack || !gameplayTrack) return () => {};
  let enabled = localStorage.getItem('kaiten-express:music') !== 'off';
  const button = scene.add.text(WIDTH - 8, 4, '', {
    fontFamily: GAME_FONT, fontSize: '12px', color: '#745565', resolution: PIXEL_RATIO,
    backgroundColor: '#fff1de', padding: {x:5,y:4}
  }).setOrigin(1,0).setDepth(460).setInteractive({useHandCursor:true});
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = .24;
  const label = () => button.setText(enabled && !audio.paused ? 'Music on' : 'Music off');
  const play = () => {
    if (enabled && !document.hidden) void audio.play().catch(label);
  };
  const cue = (track: {path: string; hash?: string}) => {
    audio.src = 'assets/' + track.path + (track.hash ? '?v=' + encodeURIComponent(track.hash) : '');
    play();
  };
  const visibility = () => { if (document.hidden) audio.pause(); else play(); };
  button.on('pointerdown', (_pointer: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    enabled = audio.paused;
    localStorage.setItem('kaiten-express:music', enabled ? 'on' : 'off');
    if (enabled) play(); else audio.pause();
    label();
  });
  audio.addEventListener('playing', label);
  audio.addEventListener('pause', label);
  document.addEventListener('visibilitychange', visibility);
  scene.events.once('shutdown', () => {
    document.removeEventListener('visibilitychange', visibility);
    audio.removeEventListener('playing', label);
    audio.removeEventListener('pause', label);
    audio.pause(); audio.removeAttribute('src'); audio.load();
  });
  label();
  cue(title ? titleTrack : gameplayTrack);
  return () => cue(gameplayTrack);
}
