# Mesh gradient (ellipses + blur) vs linear gradient — design alignment

## Goal
Recreate the **gold (champagne) linear gradient** as a **card background** using **ellipses behind a blur overlay** so it looks the same: same highlights and lowlights, but non-linear (soft mesh).

## Reference: gold linear gradient
- **Colors:** `#E5D4B8` (highlight), `#D4B896` (mid), `#A8895E` (lowlight)
- **Usage:** `LinearGradient` start `{ x: 0, y: 0 }` end `{ x: 1, y: 0 }` → light on left, dark on right

## Approach (DesignUI + Mobile alignment)

1. **Use exact gradient colors**
   - No lightening or tinting. Use the same hex values so highlights and lowlights match.

2. **Map linear “direction” to ellipse positions**
   - Linear gradient: light → mid → dark (e.g. left → right).
   - Ellipses: place **highlight** ellipse(s) in the **top-left** area, **mid** in the **center**, **lowlight** in the **bottom-right**.
   - After blur, the card shows a similar light/mid/dark distribution without visible ellipse edges.

3. **Blur intensity**
   - Use **100** so the ellipses fully blend and no hard edges show.

4. **Overlay**
   - Keep a **subtle** dark overlay (e.g. 0.2–0.28) so text stays readable, or drop it for gold if the mesh is already dark enough.

5. **Ellipse size**
   - Large (e.g. 560px) so they extend past the card and get clipped; overlap creates smooth blending.

6. **Same recipe for quicksilver and default**
   - **Quicksilver:** use raw quicksilver gradient colors; same spatial mapping (highlight top-left, lowlight bottom-right).
   - **Default (neutral):** keep gray ellipses + overlay; no “gradient” to match, so current behavior is fine.

## Implementation (AddMealSheet)
- `meshColors`: for gold and quicksilver use **raw** gradient arrays (no `lightenColor`).
- Positions: one array per mesh type — e.g. gold = [topLeft, center, bottomRight] for the 3 champagne colors.
- BlurView `intensity={100}`.
- Overlay opacity tuned so gold card matches the “feel” of the linear gradient (highlights and lowlights visible).
