
const fs = require('fs');
const path = require('path');

const summaryPath = 'data/c2-export/results-summary.json';
const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

const types = {};

data.forEach(w => {
    if (!types[w.workout_type]) {
        types[w.workout_type] = [];
    }
    types[w.workout_type].push(w.id);
});

let output = 'Workout Types Found:\n\n';
Object.keys(types).sort().forEach(type => {
    const count = types[type].length;
    // For rare types (<10), show all IDs. For common, show 5.
    const limit = count < 10 ? count : 5;
    const examples = types[type].slice(0, limit).join(', ');
    output += `- ${type}: ${count} items (IDs: ${examples})\n`;
});

fs.writeFileSync('workout_types.txt', output);
console.log('Written to workout_types.txt');
