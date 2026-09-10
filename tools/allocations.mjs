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
