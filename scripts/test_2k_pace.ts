
import { parseRWN } from '../src/utils/rwnParser.ts';

const input = '10 x 500m@2k/3:00r';

console.log(`Parsing: "${input}"\n`);
const result = parseRWN(input);
console.log(JSON.stringify(result, null, 2));
