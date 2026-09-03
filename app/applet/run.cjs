const fs = require('fs');

let code = fs.readFileSync('components/PMOAnalyticsView.tsx', 'utf8');

const oldFnStart = `const renderMonthlyDataRow = (`;
const oldFnEnd = `      );\n    });\n  };`;

const startIndex = code.indexOf(oldFnStart);
const endIndex = code.indexOf(oldFnEnd, startIndex) + oldFnEnd.length;

if (startIndex === -1 || endIndex < oldFnEnd.length) {
    console.error("Could not find renderMonthlyDataRow");
    process.exit(1);
}

const newFn = `const renderMonthlyDataRow = (
    label: string, 
    getData: (m: string) => number[], 
    isCurrency: boolean = false,
    condition?: (total: number) => boolean,
    styleClasses: string = "hover:bg-slate-50 border-b border-slate-100",
    labelClasses: string = "font-bold uppercase tracking-tight pl-8"
  ) => {
    if (selectedModes.length > 1) {
      // Split the row into grouped columns
      const modeData = selectedModes.map(modeVal => {
        const d = getData(modeVal) || new Array(months.length).fill(0);
        return {
          mode: modeVal,
          data: d,
          total: d.reduce((a, b) => a + b, 0),
          avg: (d.reduce((a, b) => a + b, 0) / months.length) || 0,
        };
      });

      const maxTotal = Math.max(...modeData.map(md => md.total));
      if (condition && !condition(maxTotal)) return null;

      const format = (v: number) => {
        if (v === 0) return '-';
        return isCurrency ? \`₹\${formatCr(v, 2)}\` : v.toFixed(2);
      };

      const getColorClass = (modeVal: string) => {
        if (modeVal === 'Budget') return 'text-blue-600 bg-blue-50/20';
        if (modeVal === 'Actuals') return 'text-emerald-600 bg-emerald-50/20';
        if (modeVal === 'Forecast') return 'text-purple-600 bg-purple-50/20';
        return '';
      };

      return (
        <tr key={\`\${label}-multi\`} className={styleClasses}>
          <td className={\`px-4 py-2 border-r border-slate-100 sticky left-0 bg-white z-10 w-[200px] min-w-[200px] truncate \${labelClasses}\`}>
            {label}
          </td>
          {months.map((m, i) => (
            <React.Fragment key={i}>
              {modeData.map(md => (
                <td key={md.mode} className={\`px-2 py-1.5 border-r border-slate-100 text-right font-mono w-[60px] min-w-[60px] opacity-90 \${getColorClass(md.mode)}\`}>
                  {format(md.data[i])}
                </td>
              ))}
            </React.Fragment>
          ))}
          {modeData.map(md => (
            <td key={\`total-\${md.mode}\`} className={\`px-2 py-1.5 border-r border-slate-100 text-right font-mono font-black w-[70px] min-w-[70px] \${getColorClass(md.mode)}\`}>
              {format(md.total)}
            </td>
          ))}
          {modeData.map(md => (
             <td key={\`avg-\${md.mode}\`} className={\`px-2 py-1.5 border-r border-slate-100 text-right font-mono w-[60px] min-w-[60px] \${getColorClass(md.mode)}\`}>
               {format(md.avg)}
             </td>
          ))}
        </tr>
      );
    } else {
      // Single mode fallback
      const modeVal = selectedModes[0] || 'Budget';
      const data = getData(modeVal) || new Array(months.length).fill(0);
      const total = data.reduce((a, b) => a + b, 0);
      const avg = total / months.length;
      if (condition && !condition(total)) return null;

      const format = (v: number) => {
        if (v === 0) return '-';
        return isCurrency ? \`₹\${formatCr(v, 2)}\` : v.toFixed(2);
      };

      return (
        <tr key={\`\${label}-\${modeVal}\`} className={styleClasses}>
          <td className={\`px-4 py-2 border-r border-slate-100 sticky left-0 bg-white z-10 w-[200px] min-w-[200px] truncate \${labelClasses}\`}>
            {label}
          </td>
          {data.map((val, i) => (
            <td key={i} className="px-2 py-1.5 border-r border-slate-100 text-right font-mono w-[80px] min-w-[80px] opacity-80">
              {format(val)}
            </td>
          ))}
          <td className="px-4 py-1.5 border-r border-slate-100 text-right font-mono font-black w-[100px] min-w-[100px]">
            {format(total)}
          </td>
          <td className="px-4 py-1.5 text-right font-mono w-[80px] min-w-[80px]">
            {format(avg)}
          </td>
        </tr>
      );
    }
  };`;

