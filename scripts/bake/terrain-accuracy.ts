export interface TerrainAccuracyBox {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}

export interface TerrainAccuracyGrid {
  cols: number;
  rows: number;
  heights: readonly number[];
}

export interface TerrainReferenceSample {
  lat: number;
  lon: number;
  referenceElevationM: number;
}

export interface TerrainAccuracyMeasurement {
  sampleCount: number;
  meanAbsoluteErrorM: number;
}

function validateGrid(grid: TerrainAccuracyGrid): void {
  if (
    !Number.isInteger(grid.cols) ||
    grid.cols < 2 ||
    !Number.isInteger(grid.rows) ||
    grid.rows < 2 ||
    grid.heights.length !== grid.cols * grid.rows
  ) {
    throw new Error('terrain grid dimensions do not match its elevation data');
  }
  if (grid.heights.some((height) => !Number.isFinite(height))) {
    throw new Error('terrain grid contains a non-finite elevation');
  }
}

function sampleTerrainM(
  box: TerrainAccuracyBox,
  grid: TerrainAccuracyGrid,
  lon: number,
  lat: number
): number {
  const fx = ((lon - box.swLon) / (box.neLon - box.swLon)) * (grid.cols - 1);
  const fy = ((lat - box.swLat) / (box.neLat - box.swLat)) * (grid.rows - 1);
  if (
    !Number.isFinite(fx) ||
    !Number.isFinite(fy) ||
    fx < 0 ||
    fx > grid.cols - 1 ||
    fy < 0 ||
    fy > grid.rows - 1
  ) {
    throw new Error(
      `terrain reference sample (${lat}, ${lon}) is outside the grid box`
    );
  }

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, grid.cols - 1);
  const y1 = Math.min(y0 + 1, grid.rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) => grid.heights[y * grid.cols + x];
  const south = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const north = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return south * (1 - ty) + north * ty;
}

export function measureTerrainAccuracy(
  box: TerrainAccuracyBox,
  grid: TerrainAccuracyGrid,
  reference: readonly TerrainReferenceSample[]
): TerrainAccuracyMeasurement {
  if (
    !Number.isFinite(box.swLat) ||
    !Number.isFinite(box.swLon) ||
    !Number.isFinite(box.neLat) ||
    !Number.isFinite(box.neLon) ||
    box.neLat <= box.swLat ||
    box.neLon <= box.swLon
  ) {
    throw new Error('terrain accuracy box must have increasing finite bounds');
  }
  validateGrid(grid);
  if (reference.length === 0) {
    throw new Error('terrain accuracy reference has no samples');
  }

  let absoluteErrorTotalM = 0;
  for (const sample of reference) {
    if (
      !Number.isFinite(sample.lat) ||
      !Number.isFinite(sample.lon) ||
      !Number.isFinite(sample.referenceElevationM)
    ) {
      throw new Error('terrain accuracy reference contains a non-finite value');
    }
    const terrainElevationM = sampleTerrainM(box, grid, sample.lon, sample.lat);
    absoluteErrorTotalM += Math.abs(
      terrainElevationM - sample.referenceElevationM
    );
  }

  return {
    sampleCount: reference.length,
    meanAbsoluteErrorM: absoluteErrorTotalM / reference.length,
  };
}
