
import { parseRWN } from '../src/utils/rwnParser.ts';

const inputs = [
    '5000m@2k+20',
    '5000m@2k+20 + 5000m@2k+12',
    '2x5000m@2k+20'
];

inputs.forEach(input => {
    console.log(`\nParsing: "${input}"`);
    const result = parseRWN(input);
    console.log(JSON.stringify(result, null, 2));
});
