import { parseRWN } from './src/utils/rwnParser';

// Test cases for chained @ parameters
const testCases = [
    {
        input: '10 x 500m@2k@32spm/3:00r',
        description: 'Ten 500m intervals at 2k pace at 32 spm with 3 min rest'
    },
    {
        input: '8 x 2000m@6k-5@24spm/5:00r',
        description: 'Eight 2k intervals at 6k-5 pace at 24 spm with 5 min rest'
    },
    {
        input: '5 x 1000m@1:50@28spm/2:00r',
        description: 'Five 1k intervals at 1:50 pace at 28 spm with 2 min rest'
    },
    {
        input: '10 x 500m@32spm@2k/3:00r',
        description: 'Reversed order: rate then pace'
    },
    {
        input: '5000m@2k+10@22spm',
        description: 'Steady state with pace and rate'
    },
    {
        input: '10 x 500m@2k/3:00r',
        description: 'Backwards compatibility: pace only'
    },
    {
        input: '10 x 500m@32spm/3:00r',
        description: 'Backwards compatibility: rate only'
    }
];

console.log('🚣 RWN Parser - Chained Guidance Parameter Tests\n');
console.log('='.repeat(80));

testCases.forEach(({ input, description }, index) => {
    console.log(`\nTest ${index + 1}: ${description}`);
    console.log(`Input: "${input}"`);

    const result = parseRWN(input);

    if (!result) {
        console.log('❌ FAILED: Parser returned null');
        return;
    }

    console.log(`Type: ${result.type}`);

    if (result.type === 'interval') {
        console.log(`Repeats: ${result.repeats}`);
        console.log(`Work: ${result.work.value}${result.work.type === 'distance' ? 'm' : result.work.type === 'time' ? 's' : 'cal'}`);
        console.log(`Target Pace: ${result.work.target_pace || 'none'}`);
        console.log(`Target Rate: ${result.work.target_rate || 'none'} spm`);
        console.log(`Rest: ${result.rest.value}s`);

        // Validate expected values for main test case
        if (input === '10 x 500m@2k@32spm/3:00r') {
            const isValid =
                result.repeats === 10 &&
                result.work.value === 500 &&
                result.work.target_pace === '2k' &&
                result.work.target_rate === 32 &&
                result.rest.value === 180;

            console.log(isValid ? '✅ PASSED' : '❌ FAILED: Values don\'t match expected');
        } else {
            console.log('✅ Parsed successfully');
        }
    } else if (result.type === 'steady_state') {
        console.log(`Value: ${result.value}${result.unit === 'meters' ? 'm' : result.unit === 'seconds' ? 's' : 'cal'}`);
        console.log(`Target Pace: ${result.target_pace || 'none'}`);
        console.log(`Target Rate: ${result.target_rate || 'none'} spm`);
        console.log('✅ Parsed successfully');
    }
});

console.log('\n' + '='.repeat(80));
console.log('✨ All tests completed!\n');
