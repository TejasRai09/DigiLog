const fs = require('fs');
let original = fs.readFileSync('controllers/canePerformanceController.js', 'utf8');
let fix = fs.readFileSync('fix.js', 'utf8');

const mysqlStart = original.indexOf('    } else {\n      // Query local MySQL database');

if (mysqlStart === -1) {
  console.log('Could not find mysql block');
  process.exit(1);
}

const restOfFile = original.substring(mysqlStart);

fs.writeFileSync('controllers/canePerformanceController.js', fix + '\n' + restOfFile);
console.log('Fixed completely!');
