import { parseRWN } from './src/utils/rwnParser';

const input1 = '2 x (12:00 + 9:00 + 6:00) / 5:00r';
const input2 = '2 x 12:00/9:00/6:00/5:00';

console.log('Test 1: Proposed notation with parentheses');
console.log(`Input: "${input1}"\n`);
const result1 = parseRWN(input1);
console.log(JSON.stringify(result1, null, 2));

console.log('\n' + '='.repeat(80) + '\n');

console.log('Test 2: Current problematic notation');
console.log(`Input: "${input2}"\n`);
const result2 = parseRWN(input2);
console.log(JSON.stringify(result2, null, 2));
