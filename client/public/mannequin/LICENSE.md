# 3D mannequin exercise animations

The `*.mp4`, `*.webm` and `*-poster.webp` files in this folder are original animations made for
SupportFit. They are rendered from the stylised 3D mannequin, poses and props in
`client/scripts/mannequin/` (built with [three.js](https://threejs.org), MIT licence).
No photos, motion-capture data or third-party models are used.

Target muscles glow orange-red (secondary muscles glow faintly). Colours come from
`getAnatomy()` in `src/utils/exerciseAnatomy.js`. The background is `#0e1a24`, matching the cards.

Regenerate with `client/scripts/build-mannequin-videos.mjs` (see its header for the tools it needs).
