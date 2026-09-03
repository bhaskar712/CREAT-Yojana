
import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { AppTab, FiscalMode, FiscalYear, User, MasterConfig, Project, SyncStatus, SyncConfig } from '../types';

interface NavbarProps {
  activeTab: AppTab;
  isAdmin: boolean;
  currentUser: User;
  getContextLabel: () => string;
  navigate: (path: string) => void;
  updateContext: (tab: AppTab, mode?: FiscalMode) => void;
  focusedProjectId: string | null;
  projects: Project[];
  mainTabs: { id: string; label: string; visible: boolean }[];
  processorSubTab: 'list' | 'analytics';
  setProcessorSubTab: (tab: 'list' | 'analytics') => void;
  dcbaViewMode: 'list' | 'matrix' | 'yoy' | 'bcg' | 'dashboard';
  setDcbaViewMode: (tab: 'list' | 'matrix' | 'yoy' | 'bcg' | 'dashboard') => void;
  fiscalMode: FiscalMode;
  processorMode: FiscalMode;
  setShowEmptyActuals: (show: boolean) => void;
  selectedFYs: FiscalYear[];
  handleSelectFY: (fy: FiscalYear | FiscalYear[]) => void;
  ALL_FISCAL_YEARS: string[];
  DEFAULT_FY: string;
  syncStatus: SyncStatus;
  syncConfig: SyncConfig;
  handleLogout: () => void;
  hrViewMode?: 'tabular' | 'graphical' | 'matrix' | 'dashboard';
  setHrViewMode?: (mode: 'tabular' | 'graphical' | 'matrix' | 'dashboard') => void;
  seatAllocationSubTab?: 'dashboard' | 'allocation' | 'master';
  setSeatAllocationSubTab?: (tab: 'dashboard' | 'allocation' | 'master') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  isAdmin,
  currentUser,
  getContextLabel,
  navigate,
  updateContext,
  focusedProjectId,
  projects,
  mainTabs,
  processorSubTab,
  setProcessorSubTab,
  dcbaViewMode,
  setDcbaViewMode,
  fiscalMode,
  processorMode,
  setShowEmptyActuals,
  selectedFYs,
  handleSelectFY,
  ALL_FISCAL_YEARS,
  DEFAULT_FY,
  syncStatus,
  syncConfig,
  handleLogout,
  hrViewMode,
  setHrViewMode,
  seatAllocationSubTab,
  setSeatAllocationSubTab
}) => {
  const [isFYOpen, setIsFYOpen] = useState(false);
  const fyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fyDropdownRef.current && !fyDropdownRef.current.contains(event.target as Node)) {
        setIsFYOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFY = (fy: string) => {
    if (fy === 'All FY') {
      handleSelectFY(['All FY' as FiscalYear]);
      // Explicitly leaving the menu open like typical checkbox filters, 
      // but user can click outside to close thanks to the existing event listener.
      return;
    }

    let nextSelection = selectedFYs.includes('All FY' as FiscalYear) ? [] : [...selectedFYs];

    if (nextSelection.includes(fy as FiscalYear)) {
      nextSelection = nextSelection.filter(y => y !== fy);
    } else {
      nextSelection.push(fy as FiscalYear);
    }

    if (nextSelection.length === 0) {
      nextSelection = ['All FY' as FiscalYear];
    }
    
    handleSelectFY(nextSelection);
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-[1000] px-4 sm:px-8 h-20 shrink-0">
      <div className="max-w-full mx-auto h-full flex items-center">
        <div className="flex-1 flex items-center space-x-4">
          <Logo size="md" onClick={() => { navigate('/'); updateContext(AppTab.HOME); }} />
          
          {activeTab !== AppTab.HOME && (
            <div className="flex items-center space-x-3 animate-fadeIn ml-4 pl-4 border-l border-slate-200 h-8">
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-none">{getContextLabel()}</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">Context</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 ml-4">
            <div className="flex items-center space-x-3 animate-fadeIn">
              {activeTab === AppTab.ENTRY && focusedProjectId && (
                <div className="flex items-center space-x-2">
                  <span className="text-slate-900 text-[11px] font-black uppercase tracking-tight">
                    {projects.find(p => p.id === focusedProjectId)?.code || focusedProjectId}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center h-full">
          {activeTab === AppTab.HR_RESOURCES && hrViewMode && setHrViewMode ? (
            <div className="bg-slate-100/50 p-1.5 rounded-full flex items-center space-x-1 border border-slate-200/50">
              {(['tabular', 'graphical', 'matrix', 'dashboard'] as const).map(mode => (
                <button 
                  key={mode} 
                  onClick={() => setHrViewMode(mode)} 
                  className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    hrViewMode === mode 
                      ? 'bg-white text-indigo-600 shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          ) : (activeTab !== AppTab.HOME && activeTab !== AppTab.HR_RESOURCES && activeTab !== AppTab.CONFIG && activeTab !== AppTab.MASTER_PROJECTS) && (
            <div className="bg-slate-100/50 p-1.5 rounded-full flex items-center space-x-1 border border-slate-200/50">
              {mainTabs.filter(t => t.visible !== false).map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => { 
                    if (activeTab === AppTab.DCBA_PORTAL) {
                      setDcbaViewMode(tab.id as any);
                      return;
                    }

                    if (activeTab === AppTab.SEAT_ALLOCATION && setSeatAllocationSubTab) {
                      setSeatAllocationSubTab(tab.id as any);
                      return;
                    }

                    const isTabActive = (activeTab === tab.id) || 
                                       ((activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS) && (
                                         (tab.id === 'pmo_budget' && processorSubTab === 'list' && processorMode === 'Budget') ||
                                         (tab.id === 'pmo_actual' && processorSubTab === 'list' && processorMode === 'Actuals') ||
                                         (tab.id === 'pmo_analytics' && processorSubTab === 'analytics') ||
                                         (tab.id === AppTab.ENTRY && processorSubTab === 'list') ||
                                         (tab.id === AppTab.DASHBOARD && processorSubTab === 'analytics')
                                       ));
                    
                    if (!isTabActive) {
                      if (activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS) {
                        if (tab.id === 'pmo_budget') {
                          setProcessorSubTab('list');
                          updateContext(AppTab.PMO, 'Budget');
                        } else if (tab.id === 'pmo_actual') {
                          setProcessorSubTab('list');
                          updateContext(AppTab.PMO, 'Actuals');
                        } else if (tab.id === 'pmo_analytics') {
                          setProcessorSubTab('analytics');
                          updateContext(AppTab.PMO_ANALYTICS);
                        } else if (tab.id === AppTab.ENTRY) {
                          setProcessorSubTab('list');
                        } else if (tab.id === AppTab.DASHBOARD) {
                          setProcessorSubTab('analytics');
                        } else {
                          updateContext(tab.id as any);
                        }
                      } else {
                        updateContext(tab.id as any);
                      }
                    }
                  }} 
                  className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    (activeTab === AppTab.DCBA_PORTAL && dcbaViewMode === tab.id) ||
                    (activeTab === AppTab.SEAT_ALLOCATION && seatAllocationSubTab === tab.id) ||
                    (activeTab !== AppTab.DCBA_PORTAL && activeTab !== AppTab.SEAT_ALLOCATION && (
                      (activeTab === tab.id) || 
                      ((activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS) && (
                        (tab.id === 'pmo_budget' && processorSubTab === 'list' && processorMode === 'Budget') ||
                        (tab.id === 'pmo_actual' && processorSubTab === 'list' && processorMode === 'Actuals') ||
                        (tab.id === 'pmo_analytics' && processorSubTab === 'analytics') ||
                        (tab.id === AppTab.ENTRY && processorSubTab === 'list') ||
                        (tab.id === AppTab.DASHBOARD && processorSubTab === 'analytics')
                      ))
                    ))
                      ? 'bg-white text-indigo-600 shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center -my-1">
                    <span>{tab.label}</span>
                    {(tab.id === 'pmo_budget' || tab.id === 'pmo_actual') && (
                      <span className="text-[9px] font-medium tracking-tight normal-case opacity-70 leading-none mt-0.5 whitespace-nowrap">(Project List)</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-end space-x-6">
          {activeTab !== AppTab.HOME && (
            <>
              {(activeTab === AppTab.SETTINGS || activeTab === AppTab.USERS || activeTab === AppTab.ABOUT || activeTab === AppTab.SEAT_ALLOCATION) && (
               <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 animate-fadeIn">
                 {((['Budget', 'Actuals'] as FiscalMode[])).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        updateContext(activeTab, m);
                        if (m !== 'Actuals') setShowEmptyActuals(true);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        fiscalMode === m
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {m === 'Actuals' ? 'Actual' : m}
                    </button>
                  ))}
                </div>
              )}

              {activeTab !== AppTab.HR_RESOURCES && activeTab !== AppTab.CONFIG && !(activeTab === AppTab.DCBA_PORTAL && dcbaViewMode === 'yoy') && (
                <div className="relative" ref={fyDropdownRef}>
                  <button 
                    onClick={() => setIsFYOpen(!isFYOpen)}
                    className="flex bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 items-center gap-2 hover:bg-slate-200 transition-all"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {selectedFYs.includes('All FY') ? 'All FY' : (selectedFYs.length > 1 ? `${selectedFYs.length} Years` : selectedFYs[0])}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isFYOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isFYOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden animate-fadeIn py-1">
                      <div className="max-h-[250px] overflow-y-auto no-scrollbar py-1">
                        {['All FY', ...ALL_FISCAL_YEARS.filter(y => y !== 'All FY')].map(fy => {
                          const isAllFYLabel = fy === 'All FY';
                          // If 'All FY' is clicked, the selection array will exact match ['All FY']
                          // Check if 'ALL FY' is the actual single selected item
                          const isSelected = isAllFYLabel ? selectedFYs.includes('All FY') : selectedFYs.includes(fy as FiscalYear);
                          
                          return (
                            <label 
                              key={fy} 
                              className={`flex items-center px-3 py-1.5 hover:bg-indigo-50 cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50/40' : ''}`}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                toggleFY(fy); 
                              }}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'
                              }`}>
                                {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <span className={`ml-2.5 text-[9px] font-black uppercase tracking-tight ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                                {isAllFYLabel ? 'ALL FY' : fy}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border shadow-sm transition-all ${
            syncStatus === 'synced' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
            syncStatus === 'error' ? 'bg-red-50 border-red-100 text-red-600' :
            'bg-amber-50 border-amber-100 text-amber-600'
          }`}>
            <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {syncStatus === 'error' ? (
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest">
              {syncStatus === 'synced' ? 'SYNCED' : 
               syncStatus === 'syncing' ? 'SYNCING' : 
               syncStatus === 'error' ? 'SYNC ERROR' : 
               syncStatus === 'unconfigured' && syncConfig.url === 'local' ? 'LOCAL MODE' :
               'PENDING'}
            </span>
          </div>

          <div className="flex items-center space-x-4 border-l border-slate-200 pl-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{currentUser.username}</p>
              <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest mt-1">{currentUser.role === 'NA' ? 'ASSOCIATE' : currentUser.role}</p>
            </div>
            <button 
              type="button"
              onClick={handleLogout} 
              className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100 cursor-pointer" 
              title="SIGN OUT"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
