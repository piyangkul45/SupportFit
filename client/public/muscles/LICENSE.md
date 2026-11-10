# Muscle category renders

The `*.webp` files in this folder are original renders made for SupportFit. They show the
detailed silver 3D muscle mannequin from `client/scripts/mannequin/` (built with
[three.js](https://threejs.org), MIT licence), with the category's target muscles in red-orange,
on a transparent background (720×540, 4:3). No photos, skeleton scans or third-party models are used.

They are used by `MuscleCategorySelector` (Exercise Library) and `BodyPartFilter` (AI Coach).
Regenerate with `client/scripts/build-muscle-icons.mjs`. The camera and pose for each category are in `ICONS`.
