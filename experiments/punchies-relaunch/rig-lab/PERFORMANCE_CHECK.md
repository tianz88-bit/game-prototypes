# Rig test performance check

The user approved inspecting the active in-app browser for this diagnosis. The separate Brave test tab was inactive and its window unfocused; its 1 FPS reading was not representative of the active user view.

In the active in-app browser, the four-second comparison measured:

- Two animated rigs visible: 32.0 FPS.
- Same update loop, empty canvas: 32.0 FPS.
- Subsequent visible update CPU: about 0.05–0.07 ms/frame.
- Subsequent visible render submission CPU: about 0.60–0.66 ms/frame.

Equal frame delivery with rigs removed points to a limit outside the rig rendering workload. Exact browser/compositor cause has not been established; no claim that the frame-rate limit has been fixed. CPU measurements do not include GPU execution time.

Changes made: candidate arm ellipses rasterized once into a shared texture, animated by four sprite transforms; unchanged leg/original-arm paths reused while idle. All four direction endpoints and diagonal blend math checked. Independent left presets save to the existing draft. Previous rig server stopped before starting its replacement; one server remains on 5338.
