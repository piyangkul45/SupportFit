# Muscle category renders

The `*.webp` files in this folder are adapted from 3D renders by
[BodyParts3D / Anatomography](https://lifesciencedb.jp/bp3d/) (© The Database Center for
Life Science), published on Wikimedia Commons under
[CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en):

| File | Source |
| --- | --- |
| `shoulders.webp` | [Deltoid muscle frontal.png](https://commons.wikimedia.org/wiki/File:Deltoid_muscle_frontal.png) |
| `back.webp` | [Latissimus dorsi muscle back.png](https://commons.wikimedia.org/wiki/File:Latissimus_dorsi_muscle_back.png) |
| `arms.webp` | [Biceps brachii muscle06.png](https://commons.wikimedia.org/wiki/File:Biceps_brachii_muscle06.png) |
| `glutes.webp` | [Gluteus maximus 3D.gif](https://commons.wikimedia.org/wiki/File:Gluteus_maximus_3D.gif) (frame 40) |
| `legs.webp` | [Quadriceps 3D.gif](https://commons.wikimedia.org/wiki/File:Quadriceps_3D.gif) (frame 0) |

Changes: cropped to the body region, background removed (transparent), muscles recoloured
to a single orange-red, bones dimmed, resized to 720×540 WebP. These adapted files are
shared under the same CC BY-SA 2.1 JP license.

Regenerate with `client/scripts/muscle-renders/process-render.cjs` (needs `sharp`; see its header).
