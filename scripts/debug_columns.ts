
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

if (jsonData.length > 0) {
  console.log('Columns found:', Object.keys(jsonData[0] as object));
} else {
  console.log('No data found in sheet.');
}
