# Pillar and native art preparation

Generated with the built-in imagegen tool on 19 November 2026, using restaurant-atlas.png as the style reference. Source: exec-c2678fd2-c8a5-4be9-a50f-32565eda27a9.png; kept in the local generated-images directory.

Prompt: Create a single isolated warm ivory restaurant service-counter pillar in the same cute polished softly shaded illustrated style as the restaurant props. Broad squared rounded-corner base, one floor-tile footprint, tall straight shaft, subtle peach side shading, warm plum thin contour, understated mint trim near the solid base. Mostly top-down camera with a little front side visible. Fade only the uppermost shaft to transparency to imply continued height; bottom fully readable. Transparent background, no floor, text or other objects.

Preparation: extract x550 y40 width420 height940 from the 1536x1024 source, preserve alpha, resize to 512 px high. The base sets the board footprint; display aspect ratio matches the crop. Final ignored source/public loose asset: restaurant-pillar.png. Release archive includes the asset and content-hash manifest. PNGs are not committed.

End caps are native ivory/plum graphics at channel-run obstacle boundaries. The train contour is baked once from thresholded body alpha, dilated in warm plum, with padded registered frames; original body, food, expression and light atlases remain intact. No per-car postprocessing.
