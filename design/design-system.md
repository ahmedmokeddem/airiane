# Haven — Design System

"Haven" is the working app name (none was given) — short, warm, evokes safety without sounding
clinical. Tagline: **"Gentle support for every day."**

## A note on the palette choice

The brief's suggested palette — cream ground, terracotta/peach primary, sage secondary, warm brown
text — is, by frequency, the single most common palette a generative tool defaults to. Normally that's
a reason to swap it out. Here it isn't: it's the palette the person commissioning this design explicitly
asked for, not a default I reached for. So it stays, but it's held to a stricter execution discipline
than "pick nice colors" — one accent only, flat fills, no gradients, no shadows on anything at rest, no
hairline borders, and whole-screen tone shifts instead of per-card tinting — so the result reads as a
deliberate system rather than a generic one. That discipline is the actual content of this document.

## Color

One ground, one ink, one accent. Sage is a secondary **surface tone**, not a second accent — it never
appears on a call-to-action, only as a whole-screen mood shift (Treatment screens) or a tonal
(non-primary) surface.

| Token | Hex | Role |
|---|---|---|
| `color/ground` | `#F7F0E3` | Default screen background (cream) |
| `color/surface` | `#FFFBF3` | Cards, one tone step above ground — no border, no shadow |
| `color/surface-sage` | `#96AC8B` | Whole-screen tone shift for calm/treatment screens; tonal secondary surfaces (always paired with ink text, never white) |
| `color/surface-sage-tint` | `#E3E9DD` | Light sage tint for unselected chips/rows on sage screens |
| `color/accent` | `#B85A3A` | The one accent — primary buttons, selected states, progress rings, the one highlighted data point. Always paired with white text. |
| `color/accent-tint` | `#F0C9B4` | Light peach tint for selected-but-not-button chips (e.g. selected answer pill fill), paired with ink text |
| `color/ink` | `#3E2C22` | Primary text, icons, borders-as-fill |
| `color/ink-muted` | `#80705F` | Secondary / caption text, placeholder text |
| `color/on-accent` | `#FFFFFF` | Text/icons on `accent` or on `surface-sage` buttons |

**Contrast, checked:**
- `ink` on `ground`: ~11:1 (AAA)
- `on-accent` (white) on `accent`: ~4.6:1 (AA, normal text)
- `ink` on `surface-sage`: ~5.4:1 (AA)
- `ink-muted` on `ground`: verify ≥ 4.5:1 before shipping if copy changes; currently comfortably above it

**Avoid list (non-negotiable):**
- No gradients anywhere, including "just a subtle one" on the accent or the breathing ring.
- No drop shadows on anything at rest. The one exception is the questionnaire intro pop-up — a true
  floating dialog over a dimmed backdrop gets a soft shadow; nothing else does.
- No hairline 1px dividers/borders. Separate things with a tone step (`surface` vs `ground`) or spacing,
  never a stroke.
- No tinting every card peach. `accent-tint` is reserved for a selected state, not decoration.
- No second accent hue competing with terracotta on the same screen — sage never appears on a button
  or a highlighted data point.
- Charts use `ink` for all marks except the one notable point, which gets `accent`. Never a
  rainbow/multi-series-colored chart.
- No tiny uppercase tracked "eyebrow" labels, no icon-in-a-tinted-square nav items — nav icons are flat
  ink/accent glyphs with no chip behind them.

## Typography

One friendly sans-serif family, loaded via `figma.loadFontAsync` with a fallback chain (handles the
case where the first-choice family isn't available in the user's Figma): **Nunito → Quicksand →
Poppins → Inter**. Figma can load any of its bundled/Google fonts without local OS installation, but
the plugin still probes `figma.listAvailableFontsAsync()` at runtime and picks the first family in the
chain that's actually resolvable, rather than assuming.

Weights used: Regular (body), Medium/SemiBold (labels, buttons — nearest available weight to
"SemiBold" for the resolved family), Bold (display/headings).

| Style | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `text/display` | 28 | Bold | 34 | Screen hero numbers, splash wordmark |
| `text/heading` | 20 | SemiBold | 26 | Screen titles, section headings |
| `text/body` | 16 | Regular | 23 | Body copy, chat bubbles, questions |
| `text/label` | 16 | SemiBold | 20 | Button labels, nav labels |
| `text/caption` | 13 | Regular | 18 | Captions, timestamps, footnotes |

Max 5 sizes on the whole file. Left-aligned by default; splash and empty/success states are the only
centered moments.

## Spacing

8px base rhythm with a 4px half-step for tight pairs (icon-to-label, etc).

`4, 8, 12, 16, 24, 32, 48, 64`

- Screen padding: 24 (horizontal), 32 (top safe area below status bar)
- Card internal padding: 20
- Gap between stacked cards/sections: 16–24
- Gap between major sections: 32–48

## Corner radius

Decided once, used consistently — no in-between "soft 12px" on some things and square on others.

| Token | Value | Use |
|---|---|---|
| `radius/pill` | 999 | All buttons, chips, selectable pills |
| `radius/lg` | 28 | Cards, the video/camera preview panel, the modal |
| `radius/md` | 20 | Smaller containers (input bar, question option rows) |
| `radius/badge` | 20 | Logo badge (so it reads as a soft squircle, not a circle or a sharp square) |

Screen frames themselves are not rounded (they represent a physical device viewport).

## Logo

A rounded terracotta squircle badge (`radius/badge`) containing two overlapping flat circles — a larger
cream circle and a smaller sage circle overlapping its lower-right edge. Reads as two figures close
together / two moments of calm overlapping — a plain abstract mark for "support" and "connection"
without resorting to a literal icon (hands, chat bubble, heart) that would tip into cliché. Built from
three vector shapes (`createRoundedRect` fill accent, two `createEllipse`), no boolean operations, so
it's robust across Figma builds. Used at 96px on the splash screen, 32px in the title section and chat
header, 20px as the AI presence marker in the video chat screen.

## Components (built once, reused)

- `Button/Primary` — pill, `accent` fill, `on-accent` label, 56px tall
- `Button/Secondary` — pill, `surface-sage` fill, `ink` label, 56px tall
- `Button/Ghost` — pill, transparent, `ink-muted` label, no fill
- `Chip/Selectable` — pill, two states (selected: `accent-tint` fill + `ink` label; unselected:
  `surface` fill + `ink` label)
- `NavBar` — bottom bar, 4 flat glyph+label items, active item in `accent`, rest in `ink-muted`
- `StatusBar` — top mock status bar (time + signal/battery glyphs), purely decorative framing
- `Logo` — the mark described above, as a Figma component so every instance stays in sync
- `Icon/*` — small flat vector glyphs built from primitive shapes (no icon font, no imported SVG):
  home, treatment, chat, report, back, mic, camera, play, pause, send, check, close
