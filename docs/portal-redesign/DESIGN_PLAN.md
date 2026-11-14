# AIriane web redesign: inspection and plan

14 November 2026. Existing `/` is a server-rendered clinician workspace, even when signed out. It has one primary navigation item, a basic form login, dense inline JSX and query-based report selection. Cookie sealing, server-side verified clinician checks, no-store backend reads and authenticated PDF transport already exist. Alerts/reminder handlers currently forward the encrypted production cookie instead of opening it; preserve the cookie boundary and correct those two handlers during route migration. No backend, provider, database or deployment change is required.

The approved logos are retained byte-for-byte through the existing canonical raster exports. The Stitch reference and mobile theme establish the ivory surface, navy, teal, mint, Plus Jakarta Sans/Manrope typography, orb companion and Journey path. Use an SVG thread as layout composition, never as a replacement logo. Product previews are explicitly illustrative and never represented as testimonials or patient records.

Palette: midnight #001325; deep teal #166a61; mint #a3eee2; ivory #faf9f6; mist #e8efed; muted slate #515d69. Plus Jakarta Sans for expressive headings; Manrope for body/data, using existing locally hosted fonts. Public pages have an asymmetrical hero and large immersive companion composition, a horizontal story selector, alternating activity scenes, a Journey path and a clear sharing sequence. Workspace uses a compact navy rail and ivory reading canvas, searchable directory, period-based report navigation and editorial document view.

Public composition:
```
[approved logo]       [How it works] [For clinicians] [Privacy] [Sign in]
[large editorial headline + CTAs]     [thread + companion phone preview]
[interactive Ariadne story with one continuous line]
[conversation preview] [curated activities]
[Journey path] [patient-controlled sharing] [clinician document preview]
[privacy boundaries] [footer]
```

Protected composition:
```
[nav rail] [clinician identity / sign out]
           [title / patient context / next action]
           [directory or report list]
           [document contents + readable report + Export PDF]
```

Review against brief: avoid a generic hero plus repeated SaaS tiles. Make the flowing thread/companion the one distinctive visual; use quiet typographic lists for the clinical workspace. No invented outcomes, endorsements, patient counts, compliance promises or contact address. No new animation dependency: CSS SVG drawing, IntersectionObserver reveals and state-driven previews suffice, with reduced-motion support. Public content is independent of auth; protected layouts and each data read revalidate identity/access on the server, with no fixture fallback in production. Existing PDF and care-action URLs remain stable; successful login redirects to `/dashboard`.
