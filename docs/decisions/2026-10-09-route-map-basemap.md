# Route map: streets-v12 basemap, keep traffic-light wind colours

**Date:** 2026-10-09
**Status:** Shipped
**Code:** `src/components/route-map.tsx`

## Problem

A rider said the roads were hard to make out in bright sunshine when trying to
match the route to a village and the roads around it.

## Change

| | Before | After |
|---|---|---|
| Basemap | `mapbox/light-v11` | `mapbox/streets-v12` |
| Route line opacity | 25% (≤2 mph wind) → 90% (≥17 mph) | 75% (≤2 mph) → 100% (≥17 mph) |
| Wind colours | Green `#22c55e` / amber `#f59e0b` / red `#ef4444` | Unchanged |
| Cafe stops | Only on the card below the map | Also pinned on the map: coffee-cup badge with the cafe name, for cafes that have coordinates |
| Tapping a cafe pin | — | Dark card with the name, "Mile X of Y" and an "Open in Google Maps" row. Closes with the X, a tap on the map, or a tap on the pin |

## Rationale

**Basemap.** The goal is map visibility. light-v11 is built as a near-blank
backdrop for data: at the zoom used to fit a whole route it barely draws minor
roads and drops village labels. Darkening its roads can't fix that, because the
labels and roads aren't drawn in the first place. streets-v12 shows both.

**Fade.** The old fade could drop the route to 25% opacity, which was only
readable because light-v11 was nearly empty. On a busier basemap a faint line
gets lost among the roads, so the floor is now 75%. Light-wind days still look
a little softer.

**Cafe pins.** Helps with the same task: riders can see where the stop is
relative to the villages and roads now shown on the map. Tapping opens a card
on the map rather than going straight to Google Maps, so a mis-tap while
panning doesn't throw the rider out of the app. Leaving always takes a second,
deliberate tap. The card is dark, like the badge, because a dark card stands
out better than white against a pale map in bright sun.

**Wind colours.** Keep the green / amber / red traffic-light colours. There
have been no complaints, and riders read the traffic-light meaning without a
legend.

## Known trade-off

The current colours fail a colour-vision-deficiency check: under simulated
protanopia, amber and green come out too similar (worst-pair ΔE 5.7 against a
floor of 6 and a target of 8). Alternatives measured at the same time:

| Palette (tail / cross / head) | Worst-pair ΔE |
|---|---|
| Current green / amber / red | 5.7 |
| Bluish-green `#009E73` / grey `#57534e` / vermillion `#D55E00` | 11.0 |
| Blue `#0072B2` / grey / vermillion `#D55E00` | 21.9 |

These were compared on a local-only dev bench (`src/app/dev/map-compare` and
`src/app/dev/before-after`, not committed to the repo).

**Revisit if:** a rider reports trouble telling the wind colours apart, or
amber crosswind segments turn out to be hard to tell apart from streets-v12's
orange and yellow A-roads.
