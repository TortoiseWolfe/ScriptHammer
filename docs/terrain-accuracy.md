# Chattanooga terrain accuracy

The committed `public/twins/chatt/terrain.json` has a **2.7556 m mean absolute
elevation difference (MAE)** against an independent SRTM reference. The
regression test fails if the measured MAE exceeds this recorded baseline.

The reference is NASA/NGA's SRTM v3, 1 arc-second (~30 m), queried from
[OpenTopoData's `srtm30m` dataset](https://www.opentopodata.org/datasets/srtm/).
SRTM was collected by a separate spaceborne radar mission; the twin's fine
terrain is a USGS 3DEP airborne-lidar-derived surface. The independent sensor
and acquisition make SRTM a useful external cross-check rather than a
measurement of the 3DEP layer against itself.

The committed reference snapshot in
`scripts/bake/fixtures/chatt-srtm30m.json` contains 300 elevations on a fixed
10-by-30 lattice spanning the manifest box. The test bilinearly samples the
baked south-to-north grid at those coordinates and computes the average
absolute difference in metres without fitting or removing a vertical offset.
This keeps the check sensitive to vertical shifts as well as terrain-shape
changes, and it runs offline against the committed bake.

This is a **cross-product agreement score, not survey-grade ground truth**:
SRTM is coarser, can include canopy or building returns, and retains its native
vertical convention. Differences therefore include source resolution, surface
type, and vertical-reference effects; the score should not be read as the
absolute accuracy of the terrain at every point. Its purpose is a reproducible,
independent regression bound for the current Chattanooga bake.
