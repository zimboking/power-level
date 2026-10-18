# Third-party notices

## Exercise catalogue

`js/data/catalog.json` is derived from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
by Ollie Jennings and contributors, released under **The Unlicense** (public domain). Exercise
photos are loaded from that repository at runtime.

## Body diagram geometry

`js/data/body.json` holds muscle outlines from [MuscleMap](https://github.com/melihcolpan/MuscleMap)
by Melih Colpan, as converted to JSON in [openGym](https://github.com/DuarteSantos8/openGym)
(see its NOTICE.md). Used under the **MIT License**:

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Food composition data

`js/data/foods.json` is derived from the **Australian Food Composition Database (AFCD),
Release 3** (December 2025) by **Food Standards Australia New Zealand**, from the
[AFCD download page](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/australian-food-composition-database-download-excel-files).
Used under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) as
stated in the [FSANZ copyright notice](https://www.foodstandards.gov.au/copyright).
Attribution: Food Standards Australia New Zealand. FSANZ does not endorse this app.

Changes made: only energy, protein, total fat and available carbohydrate (with sugar alcohols)
per 100 g are kept; energy ("with dietary fibre, equated") is converted from kJ to kcal
(÷ 4.184, rounded) and macros are rounded to 0.1 g. See `tools/build-foods.mjs`.

## Packaged products

Barcode and product search use [Open Food Facts](https://world.openfoodfacts.org) at runtime.
Its database is available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/)
and individual contents under the [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/).
Product data © Open Food Facts contributors. Nothing from it is bundled with the app; products
a user saves are kept only in their own browser.

The camera scanner falls back to [barcode-detector](https://github.com/Sec-ant/barcode-detector)
(MIT) with [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (MIT, ZXing-C++ Apache-2.0), loaded
from jsDelivr only on browsers without a built-in `BarcodeDetector`.

## Quick-pick food estimates

The ~50 quick picks in `js/nutrition.js` were typed from general knowledge, not from a cited
table. The app labels them as estimates.

## Ideas

Feature ideas (deriving targets from the log, progression policies, the RIR %1RM table) come
from openGym (AGPL-3.0). No openGym source code is included here.

## CapySpa

`js/water.js`, `js/ui/capyspa.js`, `js/ui/capy-stats.js` and `js/ui/onsen.js` are ported from
[Water-habit-app-2](https://github.com/zimboking/Water-habit-app-2) (CapySpa) by zimboking,
released under the **Apache License 2.0**. Changes: rewritten from React + Tailwind to Preact + htm,
stored in Power Level's state and backups, themed for light and dark, mock history and the
simulated Squad tab removed.
