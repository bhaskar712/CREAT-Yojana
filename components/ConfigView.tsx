
import React from 'react';
import MasterConfigComponent from './MasterConfig';
import { MasterConfig, FiscalYear, User, DeletionTarget, SyncConfig, SyncStatus, FiscalMode } from '../types';

interface ConfigViewProps {
  isAdmin: boolean;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  selectedFY: FiscalYear | null;
  history: any[];
  onlineUserIds: string[];
  masterConfig: MasterConfig;
  fiscalLocks: Record<string, boolean>;
  aggregatedMonthLocks: Record<string, boolean[]>;
  projects: any[];
  users: User[];
  lastUpdated: number;
  setMasterConfig: (config: MasterConfig | ((prev: MasterConfig) => MasterConfig)) => void;
  triggerLocalUpdate: () => void;
  setUsers: (users: User[]) => void;
  syncConfig: SyncConfig;
  handleRestore: (backup: any) => void;
  syncStatus: SyncStatus;
  setDeletionTarget: (target: DeletionTarget | null) => void;
  handleToggleFiscalLock: (fy: FiscalYear, mode?: FiscalMode, type?: 'budget' | 'pmo') => void;
  handleToggleMonthLock: (fy: FiscalYear, monthIndex: number | 'all' | 'none') => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  isAdmin,
  activeCategory,
  setActiveCategory,
  selectedFY,
  history,
  onlineUserIds,
  masterConfig,
  fiscalLocks,
  aggregatedMonthLocks,
  projects,
  users,
  lastUpdated,
  setMasterConfig,
  triggerLocalUpdate,
  setUsers,
  syncConfig,
  handleRestore,
  syncStatus,
  setDeletionTarget,
  handleToggleFiscalLock,
  handleToggleMonthLock
}) => {
  if (!isAdmin) return null;

  return (
    <div className="w-full h-full">
      <MasterConfigComponent 
        activeCategory={activeCategory} 
        onCategoryChange={setActiveCategory} 
        selectedFY={selectedFY} 
        history={history} 
        onlineUserIds={onlineUserIds} 
        config={masterConfig} 
        fiscalLocks={fiscalLocks}
        forecastMonthLocks={aggregatedMonthLocks}
        allProjects={projects} 
        masterProjects={[]} 
        users={users} 
        lastUpdated={lastUpdated} 
        onUpdate={c => { setMasterConfig(c); triggerLocalUpdate(); }} 
        onUpdateUsers={u => { setUsers(u); triggerLocalUpdate(); }} 
        onRenameItem={(cat, old, newVal) => { 
          setMasterConfig(prev => { 
            const currentList = prev[cat as keyof MasterConfig]; 
            if (Array.isArray(currentList)) return { ...prev, [cat]: (currentList as string[]).map(v => v === old ? newVal : v) } as MasterConfig; 
            return prev; 
          }); 
          triggerLocalUpdate(); 
        }} 
        syncConfig={syncConfig} 
        onSyncConfigUpdate={cfg => { localStorage.setItem('creat_yojana_sync_config', JSON.stringify(cfg)); window.location.reload(); }} 
        onRestore={handleRestore} 
        syncStatus={syncStatus} 
        onUserDelete={(id, name) => setDeletionTarget({ type: 'user', id, name })} 
        onToggleFiscalLock={handleToggleFiscalLock}
        onToggleMonthLock={handleToggleMonthLock}
      />
    </div>
  );
};
