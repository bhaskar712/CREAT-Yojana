import { processExcelImport } from '../services/exportService';
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

  const res = await processExcelImport(file, masterConfig, [], months, "Actuals", undefined, "auto");
  const projects = res.projects;

  const EXPENSE_CATEGORIES = [
    "Travel", "Material", "Labs", "License", "Consultant", "HR", "Admin", "Others", "Contracted Employee", "Contracted Employee Expense", "Operational Expenses (Cr)"
  ];

  const categorySums = {};
  let totalImportedINR = 0;

  projects.forEach(p => {
    Object.entries(p.actuals || {}).forEach(([cat, arr]) => {
      if (cat === 'Contracted Employee') return; // Skip manpower
      if (!Array.isArray(arr)) return;
      
      let projectCatSum = 0;
      for (let m = 84; m < 96; m++) {
        projectCatSum += arr[m] || 0;
      }
      
      categorySums[cat] = (categorySums[cat] || 0) + projectCatSum;
      totalImportedINR += projectCatSum;
    });
  });

  console.log('--- ALL CATEGORIES IN P.ACTUALS ---');
  Object.keys(categorySums).sort().forEach(cat => {
    const inList = EXPENSE_CATEGORIES.includes(cat);
    console.log(`${cat.padEnd(30)}: ₹ ${categorySums[cat].toLocaleString('en-IN').padStart(15)} (${(categorySums[cat]/1e7).toFixed(7)} Cr) [In List: ${inList}]`);
  });

  console.log('\nTotal Imported Expenses (INR):', totalImportedINR.toLocaleString('en-IN'));
  console.log('Total Imported Expenses (Cr): ', (totalImportedINR/1e7).toFixed(7));

  // Check for the 28 Lakhs difference
  const difference = 252018603.2327 - totalImportedINR;
  console.log('\nDifference from 25.20 Cr target:', difference.toLocaleString('en-IN'));
}

check().catch(console.error);
