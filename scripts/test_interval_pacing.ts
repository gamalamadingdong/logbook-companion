
import { parseRWN } from '../src/utils/rwnParser.ts';

const input = '5x2000m@2k+10/5:00r';

console.log(`Parsing: "${input}"\n`);
const result = parseRWN(input);
console.log(JSON.stringify(result, null, 2));
