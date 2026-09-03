
import React from 'react';
import HRManagement from './HRManagement';
import { Employee, Project, MasterConfig, User, DeletionTarget, SyncConfig } from '../types';

interface ResourcesViewProps {
  currentUser: User;
  isAdmin: boolean;
  employees: Employee[];
  projects: Project[];
  masterConfig: MasterConfig;
  handleUpdateEmployees: (employees: Employee[]) => void;
  setDeletionTarget: (target: DeletionTarget | null) => void;
  hrTreeZoom: number;
  setHrTreeZoom: (zoom: number) => void;
  hrTreeLayout: 'horizontal' | 'columnar';
  setHrTreeLayout: (layout: 'horizontal' | 'columnar') => void;
  hrCollapsedNodes: Set<string>;
  setHrCollapsedNodes: (nodes: Set<string>) => void;
  hrViewMode: 'tabular' | 'graphical' | 'matrix' | 'dashboard';
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
  selectedFY: any;
  syncConfig: SyncConfig;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  currentUser,
  isAdmin,
  employees,
  projects,
  masterConfig,
  handleUpdateEmployees,
  setDeletionTarget,
  hrTreeZoom,
  setHrTreeZoom,
  hrTreeLayout,
  setHrTreeLayout,
  hrCollapsedNodes,
  setHrCollapsedNodes,
  hrViewMode,
  notify,
  selectedFY,
  syncConfig
}) => {
  if (!(currentUser?.hasResourceAccess || isAdmin)) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-40 bg-white rounded-[3rem] border border-slate-100 shadow-sm animate-fadeIn text-center">
        <div className="bg-red-50 p-6 rounded-full text-red-500 mb-6 mx-auto">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Your profile is not authorized for resource inventory inspection</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-fadeIn">
      <HRManagement 
        employees={employees} 
        projects={projects} 
        config={masterConfig} 
        onUpdateEmployees={handleUpdateEmployees}
        onDeleteEmployee={(id, name) => setDeletionTarget({ type: 'employee', id, name })}
        onDeleteAll={() => setDeletionTarget({ type: 'employees', id: 'all', name: 'All Resources' })}
        isAdmin={isAdmin}
        zoom={hrTreeZoom}
        setZoom={setHrTreeZoom}
        layout={hrTreeLayout}
        setLayout={setHrTreeLayout}
        collapsedNodes={hrCollapsedNodes}
        setCollapsedNodes={setHrCollapsedNodes}
        viewMode={hrViewMode}
        notify={notify}
        selectedFY={selectedFY}
        syncConfig={syncConfig}
      />
    </div>
  );
};
