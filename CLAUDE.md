# Design & Development Guardrails

This file is the source of truth for all design, UX, and copy decisions across this project. Read it before writing any UI code.

---

## Brand Philosophy: "Stealth AI"

The target audience is small businesses in the trades (builders, contractors, craftspeople). They value craftsmanship, reliability, and tangible results. They are skeptical of tech hype. The UI must feel **organic, earthbound, Scandinavian, and minimalistic**. The technology should be powerful but invisible — the experience should feel calm and grounded, not futuristic.

---

## Colors — Earth Tones Only

| Token | Hex | Use |
|-------|-----|-----|
| `--linen` | `#FAF9F6` | Page background |
| `--bark` | `#1C1917` | Primary text, buttons |
| `--slate` | `#475569` | Secondary text, muted |
| `--forest` | `#166534` | Accent, success, CTAs |
| `--sand` | `#D2B48C` | Warm highlights, dividers |
| `--oak` | `#8B6F47` | Tertiary accents |

**Absolutely forbidden:** neon, purple, glowing effects, gradients, blue/electric hues, or anything that evokes a "traditional AI" aesthetic (nodes, circuits, heatmaps, etc.).

---

## Typography

- **Font:** Inter (sans-serif). No display or serif fonts.
- **Headers:** Large, confident, tight letter-spacing (`tracking-tight` or `letter-spacing: -0.02em`). Massive whitespace around them.
- **Body:** Small, quiet (`text-sm` to `text-base`). Let whitespace do the heavy lifting.
- **Labels / UI text:** Uppercase, tracked wide (`tracking-widest text-xs`). Minimal, functional.

---

## Animations — Spring Physics Only

All Framer Motion animations **must** use spring physics. No `ease`, `linear`, or cubic-bezier easing. Use:

```ts
transition={{ type: "spring", stiffness: 100, damping: 20 }}
```

Interactions should feel like physical objects with weight — things should settle into place, not slide or fade mechanically. Loading states should feel organic (e.g., ink soaking into paper, not a spinner).

---

## Copywriting Rules

**Never use these words in user-facing text:**
- LLM
- Agent
- Prompt
- Neural Network
- AI model
- Machine learning

**Translate all value into business outcomes:**

| Instead of | Use |
|-----------|-----|
| "AI-powered" | "Instant" / "Automated" |
| "LLM generates" | "Your estimate is ready in seconds" |
| "Prompt the AI" | "Describe the job" |
| "Agent workflow" | "Your system handles it" |
| "Neural network" | (omit entirely) |

Lead with: **time saved, money made, errors eliminated.**

---

## Component Conventions

- **Buttons:** Rectangular (no border-radius). Uppercase, wide-tracked labels.
- **Cards:** Hairline borders (`border-foreground/10`). No drop shadows — use spacing instead.
- **Forms:** Minimal. Labels above inputs, small and uppercase. No floating labels.
- **Icons:** Use simple line-art SVG (Lucide). Keep them small and quiet (`w-4 h-4` or `w-5 h-5`).
- **Dividers:** Use whitespace over `<hr>` elements. If a divider is needed, use sand color at low opacity.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) |
| Animation | Framer Motion (spring physics only) |
| 3D/Canvas | React Three Fiber + Drei |
| AI | Vercel AI SDK + Anthropic |
| Rate limiting | Upstash Redis |
| Database | Convex |

---

## File Structure

```
website/
  app/                  # Next.js App Router pages + API routes
    api/                # Route handlers (AI streaming, form submission)
  components/
    ui/                 # shadcn/ui primitives
    sections/           # Page sections (Hero, Demo, ValueProp, Contact)
  lib/                  # Utilities, Convex client, rate limiter setup
  hooks/                # Custom React hooks
```
