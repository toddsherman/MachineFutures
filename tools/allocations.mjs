// Convert a non-negative representative vector into integer percentages that
// sum to 100 while respecting the observed bounds for every coordinate.
//
// Coordinate-wise medians need not sum to 100. Scaling them onto the simplex
// is therefore necessary, but scaling can also move a coordinate beyond every
// observed sample. Start from the proportionally scaled vector, clamp it to the
// hard sample range, then distribute the remaining points to the coordinates
// whose integer value is furthest from its scaled target. Prefer staying in the
// middle half of the samples when that is possible.
export function renormalizeAllocation(values, hard = [], soft = [], target = 100) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('allocation values must be a non-empty array of non-negative finite numbers');
  }
  if (!Number.isInteger(target) || target < 0) throw new TypeError('allocation target must be a non-negative integer');

  const lower = values.map((_, index) => Number.isFinite(hard[index]?.[0]) ? Math.ceil(hard[index][0]) : 0);
  const upper = values.map((_, index) => Number.isFinite(hard[index]?.[1]) ? Math.floor(hard[index][1]) : target);
  if (lower.some((value, index) => value < 0 || upper[index] < value)) {
    throw new RangeError('allocation hard bounds are invalid');
  }
  if (lower.reduce((sum, value) => sum + value, 0) > target || upper.reduce((sum, value) => sum + value, 0) < target) {
    throw new RangeError(`allocation hard bounds cannot sum to ${target}`);
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) {
    if (target === 0) return values.map(() => 0);
    throw new RangeError(`an all-zero allocation cannot sum to ${target}`);
  }

  const scaled = values.map(value => (value / total) * target);
  const out = scaled.map((value, index) => Math.min(upper[index], Math.max(lower[index], Math.floor(value))));
  const softLower = values.map((_, index) => {
    const value = Number.isFinite(soft[index]?.[0]) ? Math.ceil(soft[index][0]) : lower[index];
    return Math.min(upper[index], Math.max(lower[index], value));
  });
  const softUpper = values.map((_, index) => {
    const value = Number.isFinite(soft[index]?.[1]) ? Math.floor(soft[index][1]) : upper[index];
    return Math.max(lower[index], Math.min(upper[index], value));
  });

  const choose = (direction, bounds) => {
    let best = -1;
    let bestDistance = -Infinity;
    for (let index = 0; index < out.length; index++) {
      const allowed = direction > 0 ? out[index] < bounds[index] : out[index] > bounds[index];
      if (!allowed) continue;
      const distance = direction > 0 ? scaled[index] - out[index] : out[index] - scaled[index];
      if (distance > bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    return best;
  };

  let delta = target - out.reduce((sum, value) => sum + value, 0);
  for (const bounds of delta >= 0 ? [softUpper, upper] : [softLower, lower]) {
    while (delta !== 0) {
      const direction = Math.sign(delta);
      const index = choose(direction, bounds);
      if (index === -1) break;
      out[index] += direction;
      delta -= direction;
    }
  }
  if (delta !== 0) throw new RangeError(`allocation could not be normalized to ${target} within its hard bounds`);
  return out;
}

// Average forecasts without allowing labs that publish more model variants to
// receive more weight. Each model is first averaged within its lab; those lab
// vectors are then averaged with one equal vote per lab.
export function labBalancedMean(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new TypeError('lab-balanced mean requires at least one forecast');
  }

  const width = rows[0]?.values?.length;
  if (!Number.isInteger(width) || width < 1) {
    throw new TypeError('forecast values must be a non-empty array');
  }

  const labs = new Map();
  for (const row of rows) {
    if (typeof row?.lab !== 'string' || !row.lab.trim()) {
      throw new TypeError('every forecast must name its lab');
    }
    if (!Array.isArray(row.values) || row.values.length !== width
      || row.values.some(value => !Number.isFinite(value) || value < 0)) {
      throw new TypeError(`every forecast must have ${width} non-negative finite values`);
    }
    const lab = row.lab.trim();
    if (!labs.has(lab)) labs.set(lab, []);
    labs.get(lab).push(row.values);
  }

  const labMeans = [...labs.values()].map(vectors =>
    vectors[0].map((_, index) => vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length));
  return labMeans[0].map((_, index) =>
    labMeans.reduce((sum, vector) => sum + vector[index], 0) / labMeans.length);
}

// Largest-remainder quantization at an explicit decimal precision. The site
// uses one decimal place for its lab-balanced aggregate, so all displayed
// coordinates add to 100.0 rather than drifting after independent rounding.
export function quantizeAllocation(values, decimalPlaces = 1, target = 100) {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) {
    throw new TypeError('decimalPlaces must be an integer from 0 through 6');
  }
  const scale = 10 ** decimalPlaces;
  const units = renormalizeAllocation(values.map(value => value * scale), [], [], Math.round(target * scale));
  return units.map(value => value / scale);
}
