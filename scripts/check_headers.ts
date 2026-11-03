import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileContent = fs.readFileSync('data/AFY FY 26-27 Sept-26_Yojana.xlsx');
const wb = XLSX.read(fileContent, { type: 'buffer' });

const sheetName = wb.SheetNames[0]; // Assume first sheet
const ws = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 });

console.log('Headers:', data[0]);
console.log('First row:', data[1]);
