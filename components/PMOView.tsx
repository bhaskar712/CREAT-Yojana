
import React from 'react';
import PMO from './PMO';
import { Project, MasterProject, MasterConfig, FiscalYear, Employee, DeletionTarget } from '../types';

interface PMOViewProps {
  projects: Project[];
  masterProjects: MasterProject[];
  canViewVertical: (v: string) => boolean;
  selectedFYs: FiscalYear[];
  setSelectedFY: (fy: FiscalYear | FiscalYear[]) => void;
  DEFAULT_FY: string;
  masterConfig: MasterConfig;
  processorSubTab: any;
  processorRawData: any;
  setProcessorRawData: (data: any) => void;
  processorFileName: string;
  setProcessorFileName: (name: string) => void;
  processorMode: any;
  setProcessorMode: (mode: any) => void;
  currentMonths: string[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  triggerLocalUpdate: () => void;
  isCurrentContextLocked: boolean;
  employees: Employee[];
  isAdmin: boolean;
  setDeletionTarget: (target: DeletionTarget | null) => void;
  activeTab?: 'list' | 'analytics';
  lastUpdated?: number;
}

export const PMOView: React.FC<PMOViewProps> = ({
  activeTab = 'list',
  projects,
  masterProjects,
  canViewVertical,
  selectedFYs,
  setSelectedFY,
  DEFAULT_FY,
  masterConfig,
  processorSubTab,
  processorRawData,
  setProcessorRawData,
  processorFileName,
  setProcessorFileName,
  processorMode,
  setProcessorMode,
  currentMonths,
  setProjects,
  triggerLocalUpdate,
  isCurrentContextLocked,
  employees,
  isAdmin,
  setDeletionTarget,
  lastUpdated
}) => {
  return (
    <div className="w-full h-full animate-fadeIn">
      <PMO 
        existingProjects={projects.filter(p => canViewVertical(p.vertical))}
        masterProjects={masterProjects}
        selectedFYs={selectedFYs}
        setSelectedFY={setSelectedFY}
        masterConfig={masterConfig}
        activeTab={processorSubTab}
        rawData={processorRawData}
        setRawData={setProcessorRawData}
        fileName={processorFileName}
        setFileName={setProcessorFileName}
        mode={processorMode}
        setMode={setProcessorMode}
        months={currentMonths}
        setProjects={setProjects}
        triggerLocalUpdate={triggerLocalUpdate}
        isLocked={isCurrentContextLocked}
        lastUpdated={lastUpdated}
        employees={employees}
        isAdmin={isAdmin}
        onDeleteAll={() => setDeletionTarget({ type: 'projects', id: 'all', name: 'All Projects' })}
      />
    </div>
  );
};
