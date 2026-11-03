import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

let contractedExp = 0;
let contractedCount = 0;

for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const recType = String(r[22] || "").trim().toLowerCase();
  if (recType !== "expense") continue;

  const bucket = String(r[21] || "").trim();
  if (bucket === "Contracted Employee") {
    contractedExp += parseFloat(r[23]) || 0;
    contractedCount++;
  }
}

console.log('Contracted Employee Expense Rows:', contractedCount);
console.log('Total Contracted Employee Expense:', contractedExp.toLocaleString('en-IN'), `(${(contractedExp/1e7).toFixed(7)} Cr)`);

const possibleDiscrepancy = contractedExp * (1 - 180/198);
console.log('Possible Discrepancy if 198 vs 180 HPM:', possibleDiscrepancy.toLocaleString('en-IN'), `(${(possibleDiscrepancy/1e7).toFixed(7)} Cr)`);
