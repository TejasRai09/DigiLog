const xlsx = require('xlsx');

const yardFile = 'c:\\vivek\\PLANT\\DigiLog\\backend\\backlog-data\\Brix sampling\\GSMA Yard Brix Sampling Form 23-24(1-5000).xlsx';
const fieldFile = 'c:\\vivek\\PLANT\\DigiLog\\backend\\backlog-data\\Brix sampling\\GSMA Field Brix Sampling Form 23-24.xlsx';

function readHeaders(file) {
  try {
    const wb = xlsx.readFile(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nHeaders for ${file}:`);
    console.log(data[0]);
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
}

readHeaders(yardFile);
readHeaders(fieldFile);
