# Combat backlog review pack

Owner approved the complete pass for live after screenshot review on 15 November 2026. The source ZIP is uploaded to the public R2 URL in assets.json and was fetched back with matching SHA-256. Original transparent PNGs and ZIP are saved at outputs/steroids-alpha/combat-backlog-v01; generation.json records the built-in image_gen prompts. The three source files are missile.png, mine.png and health-pod.png. Source frame/alpha/hash metadata is assets.json. Original source pixels are preserved; only runtime copies are resolution-bounded to192px and framed from recorded alpha bounds.

ZIP: steroids-alpha_combat-backlog-v1_assets.zip. The prepare hook downloads and verifies the public source ZIP, caches by content hash and verifies each original PNG before staging bounded runtime copies. No PNG/ZIP in Git.

Painted bodies use existing game coordinates and dimensions. The missile nozzle/status, mine arming/search sweep and observed-seeking thrust cue are code-driven. Gameplay, trigger/blast/hit radii and protocol are untouched. A missing texture selects the original procedural body. Health retains its medical cross and collection logic.

Review gallery: outputs/steroids-alpha/backlog-review/index.html. Combat frames: backlog-combat-preview; Canvas frames: backlog-combat-canvas.
