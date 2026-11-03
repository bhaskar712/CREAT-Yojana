import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileContent = fs.readFileSync('data/AFY FY 26-27 Sept-26_Yojana.xlsx');
const wb = XLSX.read(fileContent, { type: 'buffer' });

const sheetName = wb.SheetNames[0]; // Assume first sheet
const ws = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 });

const headers = data[0] as any[];
const lacColumnIdx = headers.findIndex(h => String(h).toLowerCase().includes('lacs'));

console.log('Lacs column index:', lacColumnIdx);

if (lacColumnIdx !== -1) {
    for(let i=1; i<Math.min(data.length, 100); i++) {
        const row = data[i] as any[];
        if (row[lacColumnIdx] && row[lacColumnIdx] !== 0) {
            console.log('Row', i, 'Value in Lacs column:', row[lacColumnIdx]);
        }
    }
}
