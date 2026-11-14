---
name: Restorative Horizon
colors:
  surface: '#faf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#e9e8e5'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1a'
  on-surface-variant: '#43474c'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f2f1ee'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#4e6075'
  primary: '#001325'
  on-primary: '#ffffff'
  primary-container: '#15283b'
  on-primary-container: '#7d8fa7'
  inverse-primary: '#b5c8e1'
  secondary: '#166a61'
  on-secondary: '#ffffff'
  secondary-container: '#a3eee2'
  on-secondary-container: '#1d6e65'
  tertiary: '#130049'
  on-tertiary: '#ffffff'
  tertiary-container: '#281961'
  on-tertiary-container: '#9183d1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4fe'
  primary-fixed-dim: '#b5c8e1'
  on-primary-fixed: '#081d2f'
  on-primary-fixed-variant: '#36485d'
  secondary-fixed: '#a5f0e5'
  secondary-fixed-dim: '#8ad4c9'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#e6deff'
  tertiary-fixed-dim: '#cabeff'
  on-tertiary-fixed: '#1c0956'
  on-tertiary-fixed-variant: '#493c83'
  background: '#faf9f6'
  on-background: '#1a1c1a'
  surface-variant: '#e3e2e0'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-lg:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system sets the visual, tactile, and emotional foundation for a clinical-grade yet deeply human recovery companion. Engineered specifically for individuals transitioning back into life following depression interventions (e.g., Transcranial Magnetic Stimulation), the interface balances institutional trust and medical rigor with warm, grounding reassurance.

### Design Movement: Atmospheric Biomorphism
The visual dialect merges warm minimalism with soft, atmospheric glass layers. Instead of cold hospital grays or patronizingly cheerful gamification, the interface relies on ambient depth, organic contours, and calm breathing spaces. Visual elements reflect gradual neuroplastic stabilization—gentle transitions, luminous gradients, and tactile reassurance designed to keep cognitive load minimal for recovering nervous systems.

### Core Tenets
- **Reassurance Without Patronization:** Tone and layouts remain calm, sophisticated, and mature. Medical clarity is delivered through deliberate spacing and quiet typography rather than alarming alerts or overly bright celebratory confetti.
- **Cognitive Ease:** High-contrast text against calming surfaces prevents sensory fatigue. Layouts favor progressive disclosure and generous safe boundaries.
- **Biometric Presence:** Visual cues mimic restorative patterns—gentle undulating gradients, soft breathing glows, and fluid micro-states that validate small daily steps.

## Colors

The palette mirrors dawn light—moving from quiet night toward restoration. It deliberately avoids clinical whites and harsh stark blues in favor of grounded indigos, stabilizing sea-teals, and therapeutic lavenders.

### Palette Roles
- **Primary (`#15283B` / Midnight Navy):** Serves as the primary anchor for text, critical interactive paths, structural icons, and high-emphasis boundaries. Provides uncompromising legibility and quiet authority.
- **Secondary (`#65AFA5` / Muted Teal):** Represents neuroplastic healing and equilibrium. Used for affirmative actions, completion indicators, stability metrics, and calming focal points.
- **Tertiary (`#A99BEA` / Soft Lavender):** Signifies reflection and introspection. Ideal for journaling prompts, cognitive check-ins, sleep tracking, and subtle atmospheric glows.
- **Neutral Canvas (`#F9F8F5` / Warm Ivory):** The base background surface across all views. Gently reflects natural ambient light to mitigate eye strain.
- **Mist Blue (`#DCEBF1`):** Applied as a supportive tinted surface for nested cards, secondary tags, and track progress backgrounds.
- **Gentle Coral Accent (`#E8A99A`):** Used sparingly to denote gentle nudges, emotional outliers, or reflective check-in markers that require gentle user attention without triggering anxiety.

### Surface System
- Default screens sit on `#F9F8F5`.
- Elevated modules utilize pure `#FFFFFF` enriched with a translucent border overlay (`rgba(22, 40, 59, 0.06)` or `rgba(255, 255, 255, 0.85)` depending on depth) to preserve layer hierarchy without heavy drop shadows.

## Typography

The typographic hierarchy prioritizes comfort, high legibility, and humanist geometry. Plus Jakarta Sans brings open apertures and soft structural forms that avoid clinical rigidity, while Manrope handles technical indicators, numerical tracking, and compact labels with geometric precision.

### Typographic Rules
- **Headline Rendering:** Headlines must always render in Midnight Navy (`#15283B`) with tight letter-spacing to ground the screen's visual center. Never use light font weights (<500) on large titles.
- **Body Comfort:** Body copy leverages generous line-height ratios (1.55x–1.62x) to ensure frictionless reading for users experiencing mental fatigue or visual exhaustion.
- **Numeric Clarity:** Metrics, session streaks, and clinical scores leverage Manrope with tabular figures to align cleanly across dashboard feeds.

## Layout & Spacing

A disciplined spacing rhythm creates order and calm. The layout relies on an 8-point base spatial system designed to structure native mobile screen viewports.

