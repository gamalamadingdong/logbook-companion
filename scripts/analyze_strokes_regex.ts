
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
        console.log(`\n=== Regex Analysis of ${file} ===`);

        // Regex to match C2 stroke objects: {"d": 28, "p": 1228, "t": 6, ...}
        // Note: key order might vary, so strict regex might fail. 
        // Better: Find the "strokes" array and then match contents?
        // Let's simpler: match any object with d, p, t keys nearby.

        // Match escaped quotes in stringified JSON: \"d\": 28
        const strokeRegex = /(?:\\")?d(?:\\")?:\s*(\d+),\s*(?:\\")?p(?:\\")?:\s*(\d+),\s*(?:\\")?t(?:\\")?:\s*(\d+)/g;
        // Also handle different order if needed, but C2 usually consistent.
        // Or specific to the seen format: {"d": 28, "p": 1228, "t": 6,

        let match;
        const strokes = [];

        // Use a simpler regex that captures d and t in one go if possible, or just iterate properties
        // Actually, the format seen is {"d": 28, "p": 1228, "t": 6, "hr": 86, "spm": 0}
        // So let's match that sequence

        while ((match = strokeRegex.exec(content)) !== null) {
            strokes.push({
                d: parseInt(match[1]),
                p: parseInt(match[2]),
                t: parseInt(match[3])
            });
        }

        console.log(`Extracted ${strokes.length} strokes via Regex.`);

        if (strokes.length > 0) {
            let prevT = strokes[0].t;
            let prevD = strokes[0].d;
            const gaps = [];
            const resets = [];

            for (let i = 1; i < strokes.length; i++) {
                const s = strokes[i];
                const deltaT = s.t - prevT;
                const deltaD = s.d - prevD;

                // Gap detection
                if (deltaT > 50) { // > 5 seconds (assuming deciseconds)
                    if (s.t > prevT) { // Regular gap
                        gaps.push({ i, t: s.t, prevT, deltaT });
                    }
                }

                // Reset Detection
                // C2 Intervals: Distance usually resets to 0 (or low) at start of new interval?
                // Or does it accumulate? 
                // In "JustRow", it accumulates.
                // In "Intervals", it *might* accumulate in the log but be separate in 'intervals' array?
                // OR it resets.

                if (s.d < prevD) {
                    resets.push({ type: 'dist', i, val: s.d, prev: prevD });
                }
                // Time usually keeps going up?
                if (s.t < prevT) {
                    resets.push({ type: 'time', i, val: s.t, prev: prevT });
                }

                prevT = s.t;
                prevD = s.d;
            }

            console.log(`Found ${gaps.length} Gaps (>5s):`);
            gaps.slice(0, 10).forEach(g => console.log(`  Stroke ${g.i}: Gap ${g.deltaT} (T: ${g.prevT} -> ${g.t})`));

            console.log(`Found ${resets.length} Resets:`);
            resets.slice(0, 10).forEach(r => console.log(`  Stroke ${r.i}: ${r.type} Reset (${r.prev} -> ${r.val})`));

            // Check if gaps correlate with rest?
            // calculatePRs logic needs 'intervals' array.
            // If we find resets, we can potentially RECONSTRUCT the intervals array.
        }

    } else {
        console.log(`File not found: ${file}`);
    }
});
