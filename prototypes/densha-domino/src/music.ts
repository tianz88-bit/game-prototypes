import type Phaser from 'phaser';

export interface MusicControls {
  enabled: () => boolean;
  toggle: () => void;
  playGameplay: () => void;
}

/** A single player carries the user's audio permission from the title into play. */
export function startMusic(scene: Phaser.Scene, title: boolean): MusicControls | undefined {
  const audio = new Audio();
  const format = audio.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  const files = scene.cache.json.get('dd_manifest') as {path: string; hash?: string}[] | undefined;
  const titleTrack = files?.find(file => file.path === 'loose/title-loop.' + format);
  const gameplayTrack = files?.find(file => file.path === 'loose/gameplay-loop.' + format);
  if (!titleTrack || !gameplayTrack) return;
  let enabled = localStorage.getItem('kaiten-express:music') !== 'off';
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = .24;
  const play = () => {
    if (enabled && !document.hidden) void audio.play().catch(() => {});
  };
  const cue = (track: {path: string; hash?: string}) => {
    audio.src = 'assets/' + track.path + (track.hash ? '?v=' + encodeURIComponent(track.hash) : '');
    play();
  };
  const visibility = () => { if (document.hidden) audio.pause(); else play(); };
  document.addEventListener('visibilitychange', visibility);
  scene.events.once('shutdown', () => {
    document.removeEventListener('visibilitychange', visibility);
    audio.pause(); audio.removeAttribute('src'); audio.load();
  });
  cue(title ? titleTrack : gameplayTrack);
  return {
    enabled: () => enabled && !audio.paused,
    toggle: () => {
      enabled = audio.paused;
      localStorage.setItem('kaiten-express:music', enabled ? 'on' : 'off');
      if (enabled) play(); else audio.pause();
    },
    playGameplay: () => cue(gameplayTrack)
  };
}