### Screen Layout Principles
- **Margins & Safe Zones:** A standard `1.25rem` (20px) horizontal gutter buffers the mobile canvas. This creates breathing room along device hardware boundaries and prevents visual overcrowding.
- **Vertical Airflow:** Screen sections must be separated by `space-xl` (36px) or `space-lg` (24px). Compact spacing is reserved strictly for atomic sub-elements inside cards (e.g., metric label to value using `space-xs`).
- **Scroll Sanctuary:** Scroll views terminate with a generous bottom clearance (at least 64px above sticky navigation) to eliminate thumb crowding and prevent accidental interactions with primary call-to-actions.

## Elevation & Depth

Visual hierarchy uses physical and atmospheric cues: layered, pristine white surfaces suspended above the warm ivory canvas with soft, multi-spectrum ambient halos instead of harsh grey drops.

### Elevation Levels
- **Base Canvas (Level 0):** `#F9F8F5`. Flush surface without shadow or border.
- **Resting Sheet / Card (Level 1):** `#FFFFFF` paired with an ultra-fine border: `1px solid rgba(21, 40, 59, 0.05)`. Underneath rests a gentle ambient shadow: `0 4px 20px -2px rgba(21, 40, 59, 0.04)`.
- **Interactive Elevated Capsule (Level 2):** `#FFFFFF` with `0 12px 32px -4px rgba(21, 40, 59, 0.07)`, bounded by `1px solid rgba(255, 255, 255, 0.8)`. Used for dynamic wellness tracking modules, modal dialogues, and active audio players.
- **Ambient Breathing Halos:** For biofeedback loops and interactive breathing cards, soft atmospheric glows (`0 0 40px rgba(101, 175, 165, 0.18)` or `0 0 32px rgba(169, 155, 234, 0.20)`) are applied behind elements to signal dynamic state transitions without abrupt movement.

## Shapes

The shape system is soft and organic. Sharp 90-degree corners are eliminated to evoke warmth, comfort, and human receptivity.

### Shape Hierarchy
- **Pill Containers (`rounded-full`):** Standard for primary interactive buttons, chips, micro-badges, and audio playheads.
- **Primary Cards & Modals (`rounded-3xl` / 1.5rem–2rem):** Outer modular containers, daily reflective prompts, and chart wrappers utilize generous curvature to frame content like rounded touchstones.
- **Nested Controls (`rounded-2xl` / 1rem):** Internal input fields, sub-cards, and selectable option items scale their radius proportionally to ensure concentric harmony within larger rounded cards.

## Components

### Buttons
- **Primary:** Filled in `#15283B` with pure white text, full pill roundedness (`rounded-full`), height of 52px. Internal padding `1rem` vertical by `1.75rem` horizontal. On touch, smoothly dims to 92% opacity with micro-scale compression.
- **Secondary (Calming State):** Solid `#65AFA5` or `#DCEBF1` with `#15283B` text. Ideal for non-urgent confirmations, guided soundscape triggers, or gentle check-ins.
- **Ghost / Tertiary:** Transparent background, `1px solid rgba(21, 40, 59, 0.12)`, text `#15283B`. Subtle, unobtrusive.

### Cards
- **Recovery Glass Card:** Pure `#FFFFFF` fill with `backdrop-filter: blur(12px)`. Outlined with `1px solid #E6ECEF`. Border radius `rounded-3xl` (24px). Internal padding `space-lg` (24px).
- **Biofeedback / Atmosphere Card:** Subtly infused with linear background blends (e.g., `#FFFFFF` blending to `#F2F8F8`), flanked by a faint teal or lavender boundary.

### Chips & Badges
- Pill-shaped (`rounded-full`), height 32px, text set in `label-lg`.
- **Selected State:** `#15283B` background with `#F9F8F5` text.
- **Unselected State:** `#DCEBF1` at 50% opacity, text in `#15283B`, zero stroke.

### Input Fields
- Enclosed capsules (52px height) with `#FFFFFF` background, `rounded-2xl`, and subtle boundary `1px solid rgba(21, 40, 59, 0.08)`.
- **Focus State:** Transitions smoothly to a stroke of `#65AFA5` accompanied by an ambient halo `0 0 0 3px rgba(101, 175, 165, 0.15)`. Text sits in `body-md` in `#15283B`, placeholder rendered in `#15283B` at 40% opacity.

### Selection Controls (Checkboxes & Radios)
- Smooth circular checks (`rounded-full`) rather than square tick boxes.
- When inactive: `2px solid rgba(21, 40, 59, 0.2)` with transparent interior.
- When active: Animated smooth fill of `#65AFA5` containing an interior white circular dot or subtle checkmark.

### Specialty: Daily Horizon Dial & Audio Waveform Player
- **Daily State Slider / Audio Orb:** A continuous tactile slider with a soft breathing lavender-teal glow (`rgba(169, 155, 234, 0.3)`).
- **Voice / Sound Prompts:** Displays rounded organic frequency bars styled in alternating `#65AFA5` and `#A99BEA` hues, communicating supportive conversational listening without harsh digital spikes.