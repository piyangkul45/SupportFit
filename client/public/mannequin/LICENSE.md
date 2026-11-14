# 3D exercise animations

The `*.mp4`, `*.webm`, `*-poster.webp` and `*-target.webp` files in this folder (and `public/muscles/*.webp`) are
rendered for SupportFit from its own procedural 3D athlete model. No third-party model files are used.

- Model: `client/scripts/mannequin/body.js`. About 150 named muscle, tendon and body-core shapes are blended into one
  opaque surface (signed-distance field + Surface Nets) with articulated fingers. The surface has a striated
  muscle-fibre shading in `#94a3b8` with `#e2e8f0` tendons, target muscles in `#ea580c`, and black shorts.
- Rig, motions (3D two-bone IK, grip, foot and bench contact), equipment, studio lighting and camera:
  `client/scripts/mannequin/` (three.js, MIT).

Regenerate with `client/scripts/build-mannequin-videos.mjs` (clips) and `client/scripts/build-muscle-icons.mjs`
(muscle icons and target figures).
