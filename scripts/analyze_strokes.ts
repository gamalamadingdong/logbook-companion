
import fs from 'fs';
import path from 'path';

const files = [
    'db/3x12min.json',
    'db/speedPyramid.json'
];

files.forEach(file => {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        try {
            const json = JSON.parse(content);
            const workout = json[0];
            const rawData = JSON.parse(workout.raw_data);

            console.log(`\n=== Analysis of ${file} ===`);
            const strokes = rawData.strokes || [];
            console.log(`Total Strokes: ${strokes.length}`);

            if (strokes.length === 0) return;

            let prevT = strokes[0].t;
            let prevD = strokes[0].d;

            // Check unit guesses
            // If max T is around duration_seconds, then T is seconds?
            // If max T is around duration_seconds * 10, then T is deciseconds.
            const lastStroke = strokes[strokes.length - 1];
            const duration = workout.duration_seconds; // string in JSON?

            console.log(`Workout Duration (db): ${duration}`);
            console.log(`Last Stroke T: ${lastStroke.t}, Last Stroke D: ${lastStroke.d}`);

            // Detect Resets or Gaps
            const gaps = [];
            const resets = [];

            for (let i = 1; i < strokes.length; i++) {
                const s = strokes[i];
                const deltaT = s.t - prevT;
                const deltaD = s.d - prevD;

                // Gap detection (assuming T is seconds for now, adjusted later)
                // If T is deciseconds, 10s gap = 100 units.
                if (deltaT > 30 || deltaT > 300) { // 30s?
                    gaps.push({ i, t: s.t, prevT, deltaT });
                }

                // Reset detection
                if (s.t < prevT) resets.push({ type: 'time', i, val: s.t, prev: prevT });
                if (s.d < prevD) resets.push({ type: 'dist', i, val: s.d, prev: prevD });

                prevT = s.t;
                prevD = s.d;
            }

            console.log(`Found ${gaps.length} Large Time Gaps (>30 units):`);
            gaps.slice(0, 5).forEach(g => console.log(`  Stroke ${g.i}: Gap ${g.deltaT} (T: ${g.prevT} -> ${g.t})`));

            console.log(`Found ${resets.length} Resets:`);
            resets.slice(0, 5).forEach(r => console.log(`  Stroke ${r.i}: ${r.type} Reset (${r.prev} -> ${r.val})`));

        } catch (e) {
            console.error(`Error parsing ${file}:`, e);
        }
    }
});
