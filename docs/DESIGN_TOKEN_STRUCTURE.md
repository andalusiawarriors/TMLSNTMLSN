# Design Token Structure

> **Source:** Extracted from Figma file variable structure (screenshots provided).  
> **Collections:** `base` (26 vars) | `alias` (60 vars) | `typography` (27 vars)

---

## Overview

The Figma file uses a three-tier token hierarchy. The critical connection point is the **`scale`** primitive: both `alias` and `typography` derive their values from `scale/X` tokens.

```
                    ┌─────────────────────────────────────┐
                    │            base (scale)               │
                    │  scale/0, scale/4, scale/8, scale/12  │
                    │  scale/16, scale/20, scale/24, ...    │
                    └────────────────┬──────────┬─────────┘
                                     │          │
              ┌──────────────────────┘          └──────────────────────┐
              ▼                                                         ▼
┌─────────────────────────────┐                         ┌─────────────────────────────┐
│  alias (spacing, radius,     │                         │  typography                 │
│  border, color)              │                         │  font size, line height,     │
│  sp-4 → scale/4              │                         │  paragraph spacing          │
│  rd-8 → scale/8              │                         │  body.sm → scale/12         │
│  color/surface → color/...   │                         │  heading.h1 → scale/64      │
└─────────────────────────────┘                         └─────────────────────────────┘
```

- **Base:** Raw primitives — `scale` numbers, hex colors, font families, font weights
- **Alias:** Semantic tokens that **reference** base (e.g. `sp-4` → `scale/4`, `color/surface/background` → `color/neutral/500`)
- **Typography:** Text properties that **reference** scale (e.g. `body/sm` → `scale/12`, `headings/h1` → `scale/64`)

---

## 1. Base Collection (26 variables)

Primitive values. No references to other tokens.

### Scale (Foundation)

The `scale` variables are the central primitive. All size-related tokens (spacing, radius, border, font size, line height) ultimately resolve to `scale/X`:

| Variable | Value (inferred) | Usage |
|----------|------------------|-------|
| `scale/-1` | -1 | — |
| `scale/0` | 0 | Border width, none spacing/radius |
| `scale/1` | 1 | Border width br-1 |
| `scale/2` | 2 | Border width br-2 |
| `scale/4` | 4 | sp-4, rd-4 |
| `scale/8` | 8 | sp-8, rd-8 |
| `scale/12` | 12 | Body font size sm, line height sm |
| `scale/16` | 16 | sp-16, rd-16, body font size md, line height md |
| `scale/20` | 20 | Body font size lg, headings h5, h6 line height |
| `scale/24` | 24 | sp-24, rd-24, body line height lg |
| `scale/28` | 28 | Heading h5 font size |
| `scale/32` | 32 | sp-32, rd-32, headings h4 font/line |
| `scale/36` | 36 | Heading h3 |
| `scale/40` | 40 | sp-40, rd-40, heading h2 |
| `scale/64` | 64 | Heading h1 font size / line height |
| `scale/200` | 200 | rd-200 (large radius) |

### Color (Base)

| Path | Value |
|------|-------|
| `color/neutral/white` | `#FFFFFF` |
| `color/neutral/100` | `#C1C1C1` |
| `color/neutral/200` | `#ACACAD` |
| `color/neutral/300` | `#828383` |
| `color/neutral/400` | `#59595A` |
| `color/neutral/500` | `#2F3031` (Primary Dark Background) |
| `color/neutral/600` | `#262627` |
| `color/neutral/700` | `#1C1D1D` |
| `color/neutral/800` | `#131314` |
| `color/neutral/900` | `#0E0E0F` |
| `color/neutral/black` | `#000000` |
| `color/lightgrey/…` | 9 variables (semantic lighter greys) |
| `color/green/500` | `#48B14B` |

### Type (Base)

| Path | Value |
|------|-------|
| `type/font weight/regular` | `regular` |
| `type/font weight/semibold` | `semibold` |
| `type/font weight/bold` | `bold` |
| `type/font family/headings` | `eb garamond` |
| `type/font family/body` | `dm mono` |

---

## 2. Alias Collection (60 variables)

Semantic tokens that **reference** base tokens. Organized into groups.

### Groups Overview

| Group | Count | Purpose |
|-------|-------|---------|
| `color` | 18 | Surface, text, button, icon colors |
| `text` | 12 | heading (2), body (3), link (2), disabled (3), information (1), success (1) |
| `surface` | 4 | background, buttons |
| `background` | 1 | — |
| `buttons` | 3 | button-on, button-hover, button-disabled |
| `icons` | 2 | — |
| `main` | 2 | — |
| `disabled` | 3 | — |

### sizes / spacing

| Alias | References |
|-------|------------|
| `none` | `scale/0` |
| `sp-4` | `scale/4` |
| `sp-8` | `scale/8` |
| `sp-16` | `scale/16` |
| `sp-24` | `scale/24` |
| `sp-32` | `scale/32` |
| `sp-40` | `scale/40` |

Additional raw spacing values: 28, 32, 36, 38, 40, 48, 52, 64, 80, 120, 160, 200.

### sizes / radius

| Alias | References |
|-------|------------|
| `none` | `scale/0` |
| `rd-4` | `scale/4` |
| `rd-8` | `scale/8` |
| `rd-16` | `scale/16` |
| `rd-24` | `scale/24` |
| `rd-32` | `scale/32` |
| `rd-38` | `scale/38` |
| `rd-40` | `scale/40` |
| `rd-200` | `scale/200` |

