# 3D anatomy exercise animations

The `*.mp4`, `*.webm` and `*-poster.webp` files in this folder are rendered for SupportFit from real human
anatomy meshes:

- **BodyParts3D**, © The Database Center for Life Science, [CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)
- **Z-Anatomy**, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The meshes come from [BodyExplorer](https://github.com/JohanBellander/BodyExplorer)'s `anatomy.glb` /
`skeleton.glb` (commit `cd2a639`).

Changes: the meshes are skinned to SupportFit's own rig. The joints are measured from the skeleton
(femoral and humeral heads, L5/T12/C7). The motions, props and camera are original
(`client/scripts/mannequin/`, three.js, MIT). The rendering uses a matte silver body with `#f97316` glowing
target muscles, studio key + `#38bdf8` rim lighting and a soft radial glow on `#0e1a24`, in a 3/4 view
(`<slug>.*`) and a side view (`<slug>-side.*`). These adapted animations are shared under **CC BY-SA 4.0**.

Regenerate with `client/scripts/build-mannequin-videos.mjs`.
