import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('--- TESTING EXACT EXPORT SERVICE / PMO IMPORT ON AFY MASTER ---');

// Let's print row 0 headers with indices
const headerRow = sheetRows[0] || [];
headerRow.forEach((cell, idx) => console.log(`Col ${idx} (${XLSX.utils.encode_col(idx)}): "${cell}"`));