### sizes / border

| Alias | References |
|-------|------------|
| `border` | `scale/0` |
| `br-1` | `scale/1` |
| `br-2` | `scale/2` |

### Color Aliases → Base

| Alias | References |
|-------|------------|
| `color/text/information/default` | `color/lightgrey/500` |
| `color/text/success/default` | `color/green/500` |
| `color/surface/background/default` | `color/neutral/500` |
| `color/surface/buttons/button-on` | `color/lightgrey/500` |
| `color/surface/buttons/button-hover` | `color/lightgrey/600` |
| `color/surface/buttons/button-disabled` | `color/lightgrey/800` |
| `hover` | `color/lightgrey/900` |
| `active` | `color/lightgrey/600` |
| `color/text/disabled/100` | `color/neutral/100` |
| `color/text/disabled/200` | `color/neutral/200` |
| `color/text/disabled/300` | `color/neutral/300` |

---

## 3. Typography Collection (27 variables)

Typography tokens reference **scale** for all numeric properties (font size, line height, paragraph spacing).

### font size / body

| Token | References |
|-------|------------|
| `sm` | `scale/12` |
| `md` | `scale/16` |
| `lg` | `scale/20` |

### font size / headings

| Token | References |
|-------|------------|
| `h1` | `scale/64` |
| `h2` | `scale/40` |
| `h3` | `scale/36` |
| `h4` | `scale/32` |
| `h5` | `scale/28` |
| `h6` | `scale/20` |

### line height / body

| Token | References |
|-------|------------|
| `sm` | `scale/12` |
| `md` | `scale/16` |
| `lg` | `scale/24` |

### line height / headings

| Token | References |
|-------|------------|
| `h1` | `scale/64` |
| `h2` | `scale/40` |
| `h3` | `scale/36` |
| `h4` | `scale/32` |
| `h5` | `scale/28` |
| `h6` | `scale/20` |

### paragraph spacing

Mirrors the structure of `font size` and `line height` (body: sm, md, lg; headings: h1–h6), each referencing `scale/X`.

---

## 4. Connection Points Between Collections

### Base → Alias

1. **Scale → Sizing**
   - `alias/sizes/spacing` (sp-4, sp-8, …) → `base/scale/X`
   - `alias/sizes/radius` (rd-4, rd-8, …) → `base/scale/X`
   - `alias/sizes/border` (border, br-1, br-2) → `base/scale/X`

2. **Color → Semantic color**
   - `alias/color/surface/*` → `base/color/neutral/*`, `base/color/lightgrey/*`
   - `alias/color/text/*` → `base/color/neutral/*`, `base/color/lightgrey/*`, `base/color/green/*`
   - `alias/buttons/*`, `alias/hover`, `alias/active` → `base/color/*`

### Base → Typography

- **Scale → Typography numbers**
  - `typography/font size/body` (sm, md, lg) → `scale/12`, `scale/16`, `scale/20`
  - `typography/font size/headings` (h1–h6) → `scale/20`–`scale/64`
  - `typography/line height/*` → same `scale/X` values
  - `typography/paragraph spacing/*` → same pattern

- **Type → Typography**
  - Font family: `type/font family/headings`, `type/font family/body`
  - Font weight: `type/font weight/regular`, `semibold`, `bold`

### Alias → Typography (indirect)

- Text styles typically use `alias/color/text/*` for color, which chains:
  - `alias` → `base/color/*`

---

## 5. Flow Summary

| Change at… | Propagates to… |
|------------|----------------|
| `base/scale/16` | `alias/sp-16`, `alias/rd-16`, `typography/body/md` (font size & line height) |
| `base/color/neutral/500` | `alias/color/surface/background/default` → surfaces, cards |
| `base/color/lightgrey/500` | `alias/color/text/information`, `alias/buttons/button-on` |

The `scale` primitive is the single source of truth for all sizing. Updating a `scale/X` value updates spacing, radius, border, and typography across alias and typography collections.

---

## 6. Mapping to Code (`constants/theme.ts`)

| Figma | Code |
|-------|------|
| `color/neutral/500` | `Colors.primaryDark` |
| `color/neutral/400` (if present) / lightgrey | `Colors.primaryLight` |
| `scale/8`, `scale/16`, `scale/24`, `scale/32` | `Spacing.sm`, `Spacing.md`, `Spacing.lg`, `Spacing.xl` |
| `rd-8`, `rd-12`, `rd-16`, `rd-24` | `BorderRadius.sm`, `BorderRadius.md`, `BorderRadius.lg`, `BorderRadius.xl` |
| `typography/body/md` (16) | `Typography.body` |
| `typography/headings/h1` (64→32 if scale is 0.5px) | `Typography.h1` |
| `type/font family/body` | DMMono_400Regular |
| `type/font family/headings` | EB Garamond |

---

## 7. Visual Reference (Frame 1 & 2)

- **Frame 1:** Base swatches (light grey `#C6C6C6`, dark grey `#2F3031`), button aliases (primary = light bg + dark text, secondary = dark bg + light text), typography (Lorem Ipsum) using light grey text.
- **Frame 2:** Grayscale palette (light and dark scales) for neutral color tokens.
