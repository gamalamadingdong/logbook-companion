// scripts/verify_pr_logic.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
function generateCanonicalName(intervals) {
  if (!intervals || intervals.length === 0) return "Unknown";
  const workIntervals = intervals.filter((i) => i.type !== "rest");
  if (workIntervals.length === 0) return "Rest Only";
  const count = workIntervals.length;
  const first = workIntervals[0];
  const distVariance = workIntervals.every((i) => Math.abs(i.distance - first.distance) < 5);
  const timeVariance = workIntervals.every((i) => Math.abs(i.time - first.time) < 10);
  const restTime = first.rest_time ? first.rest_time / 10 : 0;
  const restString = restTime ? `/${formatRest(restTime)}r` : "";
  if (distVariance) {
    return `${count}x${Math.round(first.distance)}m${restString}`;
  }
  if (timeVariance) {
    const timeSec = first.time / 10;
    const m = Math.floor(timeSec / 60);
    const s = timeSec % 60;
    const timeLabel = s === 0 ? `${m}:00` : `${m}:${s}`;
    return `${count}x${timeLabel}${restString}`;
  }
  const dists = workIntervals.map((i) => Math.round(i.distance));
  const isPyramid = count >= 3 && dists[0] === dists[count - 1] && dists[Math.floor(count / 2)] > dists[0];
  if (isPyramid) return `v${dists[0]}m... Pyramid`;
  if (count > 0 && count < 6) {
    return `v${dists.join("/")}m`;
  }
  return "Variable Intervals";
}
function formatRest(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0 && s === 0) return `${m}:00`;
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
var SAMPLE_FILES = [
  "../db/speedPyramid.json",
  "../db/api_result_page.json"
];
function run() {
  console.log("---------------------------------------------------");
  console.log("Running PR Verification & Name Generation Test");
  console.log("---------------------------------------------------");
  for (const file of SAMPLE_FILES) {
    const filePath = path.resolve(__dirname, file);
    console.log(`Checking path: ${filePath}`);
    if (fs.existsSync(filePath)) {
      try {
        console.log(`

=== Loading: ${file} ===`);
        const content = fs.readFileSync(filePath, "utf-8");
        let data = JSON.parse(content);
        const workouts = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [data];
        console.log(`Found ${workouts.length} workouts.`);
        workouts.forEach((w, idx) => {
          let intervals = [];
          let originalName = w.workout_name || w.workout_type || "Unknown";
          let type = w.workout_type || "Unknown";
          if (w.raw_data) {
            let raw = w.raw_data;
            if (typeof raw === "string") raw = JSON.parse(raw);
            if (raw.workout && raw.workout.intervals) intervals = raw.workout.intervals;
            originalName = w.workout_name;
          } else if (w.workout && w.workout.intervals) {
            intervals = w.workout.intervals;
          }
          let generatedName = "";
          if (intervals.length > 0) {
            generatedName = generateCanonicalName(intervals);
          } else if (type === "FixedDistanceSplits" || type === "FixedDistanceNoSplits") {
            generatedName = `${w.distance}m`;
          } else if (type === "FixedTimeSplits" || type === "FixedTimeNoSplits") {
            const totalSec = (w.time || 0) / 10;
            const min = Math.round(totalSec / 60);
            generatedName = `${min}:00`;
          } else if (type === "JustRow") {
            const totalSec = (w.time || 0) / 10;
            if (totalSec < 60) {
              generatedName = `${totalSec}s JustRow`;
            } else {
              generatedName = `${Math.round(w.distance)}m JustRow`;
            }
          }
          console.log(`[${idx}] Type: ${type.padEnd(20)} | Name: ${originalName.padEnd(20)} --> GENERATED: ${generatedName}`);
        });
      } catch (err) {
        console.error(`ERROR processing file ${file}:`, err);
      }
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }
}
run();
