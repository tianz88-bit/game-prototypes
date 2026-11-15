# Combat backlog review pack

LOCAL REVIEW ONLY — no R2 upload or live deployment before owner screenshot approval. Original transparent PNGs and ZIP are saved at outputs/steroids-alpha/combat-backlog-v01; generation.json records the built-in image_gen prompts. The three source files are missile.png, mine.png and health-pod.png. Source frame/alpha/hash metadata is assets.json. Original source pixels are preserved; only runtime copies are resolution-bounded to192px and framed from recorded alpha bounds.

ZIP: steroids-alpha_combat-backlog-v1_assets.zip. The prepare hook uses a local content-hash cache for preview; the manifest public URL is reserved for upload AFTER approval, and is not live yet. No PNG/ZIP in Git.

Painted bodies use existing game coordinates and dimensions. The missile nozzle/status, mine arming/search sweep and observed-seeking thrust cue are code-driven. Gameplay, trigger/blast/hit radii and protocol are untouched. A missing texture selects the original procedural body. Health retains its medical cross and collection logic.

Review gallery: outputs/steroids-alpha/backlog-review/index.html. Combat frames: backlog-combat-preview; Canvas frames: backlog-combat-canvas.
