# Research results · how to fill `thesis_results.json`

The **Quiulacocha research** section of the page reads **every number** from
`greendata/data/thesis_results.json`. Nothing is hard-coded in the page.

- While a block has no data, it stays hidden.
- While **no result block** has data, the section shows
  **"Results coming soon — research in progress"**.
- Leave a value as `null` (no quotes) when you don't have it yet. Don't write `0` for "unknown".
- Use a **dot** for decimals (`0.25`, not `0,25`) and no units inside the numbers.
- Check the file is valid JSON before you commit (for example at <https://jsonlint.com>).

## 1. `sampling`: map of the sampling points

| Field | Unit / format | Example of format |
|---|---|---|
| `points[].lat`, `points[].lon` | decimal degrees, WGS84 (south and west are negative) | `-12.345678` |
| `points[].description` | short text (optional) | `"Inflow channel"` |
| `date` | `YYYY-MM-DD` | `"2026-09-12"` |

The map appears once at least one point has `lat` and `lon`.

## 2. `design`

| Field | Unit | Note |
|---|---|---|
| `jar_test_runs` | count | total Jar Test runs actually performed |

## 3. `standard`: regulation used for comparison

| Field | Content |
|---|---|
| `short_name` | e.g. `"D.S. N.° 010-2010-MINAM (LMP)"` |
| `full_name` | official title of the regulation |
| `url` | link to the official text (SINIA / El Peruano) |
| `note` | which value you use: maximum at any moment or annual average, total or dissolved metal |

Suggested regulation for treated mine water discharged to the environment:
**D.S. N.° 010-2010-MINAM**, *Límites Máximos Permisibles para la descarga de
efluentes líquidos de actividades minero-metalúrgicas*
([SINIA](https://sinia.minam.gob.pe/normas/aprueban-limites-maximos-permisibles-descarga-efluentes-liquidos)).
If you compare with receiving-water quality instead, use the water quality
standards **D.S. N.° 004-2017-MINAM (ECA para Agua)**
([SINIA, PDF](https://sinia.minam.gob.pe/sites/default/files/sinia/archivos/public/docs/ds-004-2017-minam.pdf))
and say which category.
Copy the limits from the official text and agree on the choice with your advisor.

## 4. `metals`: concentrations and removal (one row per metal)

| Field | Unit | Meaning |
|---|---|---|
| `initial_mg_L` | mg/L | concentration in the raw acid mine drainage before treatment (ICP-OES) |
| `final_pitahaya_mg_L` | mg/L | concentration after treatment with pitahaya at the optimal conditions |
| `final_zapallo_mg_L` | mg/L | concentration after treatment with zapallo macre at the optimal conditions |
| `removal_pitahaya_pct`, `removal_zapallo_pct` | % (0–100) | optional. If empty, the page computes `(initial − final) / initial × 100` |
| `limit_mg_L` | mg/L | limit for that metal in the regulation of section 3. Leave `null` if the regulation has no limit for it |
| `limit_note` | text | optional, e.g. `"dissolved iron"`, `"applies to Cr VI only"` |

Values below the detection limit: write the detection limit and say so in `limit_note`,
or leave the final value `null`.

## 5. `optimal_conditions`: Box-Behnken optimum (one row per bioflocculant)

| Field | Unit |
|---|---|
| `dose_mg_L` | mg/L of bioflocculant |
| `pH` | pH units |
| `rapid_mix_rpm`, `rapid_mix_min` | rpm, minutes |
| `slow_mix_rpm`, `slow_mix_min` | rpm, minutes |
| `settling_min` | minutes |

Leave any factor you didn't vary or record as `null`; it won't be shown.

## 6. `random_forest`

| Field | Unit / content |
|---|---|
| `target` | what the model predicts, e.g. `"Zn removal (%)"` |
| `r2_test` | R² on the test set (0–1) |
| `rmse_test` | RMSE on the test set |
| `rmse_unit` | unit of the RMSE, e.g. `"%"` or `"mg/L"` |
| `n_train`, `n_test` | number of samples |
| `validation` | e.g. `"80/20 split, 5-fold CV"` |
| `feature_importance` | one entry per variable: `{ "feature": "pH", "importance": 0.31 }`, importance from scikit-learn (they sum to 1) |

## 7. Optional extras

- `idw_map_image`: path to a PNG exported from ArcGIS Pro, saved in
  `greendata/img/`, e.g. `"img/idw_zn.png"`.
- `limitations`: list of short sentences, e.g.
  `["Lab-scale jar tests", "Two sampling points on one date"]`.
  If empty, the page shows general limitations without numbers.
- `status`: set to `"final"` when the results are final. The badge changes
  from "Research in progress" to "Research results".
- `updated`: date of the last update, `YYYY-MM-DD`.

## Demo mode

`thesis_demo.json` holds **invented numbers** used only to preview the layout.
It loads only when the page URL ends in `?demo=1`, and the section then shows a
red **"DEMO DATA — NOT REAL RESULTS"** banner. The normal page always reads
`thesis_results.json`. Never copy demo values into your results.
