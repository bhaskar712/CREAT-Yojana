import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
const fileContent = fs.readFileSync(filePath);
const wb = XLSX.read(fileContent, { type: 'buffer' });

const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('Sheet rows length:', sheetRows.length);
const headerRow = sheetRows[0];
console.log('Header row length:', headerRow.length);

let totalImportedAmount = 0;
let skippedNoDateCount = 0;
let skippedInvalidDateCount = 0;
let skippedNoCodeCount = 0;
let skippedMonthOutOfRangeCount = 0;
let skippedZeroAmount = 0;

let sumByProjectCode = {};
let dateMonthCounts = {};

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function getAbsoluteMonthIndex(monthStr) {
  const parts = monthStr.split('-');
  if (parts.length !== 2) return -1;
  const mName = parts[0].toLowerCase();
  const mIdx = monthNames.findIndex(m => mName.startsWith(m));
  if (mIdx === -1) return -1;
  let yr = parseInt(parts[1]);
  if (yr < 100) yr += 2000;
  return (yr - 2019) * 12 + mIdx;
}

for (let i = 1; i < sheetRows.length; i++) {
  const row = sheetRows[i];
  if (!row || !Array.isArray(row)) continue;

  const projectCode = String(row[0] || '').trim().toUpperCase();
  if (!projectCode) {
    skippedNoCodeCount++;
    continue;
  }

  const dateVal = row[6]; // Col G
  if (dateVal === undefined || dateVal === null || dateVal === '') {
    skippedNoDateCount++;
    continue;
  }

  let date = null;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else if (typeof dateVal === 'number') {
    date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
  } else {
    const dateStr = String(dateVal).trim();
    const parts = dateStr.toLowerCase().split(/[-/\s.]/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      let m = -1, y = -1;
      for (let j = 0; j < parts.length; j++) {
        const foundMonth = monthNames.findIndex(name => parts[j].startsWith(name));
        if (foundMonth !== -1) {
          m = foundMonth;
          const otherIdx = j === 0 ? 1 : 0;
          y = parseInt(parts[otherIdx]);
          break;
        }
      }
      if (m !== -1 && !isNaN(y)) {
        if (y < 100) y += 2000;
        date = new Date(Date.UTC(y, m, 1));
      }
    }
    if (!date || isNaN(date.getTime())) date = new Date(dateStr);
  }

  if (!date || isNaN(date.getTime())) {
    skippedInvalidDateCount++;
    continue;
  }

  const utcDate = new Date(date.getTime() + 43200000);
  const month = utcDate.getUTCMonth();
  const year = utcDate.getUTCFullYear();
  const monthNamesLong = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthStr = `${monthNamesLong[month]}-${year.toString().slice(-2)}`;
  const monthIdx = getAbsoluteMonthIndex(monthStr);

  dateMonthCounts[monthStr] = (dateMonthCounts[monthStr] || 0) + 1;

  if (monthIdx < 0 || monthIdx >= 120) { // MAX_MONTHS = 120
    skippedMonthOutOfRangeCount++;
    continue;
  }

  const valRaw = row[23]; // Col X
  let amount = 0;
  if (typeof valRaw === 'number') amount = valRaw;
  else if (valRaw) {
    const clean = String(valRaw).replace(/[^0-9.%-]/g, '');
    amount = parseFloat(clean) || 0;
  }

  if (amount === 0) {
    skippedZeroAmount++;
  }

  totalImportedAmount += amount;
  sumByProjectCode[projectCode] = (sumByProjectCode[projectCode] || 0) + amount;
}

console.log('\n--- IMPORT ANALYSIS ---');
console.log('Total Imported Amount:', totalImportedAmount, 'INR ->', (totalImportedAmount / 1e7).toFixed(4), 'Crs');
console.log('Skipped No Code:', skippedNoCodeCount);
console.log('Skipped No Date:', skippedNoDateCount);
console.log('Skipped Invalid Date:', skippedInvalidDateCount);
console.log('Skipped Month Out of Range:', skippedMonthOutOfRangeCount);
console.log('Skipped Zero Amount:', skippedZeroAmount);
console.log('Month counts:', dateMonthCounts);
