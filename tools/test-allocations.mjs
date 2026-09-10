import test from 'node:test';
import assert from 'node:assert/strict';
import { renormalizeAllocation } from './allocations.mjs';

test('renormalization stays inside observed ranges when medians sum above 100', () => {
  const medians = [2, 3, 5, 8, 10, 15, 11, 25, 15, 5, 4];
  const ranges = [[1, 2], [2, 3], [1, 5], [5, 10], [10, 15], [15, 20], [10, 12], [20, 30], [5, 20], [3, 5], [1, 5]];
  const middleHalf = [[1, 2], [2, 3], [3, 5], [5, 8], [10, 10], [15, 15], [10, 12], [25, 30], [15, 15], [3, 5], [2, 4]];

  const result = renormalizeAllocation(medians, ranges, middleHalf);

  assert.equal(result.reduce((sum, value) => sum + value, 0), 100);
  result.forEach((value, index) => assert.ok(value >= ranges[index][0] && value <= ranges[index][1]));
  assert.deepEqual(result, [2, 3, 5, 8, 10, 15, 10, 24, 14, 5, 4]);
});

test('renormalization respects upper bounds when medians sum below 100', () => {
  const result = renormalizeAllocation([9, 0, 0], [[9, 9], [0, 1], [0, 1]], [], 10);
  assert.deepEqual(result, [9, 1, 0]);
});

test('renormalization rejects infeasible hard bounds', () => {
  assert.throws(
    () => renormalizeAllocation([1, 1], [[6, 8], [6, 8]], [], 10),
    /hard bounds cannot sum to 10/
  );
});
