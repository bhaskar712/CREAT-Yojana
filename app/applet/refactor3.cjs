const fs = require('fs');
let code = fs.readFileSync('components/PMOAnalyticsView.tsx', 'utf8');

const renderMonthlyDataRowStr = `    if (selectedModes.length > 1) {
      // Split the row into grouped columns
      const modeData = selectedModes.map(modeVal => {
        const d = getData(modeVal) || new Array(months.length).fill(0);
        return {
          mode: modeVal,
          data: d,
          total: d.reduce((a, b) => a + b, 0),
          avg: d.reduce((a, b) => a + b, 0) / months.length,
        };
      });`;

const renderMonthlyDataRowNew = `    if (selectedModes.length > 1) {
      const displayColModes = ['Actuals', 'Budget', 'Forecast'];
      // Split the row into grouped columns
      const modeData = displayColModes.map(modeVal => {
        const d = (modeVal !== 'Forecast' && selectedModes.includes(modeVal as any)) ? (getData(modeVal) || new Array(months.length).fill(0)) : new Array(months.length).fill(0);
        return {
          mode: modeVal,
          data: d,
          total: d.reduce((a, b) => a + b, 0),
          avg: (d.reduce((a, b) => a + b, 0) / months.length) || 0,
        };
      });`;

code = code.replace(renderMonthlyDataRowStr, renderMonthlyDataRowNew);


// Fix width constraints for the map blocks inside renderMonthlyDataRow
code = code.replace(
/px-2 py-1 border-r border-slate-100 text-right font-mono w-\[60px\] min-w-\[60px\] opacity-90/g,
'px-2 py-1 border-r border-slate-100 text-right font-mono w-[80px] min-w-[80px] opacity-90'
);

code = code.replace(
/px-2 py-1 border-r border-slate-100 text-right font-mono font-black w-\[70px\] min-w-\[70px\]/g,
'px-2 py-1 border-r border-slate-100 text-right font-mono font-black w-[90px] min-w-[90px]'
);

code = code.replace(
/px-2 py-1 border-r border-slate-100 text-right font-mono w-\[60px\] min-w-\[60px\]/g,
'px-2 py-1 border-r border-slate-100 text-right font-mono w-[80px] min-w-[80px]'
);


// Now for the Thead part
const theadStartStr = `                        <tr className="bg-slate-800 text-slate-300 text-[9px] uppercase tracking-[0.1em]">
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
                        </tr>`;

const theadNewStr = `                        <tr className="bg-slate-800 text-slate-300 text-[9px] uppercase tracking-[0.1em]">
                          {months.map(m => (
                             <React.Fragment key={\`sub-\${m}\`}>
                               {['Actuals', 'Budget', 'Forecast'].map(modeVal => (
                                  <th key={modeVal} className="px-2 py-1 border-r border-white/10 text-right w-[80px] min-w-[80px]">
                                    {modeVal}
                                  </th>
                               ))}
                             </React.Fragment>
                          ))}
                          {['Actuals', 'Budget', 'Forecast'].map(modeVal => (
                             <th key={\`total-\${modeVal}\`} className="px-2 py-1 border-r border-white/10 text-right w-[90px] min-w-[90px]">
                               {modeVal}
                             </th>
                          ))}
                          {['Actuals', 'Budget', 'Forecast'].map(modeVal => (
                             <th key={\`avg-\${modeVal}\`} className="px-2 py-1 border-r border-white/10 text-right w-[80px] min-w-[80px]">
                               {modeVal}
                             </th>
                          ))}
                        </tr>`;

code = code.replace(theadStartStr, theadNewStr);

code = code.replace(/colSpan=\{selectedModes\.length\}/g, "colSpan={3}");

code = code.replace(/colSpan=\{selectedModes\.length > 1 \? \(months\.length \+ 2\) \* selectedModes\.length \+ 1 : months\.length \+ 3\}/g, "colSpan={selectedModes.length > 1 ? (months.length + 2) * 3 + 1 : months.length + 3}");


fs.writeFileSync('components/PMOAnalyticsView.tsx', code);
console.log("Refactored successfully 3!");
