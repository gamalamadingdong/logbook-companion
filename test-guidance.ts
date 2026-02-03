import { parseRWN } from './src/utils/rwnParser';

const input = '2 x (12:00@UT2 + 9:00@UT1 + 6:00@AT)/5:00r';

console.log(`Testing: "${input}"\n`);
const result = parseRWN(input);

console.log('Full Structure:');
console.log(JSON.stringify(result, null, 2));

if (result?.type === 'variable') {
    console.log('\n\nStep-by-step breakdown:');
    result.steps.forEach((step, i) => {
        const mins = Math.floor(step.value / 60);
        console.log(`${i + 1}. ${step.type.toUpperCase()}: ${mins}:00`);
        if (step.type === 'work') {
            console.log(`   - target_pace: ${step.target_pace || 'MISSING'}`);
            console.log(`   - target_rate: ${step.target_rate || 'none'}`);
            console.log(`   - tags: ${step.tags?.join(', ') || 'none'}`);
        }
    });
}