code = code.substring(0, startIndex) + newFn + code.substring(endIndex);

const theadStartStr = `                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                      <th className="px-4 py-2 border-r border-white/10 text-xs sticky left-0 bg-slate-900 z-10 w-[200px] min-w-[200px]">Functional Unit / Label</th>
                      {months.map(m => (
                        <th key={m} className="px-2 py-2 border-r border-white/10 text-right w-[80px] min-w-[80px]">{m}</th>
                      ))}
                      <th className="px-4 py-2 border-r border-white/10 text-right w-[100px] min-w-[100px]">Total</th>
                      <th className="px-4 py-2 text-right w-[80px] min-w-[80px]">Average</th>
                    </tr>
                  </thead>`;

const startIndex2 = code.indexOf(theadStartStr);
if (startIndex2 === -1) {
    console.error("Could not find the table header");
    process.exit(1);
}

const newThead = `                  <thead className="bg-slate-900 sticky top-0 z-20">
                    {selectedModes.length > 1 ? (
                      <>
                        <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                          <th rowSpan={2} className="px-4 py-2 border-r border-white/10 text-xs text-left sticky left-0 bg-slate-900 z-30 w-[200px] min-w-[200px] align-middle">Functional Unit / Label</th>
                          {months.map(m => (
                            <th key={m} colSpan={selectedModes.length} className="px-2 py-1.5 border-r border-b border-white/10 text-center">{m}</th>
                          ))}
                          <th colSpan={selectedModes.length} className="px-4 py-1.5 border-r border-b border-white/10 text-center w-[100px] min-w-[100px]">Total</th>
                          <th colSpan={selectedModes.length} className="px-4 py-1.5 border-b border-white/10 text-center w-[80px] min-w-[80px]">Average</th>
                        </tr>
                        <tr className="bg-slate-800 text-slate-300 text-[9px] uppercase tracking-[0.1em]">
                          {months.map(m => (
                             <React.Fragment key={\`sub-\${m}\`}>
                               {selectedModes.map(modeVal => (
                                  <th key={modeVal} className="px-2 py-1 border-r border-white/10 text-right w-[60px] min-w-[60px]">
                                    {modeVal === 'Budget' ? 'B' : modeVal === 'Actuals' ? 'A' : 'F'}
                                  </th>
                               ))}
                             </React.Fragment>
                          ))}
                          {selectedModes.map(modeVal => (
                             <th key={\`total-\${modeVal}\`} className="px-2 py-1 border-r border-white/10 text-right w-[70px] min-w-[70px]">
                               {modeVal === 'Budget' ? 'B' : modeVal === 'Actuals' ? 'A' : 'F'}
                             </th>
                          ))}
                          {selectedModes.map(modeVal => (
                             <th key={\`avg-\${modeVal}\`} className="px-2 py-1 border-r border-white/10 text-right w-[60px] min-w-[60px]">
                               {modeVal === 'Budget' ? 'B' : modeVal === 'Actuals' ? 'A' : 'F'}
                             </th>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                        <th className="px-4 py-2 border-r border-white/10 text-xs text-left sticky left-0 bg-slate-900 z-10 w-[200px] min-w-[200px]">Functional Unit / Label</th>
                        {months.map(m => (
                          <th key={m} className="px-2 py-2 border-r border-white/10 text-right w-[80px] min-w-[80px]">{m}</th>
                        ))}
                        <th className="px-4 py-2 border-r border-white/10 text-right w-[100px] min-w-[100px]">Total</th>
                        <th className="px-4 py-2 border-white/10 text-right w-[80px] min-w-[80px]">Average</th>
                      </tr>
                    )}
                  </thead>`;

code = code.replace(theadStartStr, newThead);

code = code.replace(/colSpan=\{months\.length \+ 3\}/g, "colSpan={selectedModes.length > 1 ? (months.length + 2) * selectedModes.length + 1 : months.length + 3}");

fs.writeFileSync('components/PMOAnalyticsView.tsx', code);
console.log("Refactored successfully!");
