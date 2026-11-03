
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

let totalValue = 0;
jsonData.forEach((row: any, index: number) => {
  if (index < 100) {
    const value = parseFloat(row['Value (Rs. Cr)']) || parseFloat(row['Value']) || 0;
    totalValue += value;
  }
});

console.log(`Total Value (first 100): ${totalValue}`);
