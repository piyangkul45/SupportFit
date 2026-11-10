# Muscle category renders

The `*.webp` files in this folder are renders made for SupportFit from real human anatomy meshes:

- **BodyParts3D**, © The Database Center for Life Science, licensed under
  [CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)
- **Z-Anatomy** (muscles missing from BodyParts3D, e.g. latissimus dorsi and rectus abdominis), licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The combined meshes come from `anatomy.glb` / `skeleton.glb` of
[BodyExplorer](https://github.com/JohanBellander/BodyExplorer) (commit `cd2a639`).

Changes: rendered as a silver-metallic écorché with procedural muscle-fibre striations. The category's
target muscles are orange-red. Changes to the anatomy: the six-pack intersections are embossed, the front
aponeurosis of the external oblique over the rectus abdominis is trimmed, and deep abdominal layers are hidden.
The images are posed through the app's rig, cropped per category and given a transparent background (720×540).
These adapted images are shared under **CC BY-SA 4.0**.

Regenerate with `client/scripts/build-muscle-icons.mjs`. The pose and camera for each category are in `ICONS`.
