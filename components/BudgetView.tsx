
import React from 'react';
import { PortfolioIntelligenceBar } from './Dashboard';
import { FilterBar } from './Filters';
import BudgetTable from './BudgetTable';
import { AppTab, Project, MasterConfig, FiscalMode, FiscalYear, User } from '../types';

interface BudgetViewProps {
  currentSummary: any;
  sharedFilters: any;
  setSharedFilters: (filters: any) => void;
  dynamicOptions: any;
  verticalOptions: string[];
  sharedActions: React.ReactNode;
  masterConfig: MasterConfig;
  selectedFYs: FiscalYear[];
  projectsInScope: Project[];
  canEditVertical: (v: string) => boolean;
  currentFYFinancials: any;
  isAdmin: boolean;
  fiscalMode: FiscalMode;
  DEFAULT_FY: string;
  locks: Record<string, { userId: string, username: string }>;
  setFocusedProjectId: (id: string | null) => void;
  projects: Project[];
  handleCopyProjectData: (targetId: string, sourceId: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  triggerLocalUpdate: () => void;
  isDirtyRef: React.MutableRefObject<boolean>;
  showEmptyActuals: boolean;
  sortBy: 'default' | 'manpower' | 'expense' | 'total';
  setSortBy: (val: 'default' | 'manpower' | 'expense' | 'total') => void;
  sortOrder: 'desc' | 'asc';
  setSortOrder: (val: 'desc' | 'asc') => void;
  totalsLookup: Record<string, any>;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  currentSummary,
  sharedFilters,
  setSharedFilters,
  dynamicOptions,
  verticalOptions,
  sharedActions,
  masterConfig,
  selectedFYs,
  projectsInScope,
  canEditVertical,
  currentFYFinancials,
  isAdmin,
  fiscalMode,
  DEFAULT_FY,
  locks,
  setFocusedProjectId,
  projects,
  handleCopyProjectData,
  setProjects,
  triggerLocalUpdate,
  isDirtyRef,
  showEmptyActuals,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  totalsLookup
}) => {
  const currentMode = fiscalMode;
  const isBudgetLocked = masterConfig.isFiscalLocked || (
    selectedFYs.includes('All FY')
      ? Object.keys(masterConfig.fiscalLocks || {}).some(k => k.startsWith('budget_page_') && masterConfig.fiscalLocks?.[k])
      : selectedFYs.some(fy => !!masterConfig.fiscalLocks?.[`budget_page_${fy}`])
  );

  const sortedProjects = [...projectsInScope].sort((a, b) => {
    if (sortBy === 'default') return 0;

    const getProjectTotal = (p: Project, type: 'manpower' | 'expense' | 'total') => {
      const targetMode = currentMode === 'Actuals' ? 'actuals' : (currentMode === 'Forecast' ? 'forecast' : 'budget');
      const t = totalsLookup[p.id]?.[targetMode] || { manpowerCr: 0, expensesCr: 0, grandTotalCrs: 0 };
      
      if (type === 'manpower') return t.manpowerCr;
      if (type === 'expense') return t.expensesCr;
      return t.grandTotalCrs;
    };

    const valA = getProjectTotal(a, sortBy);
    const valB = getProjectTotal(b, sortBy);

    if (sortOrder === 'asc') {
      return valA - valB;
    } else {
      return valB - valA;
    }
  });

  const sortControls = (
    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl h-10 px-2 shadow-sm mr-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sort:</span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as any)}
        className="bg-transparent border-none text-[10px] font-black text-slate-700 uppercase focus:outline-none focus:ring-0 cursor-pointer"
      >
        <option value="default">Default</option>
        <option value="manpower">Manpower (MM / Cr)</option>
        <option value="expense">Expense</option>
        <option value="total">Total</option>
      </select>
      <button
        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
        className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
        title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
      >
        <svg className={`w-3.5 h-3.5 transform transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col space-y-2">
      <div className="shrink-0 space-y-2">
        <PortfolioIntelligenceBar stats={currentSummary} label="Budget Hub" />
        <FilterBar 
          filters={sharedFilters} 
          setFilters={setSharedFilters} 
          dynamicOptions={dynamicOptions} 
          authorizedVerticals={verticalOptions} 
          actionButtons={
            <div className="flex items-center gap-2">
              {sortControls}
              {sharedActions}
            </div>
          } 
        />
      </div>
      {masterConfig.isFiscalLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center space-x-3 animate-fadeIn shadow-sm">
          <div className="bg-amber-100 text-amber-600 p-1.5 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <div>
            <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-tight">Budget Context Locked</h4>
            <p className="text-[8px] font-bold text-amber-600 uppercase">Write operations are suspended by system controller</p>
          </div>
        </div>
      )}
      
      <div className="pb-4 space-y-2">
        {projectsInScope.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-100 shadow-inner animate-fadeIn text-center px-8">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">
              {currentMode === 'Actuals' ? 'No Execution Data' : (currentMode === 'Forecast' ? 'No Budget Data' : 'No Projects in Scope')}
            </h3>
            <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-tight max-w-md">Refine your filters or reveal the full registry to start logging realization data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedProjects.map(project => {
              const canEdit = canEditVertical(project.vertical);
              return (
                <BudgetTable 
                  key={project.id} 
                  project={project} 
                  config={masterConfig} 
                  hourlyRate={currentFYFinancials.hourlyRate} 
                  hoursPerMonth={currentFYFinancials.hoursPerMonth} 
                  isAdmin={isAdmin} 
                  canEdit={canEdit || isAdmin} 
                  fiscalMode={currentMode} 
                  selectedFYs={selectedFYs} 
                  lockedBy={locks[project.id]} 
                  onEditStart={() => { if(canEdit || isAdmin) setFocusedProjectId(project.id); }} 
                  onEditEnd={() => setFocusedProjectId(null)} 
                  allAvailableProjects={projects} 
                  onCopyData={handleCopyProjectData} 
                  onUpdateTbc={(pid, status) => {
                    setProjects(projects.map(p => p.id === pid ? { ...p, tbc: status } : p));
                    triggerLocalUpdate();
                  }}
                  onUpdateMetadata={(field, value) => {
                    setProjects(projects.map(p => p.id === project.id ? { ...p, [field]: value } : p));
                    triggerLocalUpdate();
                  }}
                  onDelete={(pid) => {
                    setProjects(projects.filter(p => p.id !== pid));
                    triggerLocalUpdate();
                  }}
                  onUpdate={(pid, cat, absoluteMonthIndex, v, targetMode) => { 
                    const p = projects.find(p => p.id === pid);
                    if (!p) return;
                    const updated = { ...p };
                    if (targetMode === 'Actuals') {
                      updated.actuals = { ...updated.actuals, [cat]: [...(updated.actuals[cat] || [])] };
                      updated.actuals[cat][absoluteMonthIndex] = v;
                    } else if (targetMode === 'Forecast') {
                      updated.forecast = { ...updated.forecast, [cat]: [...(updated.forecast[cat] || [])] };
                      updated.forecast[cat][absoluteMonthIndex] = v;
                    } else {
                      updated.rows = { ...updated.rows, [cat]: [...(updated.rows[cat] || [])] };
                      updated.rows[cat][absoluteMonthIndex] = v;
                    }
                    setProjects(projects.map(proj => proj.id === pid ? updated : proj));
                    triggerLocalUpdate();
                  }} 
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
