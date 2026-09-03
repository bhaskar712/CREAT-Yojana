
import React from 'react';
import { PortfolioIntelligenceBar } from './Dashboard';
import { FilterBar } from './Filters';
import Dashboard from './Dashboard';
import { AppTab, Project, MasterConfig, FiscalMode, FiscalYear, User } from '../types';

interface DashboardViewProps {
  currentSummary: any;
  fiscalMode: FiscalMode;
  updateContext?: (tab: AppTab, mode?: FiscalMode) => void;
  sharedFilters: any;
  setSharedFilters: (filters: any) => void;
  dynamicOptions: any;
  verticalOptions: string[];
  sharedActions: React.ReactNode;
  projectsInScope: Project[];
  prevYearProjects: Project[];
  isPrevYearLoading: boolean;
  selectedFYs: FiscalYear[];
  currentFYFinancials: any;
  masterConfig: MasterConfig;
  currentUser: User;
  currentMonths: string[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentSummary,
  fiscalMode,
  updateContext,
  sharedFilters,
  setSharedFilters,
  dynamicOptions,
  verticalOptions,
  sharedActions,
  projectsInScope,
  prevYearProjects,
  isPrevYearLoading,
  selectedFYs,
  currentFYFinancials,
  masterConfig,
  currentUser,
  currentMonths
}) => {
  return (
    <div className="flex flex-col space-y-4 animate-fadeIn">
      <div className="shrink-0 space-y-3">
        <PortfolioIntelligenceBar stats={currentSummary} label={fiscalMode === 'Budget' ? "Budget Analytics" : "PMO Hub"} />
        <FilterBar filters={sharedFilters} setFilters={setSharedFilters} dynamicOptions={dynamicOptions} authorizedVerticals={verticalOptions} actionButtons={sharedActions} />
      </div>
      <div className="pb-8 w-full">
        <Dashboard 
          allProjects={projectsInScope} 
          prevYearProjects={prevYearProjects} 
          isPrevYearLoading={isPrevYearLoading} 
          selectedFYs={selectedFYs} 
          hourlyRate={currentFYFinancials.hourlyRate} 
          hoursPerMonth={currentFYFinancials.hoursPerMonth} 
          projectCategories={masterConfig.projectCategories || []} 
          currentUser={currentUser} 
          verticals={masterConfig.verticals || []} 
          config={masterConfig} 
          filters={sharedFilters} 
          setFilters={setSharedFilters} 
          dynamicOptions={dynamicOptions} 
          authorizedVerticals={verticalOptions} 
          months={currentMonths} 
          fiscalMode={fiscalMode} 
          setFiscalMode={(m) => updateContext && updateContext(AppTab.DASHBOARD, m)}
        />
      </div>
    </div>
  );
};
