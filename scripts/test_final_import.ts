import { processExcelImport } from '../services/exportService';
import fs from 'fs';
import path from 'path';

async function test() {
  const filePath = path.join(process.cwd(), 'data', 'AFY FY 26-27 Sept-26_Yojana.xlsx');
  const buffer = fs.readFileSync(filePath);
  // Create a File object simulation
  const file = {
    name: 'AFY FY 26-27 Sept-26_Yojana.xlsx',
    size: buffer.length,
  } as any;

  // Mock FileReader in Node environment for processExcelImport
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
  
  console.log('--- TEST FINAL IMPORT RESULT ---');
  console.log('Projects count:', res.projects ? res.projects.length : 0);

  // Calculate total Operational Expenses in FY 26-27 across all imported projects
  let grandTotalExpense = 0;
  let bucketTotals: Record<string, number> = {};

  (res.projects || []).forEach((p: any) => {
    const actuals = p.actuals || {};
    Object.entries(actuals).forEach(([bucket, monthsObj]: [string, any]) => {
      if (bucket === "Contracted Employee") return; // Manpower
      let bucketSum = 0;
      if (Array.isArray(monthsObj)) {
        // monthIdx for Apr-26 to Mar-27 is 87 to 98
        for (let idx = 87; idx < 99; idx++) {
          const val = monthsObj[idx] || 0;
          bucketSum += val;
        }
      }
      grandTotalExpense += bucketSum;
      bucketTotals[bucket] = (bucketTotals[bucket] || 0) + bucketSum;
    });
  });

  console.log('Grand Total Operational Expenses in FY 26-27:', grandTotalExpense, 'INR ->', (grandTotalExpense / 1e7).toFixed(2), 'Crs');
  console.log('Bucket Breakdown:');
  Object.keys(bucketTotals).sort().forEach(b => {
    console.log(`  ${b}: ${(bucketTotals[b] / 1e7).toFixed(2)} Cr (₹ ${bucketTotals[b].toLocaleString('en-IN')})`);
  });
}

test().catch(console.error);
