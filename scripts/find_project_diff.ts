import { processExcelImport } from '../services/exportService';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

async function check() {
  const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
  const buffer = fs.readFileSync(filePath);
  const file = {
    name: 'AFY FY 26-27 Sept-26_Yojana.xlsx',
    size: buffer.length,
  } as any;

  (global as any).FileReader = class {
    onload: any;
    readAsBinaryString(f: any) {
      setTimeout(() => {
        this.onload({ target: { result: buffer.toString('binary') } });
      }, 10);
    }
  };

  const masterConfig: any = {
    hourlyRate: 1000,
    hoursPerMonth: 180,
    fyFinancials: {
      'FY 26-27': { hourlyRate: 1000, hoursPerMonth: 180 }
    }
  };

  const months = ["Apr-26","May-26","Jun-26","Jul-26","Aug-26","Sep-26","Oct-26","Nov-26","Dec-26","Jan-27","Feb-27","Mar-27"];

  // 1. Raw Excel sums per project
  const wb = XLSX.read(buffer, { type: 'buffer', dense: true });
  const ws = wb.Sheets['AFY Master'] || wb.Sheets[wb.SheetNames[0]];
  const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const rawByProject = {};
  const rawByProjectAndBucket = {};
  for (let i = 2; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    if (!row) continue;
    const recType = String(row[22] || '').trim().toLowerCase();
    if (recType !== 'expense') continue;
    const code = String(row[0] || '').trim().toUpperCase();
    const bucket = String(row[21] || 'Others').trim();
    const amt = parseFloat(row[23]) || 0;

    rawByProject[code] = (rawByProject[code] || 0) + amt;
    if (!rawByProjectAndBucket[code]) rawByProjectAndBucket[code] = {};
    rawByProjectAndBucket[code][bucket] = (rawByProjectAndBucket[code][bucket] || 0) + amt;
  }

  // 2. Processed import
  const res = await processExcelImport(file, masterConfig, [], months, "Actuals", undefined, "auto");
  const importedProjects = res.projects;

  const importedByProject = {};
  const importedByProjectAndBucket = {};
  importedProjects.forEach(p => {
    const code = (p.code || '').trim().toUpperCase();
    importedByProject[code] = 0;
    importedByProjectAndBucket[code] = {};
    Object.entries(p.actuals || {}).forEach(([b, arr]) => {
      if (b === 'Contracted Employee') return; // MM
      if (!Array.isArray(arr)) return;
      // sum for FY 26-27 (Apr-26 to Mar-27): indices 84 to 95
      let sum = 0;
      for (let m = 84; m < 96; m++) {
        sum += arr[m] || 0;
      }
      importedByProject[code] += sum;
      importedByProjectAndBucket[code][b] = (importedByProjectAndBucket[code][b] || 0) + sum;
    });
  });

  console.log('--- COMPARING RAW EXCEL VS IMPORTED PROJECTS ---');
  let diffCount = 0;
  let totalRaw = 0;
  let totalImported = 0;

  Object.keys(rawByProject).sort().forEach(code => {
    const rawAmt = rawByProject[code] || 0;
    const impAmt = importedByProject[code] || 0;
    totalRaw += rawAmt;
    totalImported += impAmt;

    const diff = rawAmt - impAmt;
    if (Math.abs(diff) > 0.01) {
      diffCount++;
      console.log(`\nDIFF in Project [${code}]: Raw = ₹${rawAmt.toFixed(2)} (${(rawAmt/1e7).toFixed(4)} Cr), Imported = ₹${impAmt.toFixed(2)} (${(impAmt/1e7).toFixed(4)} Cr), Diff = ₹${diff.toFixed(2)} (${(diff/1e7).toFixed(4)} Cr)`);
      console.log('  Raw buckets:', rawByProjectAndBucket[code]);
      console.log('  Imported buckets:', importedByProjectAndBucket[code]);
    }
  });

  console.log(`\nSummary: ${diffCount} projects had differences.`);
  console.log(`Total Raw: ₹${totalRaw.toFixed(2)} (${(totalRaw/1e7).toFixed(7)} Cr)`);
  console.log(`Total Imported: ₹${totalImported.toFixed(2)} (${(totalImported/1e7).toFixed(7)} Cr)`);
  console.log(`Total Diff: ₹${(totalRaw - totalImported).toFixed(2)} (${((totalRaw - totalImported)/1e7).toFixed(7)} Cr)`);
}

check().catch(console.error);
