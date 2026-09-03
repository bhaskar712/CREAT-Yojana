import React from 'react';

export const EstimationHeader: React.FC<{ 
  months: string[]; 
  currentMonthIndex?: number; 
  forecastHorizon?: number; 
  fiscalMode?: string;
  title?: string;
  showRemarks?: boolean;
}> = ({ months, currentMonthIndex, forecastHorizon, fiscalMode, title = 'Estimation', showRemarks = true }) => {
  return (
    <thead>
      <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
        <th className="px-4 py-1.5 border-r border-white/10 text-[9px] sticky left-0 bg-slate-900 z-20 w-[200px] min-w-[200px]">Functional Unit / Label</th>
        {months.map((m, i) => {
          const isPast = currentMonthIndex !== undefined ? i < currentMonthIndex : false;
          const isWindow = currentMonthIndex !== undefined && forecastHorizon !== undefined ? (i >= currentMonthIndex && i < currentMonthIndex + forecastHorizon) : false;
          
          return (
            <th key={m} className={`px-2 py-1.5 border-r border-white/10 text-right w-[80px] min-w-[80px] relative group ${
              fiscalMode === 'Forecast' ? (isPast ? 'bg-slate-800/30' : (isWindow ? 'bg-indigo-900/30' : '')) : ''
            }`}>
              <div className="flex flex-col items-end">
                <span className={fiscalMode === 'Forecast' && isWindow ? 'text-indigo-300' : ''}>{m}</span>
                {fiscalMode === 'Forecast' && currentMonthIndex !== undefined && forecastHorizon !== undefined && (
                  <span className="text-[6px] mt-0.5 opacity-50">
                    {isPast ? 'PAST' : (isWindow ? 'BUDG' : 'PLAN')}
                  </span>
                )}
              </div>
            </th>
          );
        })}
        <th className="px-4 py-1.5 border-r border-white/10 text-right w-[100px] min-w-[100px]">Total</th>
        <th className="px-4 py-1.5 text-right w-[80px] min-w-[80px]">Avg</th>
        {showRemarks && <th className="px-4 py-1.5 text-left min-w-[120px]">Remarks</th>}
      </tr>
    </thead>
  );
};
