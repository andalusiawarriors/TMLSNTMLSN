# Gold mesh: ideas to make the colour pop more

## Current levers
- 7 ellipses (2 strong highlights, 2 base highlight, 2 mid, 1 lowlight)
- BlurView intensity 100, **tint "dark"**
- Dark overlay opacity **0.04**
- Peak highlight lightening 62% and 50%

## Brainstorm

1. **BlurView tint for gold = "light"**  
   `tint="dark"` adds a dark cast to the blur. For gold only, use `tint="light"` so the blur brightens instead of darkens. Quick win.

2. **Remove overlay for gold (0)**  
   Overlay is already 0.04. Drop to 0 so the mesh is not dimmed at all. Text contrast may need watching.

3. **Stronger peak highlight**  
   Push lightening to 75% and 60% so the brightest ellipses are almost cream. Adds a clear “pop” at top-left.

4. **Lighten the whole gradient for gold**  
   Lighten all champagne colors slightly (e.g. 12% highlight, 8% mid, 5% lowlight) so the entire mesh is brighter but keeps the same gradient relationship.

5. **Add a near-white ellipse**  
   One extra ellipse: lighten first color by 85% (almost white/cream), placed at top-left. Acts like a specular highlight.

6. **Slightly lower blur for gold (e.g. 80)**  
   Less blur = more saturation and less wash-out. Could make gold feel more vivid.

7. **Subtle highlight gradient on top (gold only)**  
   After mesh + blur, add a very subtle LinearGradient (e.g. transparent → 6% white at top-left) to simulate a highlight. Design-layer fix.

8. **Warm overlay instead of dark**  
   Replace overlay with a very subtle warm tint (e.g. low-opacity gold) so we don’t cool the mesh.

## Implementation (this round)
- Use **tint="light"** for gold so the blur doesn’t darken.
- Set gold overlay to **0**.
- Increase peak highlight lightening to **0.75** and **0.6**.
- Lighten base gold colors slightly: highlight +12%, mid +8%, lowlight +5% so the whole mesh pops.
