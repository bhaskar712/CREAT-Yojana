import { processExcelImport } from '../services/exportService';
import { getAuthoritativeRowUI } from '../components/PMO';
import fs from 'fs';
import path from 'path';

async function main() {
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
  console.log(`Imported ${projects.length} projects`);

  // Let's check how PMO.tsx computes expenseSpentCr for each project
  const monthMap: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const monthIndices = months.map(m => {
    const [monthName, yearShort] = m.split('-');
    const year = 2000 + parseInt(yearShort);
    const month = monthMap[monthName] || 0;
    return (year - 2019) * 12 + month - 3;
  });

  console.log('Month indices for FY 26-27:', monthIndices);

  const EXPENSE_CATEGORIES = [
    "Travel", "Material", "Labs", "License", "Consultant", "HR", "Admin", "Others"
  ];

  let bucketTotalsPMO: Record<string, number> = {};
  let totalPMOExpensesCr = 0;

  EXPENSE_CATEGORIES.forEach(b => bucketTotalsPMO[b] = 0);

  projects.forEach(p => {
    EXPENSE_CATEGORIES.forEach(cat => {
      const row = getAuthoritativeRowUI(p, cat, 'actuals');
      monthIndices.forEach(idx => {
        const val = row[idx] || 0;
        // val in actuals is stored in INR or Cr?
        // Let's check!
        const valCr = Math.abs(val) > 1000 ? val / 1e7 : val;
        bucketTotalsPMO[cat] += valCr;
        totalPMOExpensesCr += valCr;
      });
    });
  });

  console.log('\n--- PMO.tsx CALCULATION ON IMPORTED PROJECTS ---');
  console.log('Total PMO Expenses Cr:', totalPMOExpensesCr.toFixed(4));
  Object.keys(bucketTotalsPMO).sort().forEach(b => {
    console.log(`  ${b}: ${bucketTotalsPMO[b].toFixed(2)} Cr (${bucketTotalsPMO[b].toFixed(7)} Cr)`);
  });

  // Now let's find out what projects had differences
  // Let's check if there are categories in p.actuals that are NOT in EXPENSE_CATEGORIES
  const unknownCats: Record<string, number> = {};
  projects.forEach(p => {
    Object.keys(p.actuals || {}).forEach(k => {
      if (!EXPENSE_CATEGORIES.includes(k) && k !== 'Contracted Employee' && k !== 'Contracted Employee Expense') {
        let sum = 0;
        monthIndices.forEach(idx => {
          sum += (p.actuals[k] || [])[idx] || 0;
        });
        if (sum > 0) {
          unknownCats[k] = (unknownCats[k] || 0) + sum;
        }
      }
    });
  });

  console.log('\n--- UNKNOWN OR OTHER CATEGORIES IN P.ACTUALS ---', unknownCats);
}

main().catch(console.error);
