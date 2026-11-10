# Exercise anatomy videos

The `*.mp4`, `*.webm` and `*-poster.webp` files in this folder are adapted from the
exercise illustrations of [Everkinetic](https://github.com/everkinetic/data)
(commit `446bb9a`), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Changes: start and tension frames recoloured to light lines on black and combined
into a looping crossfade video. These adapted files are shared under the same
CC BY-SA 4.0 license.

Regenerate with `client/scripts/build-exercise-videos.mjs`.

## Photo demos (Free Exercise DB)

The clips listed in `FREE_EXERCISE_DB_IDS` (`src/utils/exerciseMedia.js`) — e.g. `plank.*`,
`mountain-climber.*`, `hanging-leg-raise.*`, `boxing.*`, `yoga.*` — are made from the start/end
photos of [Free Exercise DB](https://github.com/yuhonas/free-exercise-db)
(commit `f00c92c`), released into the public domain under the
[Unlicense](https://unlicense.org/). Changes: cropped to 480×320 and combined into a looping
crossfade video. Regenerate with `client/scripts/build-photo-videos.mjs`.
