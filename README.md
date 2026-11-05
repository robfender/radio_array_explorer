# Radio Array Explorer

Local interactive comparison of major radio facilities, with angular resolution,
frequency, an antenna-count image-quality proxy and representative sensitivity.
Jet/ejecta modelling remains paused.

## Open the website

From this project directory run `npm start`, then open http://localhost:8000/.
No dependency installation or build step is required. Node.js and Python 3 are
needed for development; the deployed website needs only a static web host.
Serve the `web/` directory as the site root, including its `data/` directory.
Opening index.html directly from Finder will not load the catalogue reliably.

## Keeping the website and standalone figures synchronized

There is one authoritative catalogue: `web/data/facilities.json`. Edit facility
bands, adopted nominal beams, counts, representative sensitivities, station
coordinates, categories and reference links there. Do not edit generated CSVs or
historical output files. Increment `data_version` whenever reference data changes.

There is one calculation implementation: `web/core.mjs`. Both the browser and
`make_plot.py` use it. Python calls `scripts/evaluate.mjs` through Node and draws
the returned values; it contains no independent telescope catalogue or visibility
rules. This covers filtering, ranking, continuous shared visibility, station
subsets, N², sensitivity exposure scaling and proper-motion conversion.

There are two presentation layers: the existing Matplotlib renderer and the web
SVG renderer. They may differ in typography and colour palette, but their values
and row order come from the same calculation. The browser SVG download and
`scripts/export.mjs` also share the exact SVG renderer.

After changing data or calculations, run `npm test`, regenerate the desired
standalone plots and refresh the website. Tests compare browser-module results
with the standalone CLI at both northern and southern declinations and with
alternative motion/exposure settings. They also check array categories, bands,
counts, ordering and important visibility boundaries. Publishing requires copying
or deploying the complete current `web/` folder; a live host does not automatically
receive local edits. Catalogue versions printed in exports identify stale copies.

## Standalone exports

- `python3 make_plot.py` regenerates all / real-only plots for all-sky, +40° and −40°.
- `node scripts/export.mjs '{"declination":40}' north.svg` exports the same SVG as the browser.
- `node scripts/evaluate.mjs '{"declination":-40,"includeFuture":false}'` emits evaluated JSON.

Matplotlib/NumPy are required for Python figures. Existing archived figures are
preserved in `Old_figures_Nov_4/`; old results are snapshots, not synchronized code.
The pre-refactor plotting source is preserved in `work/make_plot_pre_web.py`.
Validation figures are in `work/validation/`, leaving existing outputs intact.

## Scientific scope of this preview

Visibility requires at least one continuous hour above a default elevation of
20°. A longer requested duration changes both visibility and the thermal-equivalent
noise comparison. The calculation uses a repeating sidereal day; RA and a date
are unnecessary for geometric availability, but are needed for actual scheduling.
Local horizon masks, maintenance, daylight and observatory scheduling constraints
are outside this preview.

VLBA, EVN, EAVN and LBA use rounded station coordinates, with at least three
stations required to share the same continuous interval. The chosen subset
maximises station count, then maximum physical baseline extent. Reduced-subset
beams scale inherited nominal resolution by full/subset physical extent. This is
an approximate planning proxy, not a projected synthesized beam or uv simulation.
The illustrative station roster is not a guaranteed band-specific allocation.
EVN now uses 11 named European sites instead of the earlier generic 12 count.
Nominal full-array beams and sensitivity references are inherited approximations
and are not recalculated from those rosters. LOFAR International currently uses
the Dutch core for visibility screening; it needs a station-level refinement.

N² means antenna count squared, approximately proportional to baseline count,
not baseline count squared. Frequency-dependent antenna participation and uv
coverage are not captured by this proxy. SKA-Low N counts stations.

Sensitivity is one representative reference per facility, which may differ from
the resolution markers in frequency, weighting and participating stations. It is
not a per-band sensitivity prediction. Exposure scaling uses 1/sqrt(time) without
confusion or calibration floors. Reduced VLBI subset sensitivity is not estimated
without station SEFDs. Faded/hatched bars identify provisional references.

Time in days = angular scale in arcsec × 1000 / proper motion in mas/day. Distance
does not enter this angular conversion. This does not simulate ejecta evolution.


## FAST Core Array reference

The proposed full array is FAST plus 24 new 40-m dishes (25 antennas), as in
Jiang et al. (2024), DOI 10.61977/ati2024012, supplied as FASTarray.pdf. The
three Table 3 feed intervals have midpoints 0.70, 2.20 and 6.65 GHz. Nominal
beams scale from 4.3 arcsec at 1.4 GHz. FAST imposes a 50-degree minimum
elevation even when the user chooses a lower value; the same continuous-hour
criterion still applies. This limit is shared by the web and Python exports.
The provisional 1.4-GHz sensitivity uses the paper's Aeff/Tsys ~3000 m²/K,
with an explicitly assumed 400 MHz usable bandwidth and two polarizations:
~0.54 µJy/beam in one hour under ideal thermal conditions. This is not a
published achieved image rms. The full-array count/sensitivity should not
be assumed across every secondary-dish band without receiver confirmation.

## Optional millimetre VLBI arrays

EHT and GMVA have `default_enabled: false`. They are omitted from every standard
comparison, including all-sky and real-only exports, and are unchecked when
Detailed array selection opens. Explicit `facilityIds` selections can include
them; closing the panel restores the standard comparison. Select all within
the panel is an explicit choice to include optional facilities too.

EHT has nominal 230 GHz and demonstration-only 345 GHz markers. The latter uses
only the six stations in the published 870-micron demonstration. Network
visibility is assessed separately for each band; a band without three stations
sharing the required continuous interval is omitted. The count proxy describes
the first surviving band; marker tooltips identify band-specific counts. EHT
one-hour imaging sensitivity is unestimated. GMVA uses the midpoint (87 GHz)
of the 84–90 GHz common tuning range, with its 86 GHz beam reference scaled
accordingly. The GMVA sensitivity reference is a published ideal 29 µJy/beam
one-hour value for Europe+VLBA+GBT+ALMA, not the entire illustrative roster.
Subset sensitivity remains unestimated. Both arrays use rounded station
coordinates and approximate physical-baseline scaling, with campaign, weather
and phasing caveats in the catalogue. Plot limits expand to show these finer
angular scales only when such arrays are selected.

## Westerbork and upgraded GMRT

WSRT and GMRT are real, enabled-by-default facilities. The Westerbork row uses
the documented 12-dish Apertif setup (14 dishes installed), a 1.44 GHz marker
from the 1.13–1.75 GHz tunable range, and a nominal minor-axis beam scaled
from the survey reference. Its ~122 µJy/beam one-hour equivalent is scaled
from the DR1 36.1 µJy/beam outer-image noise in 11.5 h. These are historical
Apertif performance references: ASTRON states that its 2019–2022 survey
operations concluded. The real category does not promise current availability
of that setup. Its east-west beam elongation is documented in the warnings.

The GMRT row uses the upgraded 30-antenna system with band midpoints 185,
375, 700 and 1230 MHz. Resolution references come from the current status
paper's Table 1, with the small Band-2 range discrepancy explicitly recorded.
The provisional ~9 µJy/beam one-hour Band-4 sensitivity is calculated using
100 K, 0.35 K/Jy, 200 MHz usable bandwidth, two polarizations, 30 antennas
and an assumed efficiency of 0.9. Deepest achieved rms values in the source
have unspecified exposure times and are not treated as one-hour estimates.
