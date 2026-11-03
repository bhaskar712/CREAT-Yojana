import * as XLSX from 'xlsx';
import * as fs from 'fs';

const fileContent = fs.readFileSync('data/AFY FY 26-27 Sept-26_Yojana.xlsx');
const wb = XLSX.read(fileContent, { type: 'buffer' });

let totalValue = 0;
let rowCount = 0;

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  // Try to identify header row
  let headerRowIdx = -1;
  for(let i=0; i<Math.min(data.length, 20); i++) {
    const row = data[i] as any[];
    if(row && row.some(c => String(c).toLowerCase().includes('value'))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx !== -1) {
    const headerRow = data[headerRowIdx] as any[];
    const valueIdx = headerRow.findIndex(c => String(c).toLowerCase().includes('value'));
    
    for(let i=headerRowIdx+1; i<data.length; i++) {
      const row = data[i] as any[];
      if(row && row[valueIdx]) {
        // Need to handle the possibility that val is not a number.
        // The DCBA portal has sophisticated handling for currency.
        // For now, simple cleaning.
        const valStr = String(row[valueIdx]);
        const cleaned = valStr.replace(/[^0-9.-]/g, '');
        const val = parseFloat(cleaned) || 0;
        
        // Basic check for Lakhs conversion in DCBA portal logic:
        // isLacs = colKey.includes('lacs')
        // if (isLacs) val = val / 100;
        
        totalValue += val;
        rowCount++;
      }
    }
  }
});

console.log('Total Sum:', totalValue);
console.log('Row Count:', rowCount);
