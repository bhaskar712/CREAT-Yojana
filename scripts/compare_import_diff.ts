import { processExcelImport } from '../services/exportService';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

async function test() {
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

  const res = await processExcelImport(file, masterConfig, [], months, "Actuals", undefined, "auto");
  
  // Calculate total Operational Expenses from imported projects in the exact same way PMO/PMOAnalyticsView does
  // In PMO.tsx:
  // monthlyExpCr: for each project, getAuthoritativeRowUI for each category
  // Or in PMOAnalyticsView.tsx:
  // getConsolidatedBudget('Actuals')
  let importedTotalsByBucket: Record<string, number> = {};
  let totalImportedExp = 0;

  // Let's sum project.actuals across months 84 to 95 (FY 26-27)
  // Wait, let's check what month indices are in project.actuals!
  (res.projects || []).forEach((p: any) => {
    Object.entries(p.actuals || {}).forEach(([cat, arr]: [string, any]) => {
      if (cat === 'Contracted Employee') return; // Manpower
      if (!Array.isArray(arr)) return;
      if (!importedTotalsByBucket[cat]) importedTotalsByBucket[cat] = 0;
      for (let m = 0; m < 120; m++) {
        // Only FY 26-27 (Apr-26 to Mar-27)
        // What are the indices?
        // (2026 - 2019)*12 + 3 = 87? or 84?
        // Let's check which indices have non-zero values!
        const val = arr[m] || 0;
        if (val !== 0) {
          totalImportedExp += val;
          importedTotalsByBucket[cat] += val;
        }
      }
    });
  });

  console.log('Total Imported Exp across all months:', totalImportedExp, 'INR ->', (totalImportedExp / 1e7).toFixed(7), 'Cr');
  console.log('Imported Buckets:');
  Object.keys(importedTotalsByBucket).sort().forEach(b => {
    console.log(`  ${b}: ${(importedTotalsByBucket[b] / 1e7).toFixed(7)} Cr (₹ ${importedTotalsByBucket[b].toLocaleString('en-IN')})`);
  });

  // Now let's see which month indices have values in imported projects
  let monthlyValues: Record<number, number> = {};
  (res.projects || []).forEach((p: any) => {
    Object.entries(p.actuals || {}).forEach(([cat, arr]: [string, any]) => {
      if (cat === 'Contracted Employee') return;
      if (!Array.isArray(arr)) return;
      arr.forEach((val, idx) => {
        if (val) monthlyValues[idx] = (monthlyValues[idx] || 0) + val;
      });
    });
  });

  console.log('\nMonthly Values by Index:');
  Object.keys(monthlyValues).sort((a,b) => Number(a)-Number(b)).forEach(idx => {
    console.log(`Index ${idx}: ₹ ${monthlyValues[Number(idx)].toFixed(2)} (${(monthlyValues[Number(idx)] / 1e7).toFixed(7)} Cr)`);
  });
}

test().catch(console.error);
