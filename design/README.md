# Haven — App Presentation Generator (Figma plugin)

A development-only Figma plugin that generates a presentation-ready design of **Haven**, a
mental-health companion app, directly inside Figma — no build step, no network calls, no
external images.

## Install & run

1. Open the **Figma desktop app** (development plugins don't run in the browser).
2. **Plugins → Development → Import plugin from manifest…**
3. Select `design/plugin/manifest.json`.
4. Run it from **Plugins → Development → Haven — App Presentation Generator**.
5. It creates (or replaces) a page named **"App Presentation"** with all 16 screens, a title
   section, connector arrows, and real clickable prototype links. Press **Play** on any screen to
   click through the flows live.

Re-running the plugin is safe: it removes its own previously-generated "App Presentation" page
first, then rebuilds from scratch (verified in `test/mock-run.js` by running the build twice
against the same mock document).

If Figma reports a page-limit error (Starter plans cap at 3 pages), delete or merge another page
first, then run again.

## Fonts

Loaded via `figma.loadFontAsync` with a fallback chain, resolved at runtime against
`figma.listAvailableFontsAsync()` rather than assumed: **Nunito → Quicksand → Poppins → Inter**.
Whichever is actually available in your Figma becomes the file's one typeface; the plugin's
"Build notes" card (next to the title section) records which one was used.

## What gets built

- 16 screens at 390×844, named-layer frames, left to right in flow order, each with a label above
  it (see `screens.md` for what each one is and connects to).
- A title section (logo, app name, one-line description) at the top-left of the page.
- Paint Styles and Text Styles for the full palette and type scale (Figma's Styles panel), so the
  file stays editable — see `design-system.md` for exact tokens and rationale.
- Real auto layout throughout (no absolute-positioned hacks except the one floating modal and a
  few face-silhouette/chart decorations that are intentionally freeform).
- A logo component built from vector shapes (no images).
- Connector arrows between every screen pair in the flow, **and** a real click-to-navigate
  prototype reaction on the matching hotspot (button, card, or back icon) — so the file is
  interactive for a live demo, not just a static diagram.
- A "Build notes" card reporting exactly what happened (font chosen, any step that failed and why).

## Testing this without Figma desktop

`test/mock-run.js` stubs just enough of the Plugin API (frame/text/vector creation, auto-layout
sizing math, font resolution, idempotent page removal) to run `code.js` to completion under plain
Node, twice in a row against the same mock document. Run it with:

```
node design/plugin/test/mock-run.js
```

It checks: the build completes and calls `figma.closePlugin`, exactly 16 screen frames exist,
exactly one "App Presentation" page exists after two runs (idempotency), and no build-time issues
were reported. This was the only verification possible in the environment this was built in — it
proves the script's logic is sound, not that it renders correctly in Figma desktop. **Please run
the plugin once in real Figma and skim the Build notes card before presenting.**

## Known limitations

- Icons (home, chat, mic, camera, etc.) are abstract glyphs built from basic shapes (rectangles,
  ellipses, triangles) — not literal icon-font glyphs — to avoid any external assets.
- The facial-recording and video-chat "camera preview" panels show an abstract vector face
  silhouette, never a real photo, per the no-external-images constraint.
- The Report Analysis trend chart uses clearly placeholder data, labeled as such on the screen.
- Connector arrows route through a lane beneath the screen row rather than a fully routed,
  collision-avoiding path — enough for a flow diagram, not pixel-perfect.
- `setReactionsAsync` (used for the real click-to-navigate links) may not exist on every Figma
  desktop build; the plugin feature-detects it and falls back to drawing the connector arrow only,
  noting the skip in Build notes, rather than failing the whole run.
- This was built and only logic-tested in a sandboxed environment without access to Figma
  desktop — see the testing section above.
