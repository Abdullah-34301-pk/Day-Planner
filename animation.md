---
version: alpha
name: Day-Planner-animation-spec
description: Apple-style motion system for the Day Planner — quiet, physical, restrained. Scroll-triggered reveals fade+rise sections into view exactly once, numbers count up instead of snapping, bars and rings grow from zero, and every interactive element gets the same 0.95-scale press. No bounce, no spin, no decorative motion — motion exists only to confirm what the user just did or to introduce a section as it arrives.
source_reference: Adapted from DESIGN-apple.md's motion cues (button press scale, backdrop-blur sticky bars, product-shadow-only elevation) since the source doc does not formalize a scroll/animation system — this spec extends that visual language into motion for a single-page app with no full-bleed product tiles.

principles:
  - "One easing curve does almost everything. Consistency, not variety, is what reads as 'expensive.'"
  - "Motion confirms, it doesn't decorate. Every animation must answer 'what just changed?'"
  - "Reveal once per element. Scroll-triggered entrances never replay when scrolling back up past an already-seen section."
  - "Numbers count, they don't snap. Streaks, percentages, and stats animate toward their value."
  - "Respect prefers-reduced-motion. Every entrance/scroll animation collapses to an instant opacity swap; press-states stay (they're feedback, not decoration)."

easing:
  standard: "cubic-bezier(0.28, 0.11, 0.32, 1)"     # the "Apple ease" — fast start, long soft landing
  press: "cubic-bezier(0.4, 0, 0.2, 1)"              # quicker, symmetric — for the 0.95 scale tap
  note: "Never use a bounce/elastic curve anywhere in this system. Apple's motion has zero overshoot."

durations:
  micro: 150ms      # button press, checkbox toggle, icon-button tap
  short: 220ms       # tab switch crossfade, badge appear, toast in/out
  base: 400ms        # card/row reveal on scroll, drawer slide
  long: 600ms        # hero entrance, streak count-up, weekly-bar grow
  count-up: 900ms    # numeric stat animations specifically (streak, today %, task count)

---

## Motion Philosophy

This app doesn't have Apple's full-bleed alternating product tiles — it's a single-page utility tool, not a marketing scroll. So instead of copying tile-by-tile parallax, this spec borrows Apple's actual *motion grammar* — restraint, one easing curve, press-scale feedback, numbers that count instead of snap — and applies it to the planner's real sections: the hero, the focus-stat row, the tab panel, the table/calendar views, and the insights charts.

The rule of thumb: **if Apple wouldn't animate it, we don't either.** No spinning icons, no confetti-per-click, no hover-wiggle. Motion is there to make state changes legible, not to entertain.

---

## Scroll-Triggered Reveals

Every major section reveals itself once, the first time it enters the viewport, via `IntersectionObserver` (threshold ~0.2). Once revealed, an element gets a `data-revealed="true"` flag and never re-animates — scrolling back up and down again shows it in its resting state, matching Apple's "reveal once" behavior on product pages.

