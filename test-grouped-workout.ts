import { parseRWN } from './src/utils/rwnParser';

console.log('Testing grouped variable workout notation:\n');

const testCases = [
    {
        input: '2 x (12:00@UT2 + 9:00@UT1 + 6:00@AT) / 5:00r',
        description: 'Your proposed notation with tags and rest'
    },
    {
        input: '2 x (12:00 + 9:00 + 6:00) / 5:00r',
        description: 'Simplified without tags'
    },
    {
        input: '2 x 12:00/9:00/6:00/5:00',
        description: 'Current problematic notation'
    }
];

testCases.forEach(({ input, description }) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test: ${description}`);
    console.log(`Input: "${input}"\n`);

    const result = parseRWN(input);

    if (!result) {
        console.log('❌ Parser returned null');
        return;
    }

    console.log(`Type: ${result.type}`);
    console.log(`Steps: ${result.type === 'variable' ? result.steps.length : 'N/A'}`);

    if (result.type === 'variable') {
        console.log('\nStep breakdown:');
        result.steps.forEach((step, i) => {
            const duration = step.value;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const timeStr = seconds > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes}:00`;

            console.log(`  ${i + 1}. ${step.type.toUpperCase()}: ${timeStr}${step.tags?.length ? ` [${step.tags.join(', ')}]` : ''}`);
        });

        // Check if it matches expected structure
        const workSteps = result.steps.filter(s => s.type === 'work');
        const restSteps = result.steps.filter(s => s.type === 'rest');

        console.log(`\nSummary: ${workSteps.length} work steps, ${restSteps.length} rest steps`);

        if (input.includes('2 x (12:00')) {
            const expected = workSteps.length === 6 && restSteps.length === 2;
            console.log(expected ? '✅ CORRECT: 6 work + 2 rest' : '❌ INCORRECT structure');
        }
    }

    console.log('\nFull structure:');
    console.log(JSON.stringify(result, null, 2));
});

console.log(`\n${'='.repeat(80)}\n`);
