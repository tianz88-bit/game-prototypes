import type Phaser from 'phaser';
import { Sfx, type SfxOptions } from 'dig-kit';

/**
 * Sound effects from the art zip (loose/sfx-<name>.ogg or .mp3, Kenney CC0 packs), with the synthesised
 * dig-kit sounds as the fallback for any sample that is missing or still decoding. dig-kit stays unchanged.
 */
export class GameSfx extends Sfx {
  private readonly audio: AudioContext | null;
  private gain: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer[]>();

  constructor(scene: Phaser.Scene, private readonly options: SfxOptions) {
    super(scene, options);
    this.audio = (scene.sound as unknown as { context?: AudioContext }).context ?? null;
    const manifest = scene.cache.json.get('dd_manifest') as { path: string; hash?: string }[] | undefined;
    if (!this.audio || !Array.isArray(manifest)) return;
    const probe = new Audio();
    const ext = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
    // sfx-<name>.ogg, or numbered variants sfx-<name>-1.ogg, sfx-<name>-2.ogg picked at random.
    const pattern = new RegExp(`^loose/sfx-([a-z]+)(?:-\\d+)?\\.${ext}$`);
    for (const entry of manifest) {
      const name = pattern.exec(entry.path)?.[1];
      if (!name) continue;
      const url = 'assets/' + entry.path + (entry.hash ? '?v=' + encodeURIComponent(entry.hash) : '');
      void fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => this.audio!.decodeAudioData(data))
        .then((buffer) => { const list = this.buffers.get(name) ?? []; list.push(buffer); this.buffers.set(name, list); })
        .catch(() => { /* missing sample: synth fallback stays */ });
    }
  }

  /** Plays a sample at a playback rate (1 = as recorded). False when it is not loaded, so callers fall back. */
  sample(name: string, rate = 1, volume = 1, delay = 0): boolean {
    const list = this.buffers.get(name);
    if (!list?.length || !this.audio) return false;
    if (this.audio.state === 'suspended') void this.audio.resume();
    if (!this.gain) { this.gain = this.audio.createGain(); this.gain.connect(this.audio.destination); }
    this.gain.gain.value = this.options.volume();
    const src = this.audio.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate;
    const g = this.audio.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.gain);
    src.start(this.audio.currentTime + delay);
    return true;
  }

  has(name: string): boolean { return !!this.buffers.get(name)?.length; }

  override uiTap(): void { if (!this.sample('tap', 1, 0.8)) super.uiTap(); }
  override miss(): void { if (!this.sample('bonk')) super.miss(); }
  override cleared(): void { if (!this.sample('win')) super.cleared(); }
  override treasure(): void { if (!this.sample('reward')) super.treasure(); }
}
