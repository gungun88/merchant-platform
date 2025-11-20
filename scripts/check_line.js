const fs = require('fs');
const content = fs.readFileSync('./MERGED_PRODUCTION_INIT.sql', 'utf8');
const lines = content.split('\n');
console.log('Line 3682:', JSON.stringify(lines[3681]));
console.log('Line 3683:', JSON.stringify(lines[3682]));
console.log('Line 3684:', JSON.stringify(lines[3683]));
console.log('Line 3685:', JSON.stringify(lines[3684]));
console.log('Line 3686:', JSON.stringify(lines[3685]));
console.log('Line 3687:', JSON.stringify(lines[3686]));
