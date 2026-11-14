# AIriane native brand exports

Derived from the two untouched official SVGs in `../logo/` using Chromium with the original wordmark's **Inter 600** font loaded from the bundled OFL-licensed `mobile/assets/fonts/Inter.ttf`. The source viewboxes, paths, strokes, gradients, colors and text attributes are preserved.

- `airiane-wordmark.png`: transparent 920×240 horizontal master.
- `airiane-symbol.png`: transparent 1024×1024 symbol master.
- `launcher.png`: symbol on the original ivory surface, 1024×1024.
- `adaptive-foreground.png`: transparent Android foreground, original SVG scaled to 768px within 1024px for adaptive masking.
- `wordmark-plate.png`: original wordmark on a contrasting ivory plate for dark splash surfaces. The logo itself is not recolored.

Copied native build inputs live under `mobile/assets/brand/`. Portal uses the same canonical horizontal PNG. SVG sources remain the authority. Inter's OFL license and design-font licenses are in `mobile/assets/fonts/`. Native Android 12 splash rendering still needs release-build verification; a development client's splash is not full release evidence.

Native body/display aliases load static Manrope Regular (weight 400) and Plus Jakarta Sans SemiBold (600), instantiated from the included OFL variable TTF masters using fontTools 4.54.1. This avoids Android selecting a variable font’s light default. Original master files and licenses are retained; these display fonts do not alter the Inter wordmark artwork.