| Section | Entrance | Timing |
|---|---|---|
| `.hero` copy (h1, hero-text, hero-actions) | Fade + rise 16px → 0, staggered 80ms between the eyebrow, h1, paragraph, and button row | `long` (600ms), `standard` easing |
| `.summary-card` | Fades + rises in 150ms after hero-copy starts (it's the "product render" of this page — it gets a beat of its own) | `base` (400ms) |
| `.focus-row` cards (streak / today / next-up) | Each card fades + rises, staggered 100ms left → right | `base` (400ms) per card |
| `.tabs-panel` | Fades in as a whole unit, no stagger (it's chrome, not content) | `short` (220ms) |
| `.insight-card` (weekly momentum, timer, upcoming) | Staggered 120ms, same fade+rise as focus-row | `base` (400ms) |
| Table rows (`.task-table tbody tr`) | On tab switch to "View Plans" — not scroll — rows cascade in top→bottom, staggered 40ms, capped at first 10 rows to avoid a sluggish feel on long lists | `short` (220ms) |
| `.calendar-day` cells | Staggered 15ms per cell in reading order (row by row) the first time the calendar view is opened | `micro`–`short` blend (180ms) |

**Reveal transform recipe** (the one used almost everywhere above):
```css
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 400ms cubic-bezier(0.28, 0.11, 0.32, 1),
              transform 400ms cubic-bezier(0.28, 0.11, 0.32, 1);
}
.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

---

## Numeric Count-Up

Apple never animates a stat by having it blink into a new number — the closest analog on their site is the smooth odometer-style transitions on pricing/spec pages. This planner has three live numbers that deserve the same treatment instead of snapping:

- **`#streak-count`** — counts up from its previous value to its new value over `count-up` (900ms), easing `standard`. Triggers whenever a task is marked done/undone and the streak changes.
- **`#today-progress`** — the percentage counts up digit by digit (0% → 100%) over `count-up`, same trigger.
- **`#task-count` / `#done-count` / `#urgent-count`** — count up once on initial page load (from 0 to their true value) as part of the hero-entrance sequence, then simply crossfade (`short`, 220ms) to new values afterward — no re-count-up on every add/remove, since that would get noisy on a list someone edits constantly.

Implementation is a simple `requestAnimationFrame` interpolation from old value to new value using `easing.standard`; respects `prefers-reduced-motion` by jumping straight to the final number.

---

## Bars, Rings & Fills

Anything representing a proportion grows from zero the first time it's revealed — this is the direct analog of Apple's product-shadow-on-render idea: the one "special" visual treatment reserved for a specific kind of content (here, proportional data).

- **`.week-bar`** (weekly momentum) — height animates from 0 → target over `long` (600ms), staggered 60ms bar-to-bar, `standard` easing. Re-grows (from current height, not from 0) if the underlying data changes later in the session.
- **Today's progress** (if a ring or bar is added to the `#today-progress` focus card) — same grow-from-zero on first reveal, then smooth transition on change.
- **Focus timer** — the countdown itself does *not* animate as a fill (ticking numbers only, per Apple's "no decorative motion" rule) — but if a circular/linear timer track is added, it should deplete smoothly rather than jump per second, using a CSS `transition` on `stroke-dashoffset` / `width` set to exactly 1000ms linear (matching the real-time nature of a clock — the only place a linear, non-eased curve is correct in this whole system).

---

## Interactive Press States

Directly lifted from Apple's one system-wide micro-interaction:

- **Every button, tab, icon-button, quick-add chip, and checkbox** scales to `0.95` on `:active`, `micro` duration (150ms), `press` easing. No exceptions, no per-component variants — this consistency is the point.
- **Tab switching** (`Add Plan` / `View Plans` / `Insights` / `Data`) crossfades the outgoing panel out and incoming panel in over `short` (220ms) rather than an instant `display: none/block` swap. Active tab pill background transitions over the same duration.
- **View toggle** (Table ↔ Calendar) — same crossfade treatment as tabs.

```css
button:active, .tab-btn:active, .quick-add-btn:active, .icon-btn:active {
  transform: scale(0.95);
  transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Overlays & Transient UI

- **Motivation banner** — slides down + fades in (`base`, 400ms) when it appears after the last task is completed; slides up + fades out on the same curve if it becomes hidden again. This is the planner's version of Apple's floating sticky bar appearing on scroll — a piece of chrome that responds to state, not to scroll position.
- **Status message** (`#status-message`) — fades in over `short` (220ms) on any status update; no exit animation needed since it's just replaced by the next message.
- **Drag-reorder** — the dragged row lifts with a `box-shadow` and `scale(1.02)` while dragging (the *only* place a shadow appears in this system outside Apple's product-shadow equivalent — reserved, as Apple reserves shadow for product imagery, purely for "this is being physically moved").

---

## What NOT to Animate

Matching Apple's "Don't" list directly:

- Don't add hover-only animations — this is a planner used on both touch and desktop; hover states aren't part of this system (only default and active/pressed, per Apple's own rule).
- Don't spin, bounce, or elastic-overshoot anything — every curve in this doc is `cubic-bezier(0.28, 0.11, 0.32, 1)` or its press variant, full stop.
- Don't re-trigger scroll reveals on scroll-up — a section that has already been seen stays in its resting state.
- Don't animate the table/calendar on every re-render (e.g. every keystroke in the search box) — only on the meaningful transitions listed above (tab switch, initial view, data change). Debounce search input rendering so typing doesn't retrigger row animations per character.

---

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .reveal, .week-bar, #streak-count, #today-progress {
    transition: none !important;
    animation: none !important;
  }
  .reveal { opacity: 1; transform: none; }
}
```
Press-state `scale(0.95)` stays even under reduced motion — it's feedback confirming a tap registered, not decorative motion, matching how Apple treats its own button press state as functional rather than ornamental.
