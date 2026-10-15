import { toNumbers } from "src/lib/engine/numeric";

/** A tiny preview, not an unlimited SVG: preserve endpoints and bucket extrema. */
export function buildStatsSparkline(values: readonly unknown[]): string {
  const nums = toNumbers(values);
  if (nums.length < 2) return "";
  let min = nums[0]!, max = min;
  for (const n of nums) { min = Math.min(min, n); max = Math.max(max, n); }
  const indices = [0];
  if (nums.length <= 200) {
    for (let i = 1; i < nums.length - 1; i++) indices.push(i);
  } else {
    for (let bucket = 0; bucket < 99; bucket++) {
      const start = 1 + Math.floor(bucket * (nums.length - 2) / 99);
      const end = 1 + Math.floor((bucket + 1) * (nums.length - 2) / 99);
      let low = start, high = start;
      for (let i = start + 1; i < end; i++) {
        if (nums[i]! < nums[low]!) low = i;
        if (nums[i]! > nums[high]!) high = i;
      }
      indices.push(Math.min(low, high));
      if (low !== high) indices.push(Math.max(low, high));
    }
  }
  indices.push(nums.length - 1);
  // Normalise before subtracting: finite opposing extremes can overflow a range.
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const range = (max / scale - min / scale) || 1;
  return indices.map((index, i) => {
    const x = 80 * index / (nums.length - 1);
    const y = 24 - ((nums[index]! / scale - min / scale) / range) * 24;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
