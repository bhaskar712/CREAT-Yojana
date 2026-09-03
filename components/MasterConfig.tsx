
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MasterConfigState, ProjectData, User, AuditLogEntry, MANPOWER_CATEGORIES, EXPENSE_CATEGORIES, FiscalYear, MonthIndex, FiscalMode } from '../types';
import UserManagement from './UserManagement';
import { SpreadsheetLocks } from './SpreadsheetLocks';
import { syncService } from '../services/syncService';
import { ALL_FISCAL_YEARS, DEFAULT_FY, RATE_PER_HOUR, HOURS_PER_MONTH, CONTRACTED_EMPLOYEE_RATE } from '../constants';

interface MasterConfigProps {
  selectedFY: FiscalYear | null;
  config: MasterConfigState;
  fiscalLocks: Record<string, boolean>;
  forecastMonthLocks: Record<string, boolean[]>;
  allProjects: ProjectData[];
  masterProjects: any[]; // Kept for backward compatibility but unused
  users: User[];
  onUpdate: (newConfig: MasterConfigState) => void;
  onUpdateUsers: (newUsers: User[]) => void;
  onRenameItem: (category: keyof MasterConfigState, oldVal: string, newVal: string) => void;
  syncConfig: { url: string; key: string };
  onSyncConfigUpdate: (cfg: { url: string; key: string }) => void;
  onRestore: (snapshotId?: string) => void;
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline' | 'unconfigured' | 'pending';
  onUserDelete: (id: string, name: string) => void;
  onToggleFiscalLock: (fy: FiscalYear, mode?: FiscalMode, type?: 'budget' | 'pmo') => void;
  onToggleMonthLock: (fy: FiscalYear, monthIndex: number | 'all' | 'none') => void;
  lastUpdated: number;
  onlineUserIds: string[];
  history: AuditLogEntry[];
  activeCategory: string;
  onCategoryChange: (cat: any) => void;
}

const TARGET_VERTICALS = ['ECS-1', 'ECS-2', 'LAS', 'CoC', 'INITIA', 'ATG', 'Support', 'SCS'];

const BenchmarkGrid: React.FC<{ 
  type: 'manpower' | 'expenses', 
  categories: string[], 
  label: string, 
  config: MasterConfigState,
  benchFY: FiscalYear,
  onUpdate: (vertical: string, type: 'manpower' | 'expenses', category: string, value: string) => void 
}> = ({ type, categories, label, config, benchFY, onUpdate }) => {
  const currentFYBenchmarks = config.fyBenchmarks?.[benchFY] || {};
  
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] border-l-4 border-indigo-500 pl-3">
        {label} (LY Actuals)
      </h4>
      <div className="overflow-x-auto no-scrollbar border border-slate-200 rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 sticky top-0 z-20">
            <tr>
              <th className="px-4 py-3 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-30 w-[180px]">Category</th>
              <th className="px-4 py-3 border-b border-r border-slate-200 bg-slate-100 text-slate-900 text-center w-[100px]">Total</th>
              {TARGET_VERTICALS.map(v => (
                <th key={v} className="px-4 py-3 border-b border-r border-slate-200 text-center w-[100px]">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[10px] font-black text-slate-700">
            {categories.map(cat => {
              const rowSum = TARGET_VERTICALS.reduce((sum, v) => sum + (currentFYBenchmarks[v]?.[type]?.[cat] || 0), 0);
              return (
                <tr key={cat} className="h-10 hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-1.5 border-b border-r border-slate-100 sticky left-0 bg-white z-10 truncate text-[9px] uppercase text-slate-400 group-hover:bg-slate-50 transition-colors">
                    {cat.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-1.5 border-b border-r border-slate-100 bg-slate-50/50 text-right font-mono text-indigo-600 font-black">
                    {rowSum.toFixed(2)}
                  </td>
                  {TARGET_VERTICALS.map(v => (
                    <td key={v} className="px-1 border-b border-r border-slate-100">
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full h-8 bg-transparent text-right px-3 outline-none font-mono text-slate-900 placeholder:text-slate-200 focus:bg-indigo-50/50 transition-all font-black"
                        value={currentFYBenchmarks[v]?.[type]?.[cat] ?? ""}
                        onChange={(e) => onUpdate(v, type, cat, e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="bg-slate-900 text-white h-12">
              <td className="px-4 py-1.5 border-r border-slate-800 sticky left-0 bg-slate-900 z-10 text-[10px] uppercase font-black italic">
                TOTAL {type.toUpperCase()} (LY)
              </td>
              <td className="px-4 py-1.5 border-r border-slate-800 text-right font-mono text-indigo-300 font-black text-xs">
                {categories.reduce((acc, cat) => acc + TARGET_VERTICALS.reduce((sum, v) => sum + (currentFYBenchmarks[v]?.[type]?.[cat] || 0), 0), 0).toFixed(2)}
              </td>
              {TARGET_VERTICALS.map(v => (
                <td key={v} className="px-4 py-1.5 border-r border-slate-800 text-right font-mono font-black text-xs">
                  {categories.reduce((sum, cat) => sum + (currentFYBenchmarks[v]?.[type]?.[cat] || 0), 0).toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MasterConfig: React.FC<MasterConfigProps> = ({ 
  selectedFY,
  config, 
  fiscalLocks: aggregatedFiscalLocks,
  forecastMonthLocks: aggregatedMonthLocks,
  allProjects, 
  users,
  onUpdate,
  onUpdateUsers,
  onRenameItem,
  syncConfig,
  onSyncConfigUpdate,
  onRestore,
  syncStatus,
  onUserDelete,
  onToggleFiscalLock,
  onToggleMonthLock,
  lastUpdated,
  onlineUserIds,
  history,
  activeCategory,
  onCategoryChange
}) => {
  const configFileInputRef = useRef<HTMLInputElement>(null);
  const [newItem, setNewItem] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [benchFY, setBenchFY] = useState<FiscalYear>(selectedFY || 'FY 25-26');
  
  const [visibleYears, setVisibleYears] = useState<FiscalYear[]>([
    'FY 24-25', 'FY 25-26', 'FY 26-27', 'FY 27-28'
  ]);
  const [selectedMonthFY, setSelectedMonthFY] = useState<FiscalYear>(selectedFY || 'FY 25-26');
  
  const [snapshots, setSnapshots] = useState<{id: string, updated_at: string}[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  
  const [remoteUrl, setRemoteUrl] = useState(syncConfig.url === 'local' ? '' : syncConfig.url);
  const [remoteKey, setRemoteKey] = useState(syncConfig.key === 'local' ? '' : syncConfig.key);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  const categories: { id: keyof MasterConfigState | 'cloud' | 'finance' | 'users' | 'history' | 'benchmarks' | 'fiscal_locks'; label: string }[] = [
    { id: 'verticals', label: 'Verticals' },
    { id: 'functionalTeams', label: 'Functional Teams' },
    { id: 'buDomains', label: 'Domains' },
    { id: 'businessUnits', label: 'Business Units' },
    { id: 'projectTypes', label: 'Project Types' },
    { id: 'productFamilies', label: 'Product Families' },
    { id: 'segments', label: 'Segments' },
    { id: 'paces', label: 'Pace Options' },
    { id: 'customers', label: 'Customer List' },
    { id: 'projectCategories', label: 'Project Categories' },
    { id: 'bands', label: 'Resource Bands' },
    { id: 'employeeCategories', label: 'Resource Categories' },
    { id: 'locations', label: 'Operating Locations' },
    { id: 'skillLevelsL2', label: 'Skills (L2)' },
    { id: 'pfsStatuses', label: 'PFS Status Options' },
    { id: 'pmtTechSalesOptions' as any, label: 'PMT Tech Sales' },
    { id: 'finance', label: 'Financial Settings' },
    { id: 'forecast_config' as any, label: 'Forecast Settings' },
    { id: 'benchmarks', label: 'LY Actuals' },
    { id: 'fiscal_locks' as any, label: 'Fiscal Locks' },
    { id: 'users', label: 'Identity & Access' },
    { id: 'history', label: 'Activity History' },
    { id: 'cloud', label: 'Cloud Backups' },
  ];

  useEffect(() => {
    if (activeCategory === 'cloud' && syncConfig.url && syncConfig.key) {
      loadSnapshots();
    }
  }, [activeCategory, syncConfig]);

  const loadSnapshots = async () => {
    setCloudError(null);
    try {
      const list = await syncService.listSnapshots(syncConfig);
      setSnapshots(list);
    } catch (e: any) {
      setCloudError(e.message || JSON.stringify(e));
    }
  };

  const handleExportConfig = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchorNode = document.createElement('a');
    const fySlug = (selectedFY || 'Global').replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `CREAT_Config_${fySlug}_${timestamp}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Basic schema validation
        const requiredKeys = ['verticals', 'buDomains', 'productFamilies', 'fyFinancials'];
        const hasRequiredKeys = requiredKeys.every(k => k in parsed);

        if (!hasRequiredKeys) {
          throw new Error("Invalid configuration schema. Required protocol keys missing.");
        }

        if (parsed.benchmarks && !parsed.fyBenchmarks) {
          parsed.fyBenchmarks = { 'FY 25-26': parsed.benchmarks };
        }

        setConfirmModal({
          title: "PROTOCOL ALERT",
          message: "You are about to overwrite the entire global configuration. This action cannot be undone. Proceed?",
          onConfirm: () => {
            onUpdate(parsed as MasterConfigState);
            showNotify("Global configuration protocol updated successfully.", "success");
            setConfirmModal(null);
          }
        });
      } catch (err: any) {
        showNotify("Import Protocol Failure: " + err.message, "error");
      } finally {
        if (configFileInputRef.current) configFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const filteredHistory = useMemo(() => {
    const s = historySearch.toLowerCase().trim();
    if (!s) return history;
    return history.filter(h => 
      h.username.toLowerCase().includes(s) || 
      h.action.toLowerCase().includes(s) || 
      h.details.toLowerCase().includes(s)
    );
  }, [history, historySearch]);

  const handleCreateSnapshot = async () => {
    const name = snapshotName.trim() || `Auto-Backup-${new Date().toLocaleDateString()}`;
    const id = `snapshot:${name}:${Date.now()}`;
    setIsCreatingSnapshot(true);
    setCloudError(null);
    try {
      await syncService.saveToServer(syncConfig, {
        projects: allProjects,
        masterProjects: [],
        users,
        masterConfig: config,
        lastUpdated,
        settings: {},
        history
      }, id);
      setSnapshotName("");
      showNotify(`Snapshot "${name}" created successfully.`, "success");
      loadSnapshots();
    } catch (e: any) {
      setCloudError(e.message || JSON.stringify(e));
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    setConfirmModal({
      title: "DELETE SNAPSHOT",
      message: "Are you sure you want to delete this snapshot permanently from the cloud?",
      onConfirm: async () => {
        setCloudError(null);
        try {
          await syncService.deleteSnapshot(syncConfig, id);
          loadSnapshots();
          showNotify("Snapshot deleted successfully.", "success");
        } catch (e: any) {
          setCloudError(e.message || JSON.stringify(e));
        }
        setConfirmModal(null);
      }
    });
  };

  const getFieldName = (cat: string): string => {
    switch(cat) {
      case 'verticals': return "vertical";
      case 'buDomains': return "buDomain";
      case 'businessUnits': return "businessUnit";
      case 'projectTypes': return "projectType";
      case 'productFamilies': return "productFamily";
      case 'segments': return "segment";
      case 'paces': return "pace";
      case 'customers': return "customer";
      case 'projectCategories': return "category";
      case 'pmtTechSalesOptions': return "pmtTechSales";
      default: return "";
    }
  };

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed || ['cloud', 'finance', 'users', 'history', 'benchmarks'].includes(activeCategory)) return;
    const currentList = config[activeCategory as keyof MasterConfigState] as string[];
    if (currentList && currentList.includes(trimmed)) {
      showNotify("Item already exists", "error");
      return;
    }
    
    onUpdate({
      ...config,
      [activeCategory]: [...(currentList || []), trimmed]
    });
    setNewItem("");
  };

  const handleStartEdit = (item: string) => {
    setEditingItem(item);
    setEditValue(item);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || !editingItem || ['cloud', 'finance', 'users', 'history', 'benchmarks'].includes(activeCategory)) {
      setEditingItem(null);
      return;
    }
    if (trimmed === editingItem) {
      setEditingItem(null);
      return;
    }
    const currentList = config[activeCategory as keyof MasterConfigState] as string[];
    if (currentList && currentList.includes(trimmed)) {
      showNotify("This name is already in the list.", "error");
      return;
    }
    onRenameItem(activeCategory as keyof MasterConfigState, editingItem, trimmed);
    setEditingItem(null);
  };

  const handleRemove = (item: string) => {
    if (['cloud', 'finance', 'users', 'history', 'benchmarks'].includes(activeCategory)) return;
    const fieldName = getFieldName(activeCategory);
    if (fieldName) {
      const checkUsageCount = (list: any[]) => list.filter(p => p[fieldName] === item).length;
      const totalUsage = checkUsageCount(allProjects);
      if (totalUsage > 0) {
        showNotify(`Restriction: "${item}" is actively used by ${totalUsage} project(s). Reassign or delete those projects first.`, "error");
        return;
      }
    }
    
    setConfirmModal({
      title: "DELETE ITEM",
      message: `Are you sure you want to delete "${item}" from global ${activeCategory}?`,
      onConfirm: () => {
        onUpdate({
          ...config,
          [activeCategory]: (config[activeCategory as keyof MasterConfigState] as string[]).filter(i => i !== item)
        });
        showNotify(`"${item}" removed successfully.`, "success");
        setConfirmModal(null);
      }
    });
  };

  const handleMove = (item: string, direction: 'up' | 'down') => {
    if (['cloud', 'finance', 'users', 'history', 'benchmarks'].includes(activeCategory)) return;
    const currentList = [...(config[activeCategory as keyof MasterConfigState] as string[] || [])];
    const idx = currentList.indexOf(item);
    if (idx === -1) return;

    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentList.length) return;

    // Swap items
    [currentList[idx], currentList[newIdx]] = [currentList[newIdx], currentList[idx]];

    onUpdate({
      ...config,
      [activeCategory]: currentList
    });
  };

  const handleSortAlphabetical = () => {
    if (['cloud', 'finance', 'users', 'history', 'benchmarks'].includes(activeCategory)) return;
    const currentList = [...(config[activeCategory as keyof MasterConfigState] as string[] || [])];
    currentList.sort((a, b) => a.localeCompare(b));
    onUpdate({
      ...config,
      [activeCategory]: currentList
    });
  };

  const handleFYFinancialUpdate = (fy: string, field: 'hourlyRate' | 'hoursPerMonth' | 'contractedEmployeeRate', val: string) => {
    const num = parseFloat(val) || 0;
    const currentFYConfigs = { ...(config.fyFinancials || {}) };
    const fyConfig = { ...(currentFYConfigs[fy] || { hourlyRate: 1450, hoursPerMonth: 180, contractedEmployeeRate: 1450 }) };
    
    fyConfig[field] = num;
    currentFYConfigs[fy] = fyConfig;
    
    onUpdate({ ...config, fyFinancials: currentFYConfigs });
  };

  const handleBenchmarkUpdate = (vertical: string, type: 'manpower' | 'expenses', category: string, value: string) => {
    const num = parseFloat(value) || 0;
    const currentBenchmarks = { ...(config.fyBenchmarks || {}) };
    const fyBench = { ...(currentBenchmarks[benchFY] || {}) };
    const vertBench = { ...(fyBench[vertical] || { manpower: {}, expenses: {} }) };
    
    if (type === 'manpower') {
      vertBench.manpower = { ...vertBench.manpower, [category]: num };
    } else {
      vertBench.expenses = { ...vertBench.expenses, [category]: num };
    }
    
    fyBench[vertical] = vertBench;
    currentBenchmarks[benchFY] = fyBench;
    onUpdate({ ...config, fyBenchmarks: currentBenchmarks });
  };

  const HistoryTypeBadge = ({ type }: { type: AuditLogEntry['type'] }) => {
    const styles = {
      create: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      update: 'bg-blue-50 text-blue-600 border-blue-100',
      delete: 'bg-red-50 text-red-600 border-red-100',
      system: 'bg-slate-50 text-slate-600 border-slate-200'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border leading-none shadow-xs ${styles[type]}`}>
        {type}
      </span>
    );
  };

  const fiscalYears = ALL_FISCAL_YEARS.filter(y => y !== 'All FY') as FiscalYear[];

  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-fadeIn pb-10 leading-none">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">Global Config</h2>
          <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mt-2">Governance, Taxonomy & Access Protocol</p>
        </div>
        <div className="flex items-center space-x-3">
          <input 
            type="file" 
            ref={configFileInputRef} 
            className="hidden" 
            accept=".json" 
            onChange={handleImportConfig} 
          />
          <button 
            onClick={() => configFileInputRef.current?.click()}
            className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm"
            title="Import Global Config JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Import JSON</span>
          </button>
          <button 
            onClick={handleExportConfig}
            className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm"
            title="Export Global Config JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Export JSON</span>
          </button>
          <div className="bg-indigo-50 border border-indigo-100 px-4 sm:px-5 py-2.5 rounded-xl flex items-center space-x-3 shadow-xs w-full sm:w-auto">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeWidth="2.5"/></svg>
            <span className="text-[8px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate">ACTIVE: {categories.find(c => c.id === activeCategory)?.label?.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 w-full">
        <div className="lg:w-1/4 bg-white p-3 sm:p-6 rounded-[1.5rem] border border-slate-200 shadow-sm h-fit lg:sticky lg:top-28 overflow-x-auto no-scrollbar">
          <div className="flex lg:flex-col gap-2 min-w-max lg:min-w-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { onCategoryChange(cat.id); setEditingItem(null); }}
                className={`flex-1 text-left px-4 sm:px-5 py-2 sm:py-3.5 rounded-xl text-[9px] sm:text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap lg:whitespace-normal ${
                  activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-lg lg:scale-105' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:w-3/4 space-y-6">
          {activeCategory === 'users' && (
            <UserManagement users={users} onUpdate={onUpdateUsers} onDelete={onUserDelete} onlineUserIds={onlineUserIds} />
          )}

          {activeCategory === 'history' && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Operational Log</h3>
                <div className="relative w-64">
                   <input type="text" placeholder="Search logs..." className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100" value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                   <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3"/></svg>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] no-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr className="text-[8px] font-black uppercase text-slate-400">
                      <th className="px-6 py-4 border-b">Timestamp</th>
                      <th className="px-6 py-4 border-b">Identity</th>
                      <th className="px-6 py-4 border-b">Action</th>
                      <th className="px-6 py-4 border-b">Type</th>
                      <th className="px-6 py-4 border-b">Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-[10px] font-black text-slate-600">
                    {filteredHistory.slice(0, 100).map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-mono text-slate-300 text-[9px]">{new Date(h.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-3 uppercase text-indigo-600">{h.username}</td>
                        <td className="px-6 py-3 uppercase">{h.action}</td>
                        <td className="px-6 py-3"><HistoryTypeBadge type={h.type} /></td>
                        <td className="px-6 py-3 text-slate-400 normal-case italic font-medium">{h.details}</td>
                      </tr>
                    ))}
                    {filteredHistory.length > 100 && (
                      <tr><td colSpan={5} className="px-6 py-3 text-center text-slate-400 italic font-bold">Showing first 100/ {filteredHistory.length} logs (Search to find more)</td></tr>
                    )}
                    {filteredHistory.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-300 italic">No operational logs recorded in current session scope</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'benchmarks' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select FY Context:</span>
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {fiscalYears.map(fy => (
                    <button 
                      key={fy} 
                      onClick={() => setBenchFY(fy)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${benchFY === fy ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {fy}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-10">
                <BenchmarkGrid type="manpower" categories={MANPOWER_CATEGORIES} label="Manpower Roll-up" config={config} benchFY={benchFY} onUpdate={handleBenchmarkUpdate} />
                <BenchmarkGrid type="expenses" categories={EXPENSE_CATEGORIES} label="Expense Roll-up" config={config} benchFY={benchFY} onUpdate={handleBenchmarkUpdate} />
              </div>
            </div>
          )}

          {activeCategory === 'finance' && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 border-l-4 border-indigo-500 pl-4">Financial Protocol Settings</h3>
              
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4 border-b border-r border-slate-200">Context (FY)</th>
                      <th className="px-6 py-4 border-b border-r border-slate-200">Hourly Deployment Rate (INR)</th>
                      <th className="px-6 py-4 border-b border-r border-slate-200">Contracted Employee Rate (INR)</th>
                      <th className="px-6 py-4 border-b border-r border-slate-200">Monthly Operational Hours</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-black text-slate-700">
                    {fiscalYears.map((fy) => {
                      const settings = config.fyFinancials?.[fy] || { 
                        hourlyRate: config.hourlyRate || RATE_PER_HOUR, 
                        hoursPerMonth: config.hoursPerMonth || HOURS_PER_MONTH, 
                        contractedEmployeeRate: config.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE 
                      };
                      return (
                        <tr key={fy} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 border-b border-r border-slate-100 bg-slate-50/20 text-indigo-600 font-black">{fy}</td>
                          <td className="px-6 py-2 border-b border-r border-slate-100">
                            <input 
                              type="number" 
                              className="w-full bg-transparent border-none px-2 py-2 outline-none font-mono text-slate-900 focus:bg-indigo-50/50 rounded-lg transition-all"
                              value={settings.hourlyRate}
                              onChange={(e) => handleFYFinancialUpdate(fy, 'hourlyRate', e.target.value)}
                            />
                          </td>
                          <td className="px-6 py-2 border-b border-r border-slate-100">
                            <input 
                              type="number" 
                              className="w-full bg-transparent border-none px-2 py-2 outline-none font-mono text-slate-900 focus:bg-indigo-50/50 rounded-lg transition-all"
                              value={settings.contractedEmployeeRate ?? settings.hourlyRate}
                              onChange={(e) => handleFYFinancialUpdate(fy, 'contractedEmployeeRate', e.target.value)}
                            />
                          </td>
                          <td className="px-6 py-2 border-b border-r border-slate-100 bg-slate-50/50">
                            <div className="flex flex-col">
                              <input 
                                type="number" 
                                className="w-full bg-transparent border-none px-2 py-2 outline-none font-mono text-slate-400 cursor-not-allowed"
                                value={180}
                                readOnly
                              />
                              <span className="text-[7px] font-black text-slate-400 uppercase px-2 pb-1">Fixed @ 180</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                 <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Global Operational Context</h4>
                 <div className="flex items-center space-x-6">
                    <div className="flex flex-col space-y-1">
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Current Month (Today)</label>
                       <select 
                         className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                         value={config.currentMonthIndex || 0}
                         onChange={(e) => onUpdate({ ...config, currentMonthIndex: parseInt(e.target.value) as any })}
                       >
                         {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m, i) => (
                           <option key={m} value={i}>{m}</option>
                         ))}
                       </select>
                    </div>
                 </div>
              </div>
              
              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight italic">Note: These rates are used for manpower financial valuation and capacity calculations specific to the selected Fiscal Year context.</p>
            </div>
          )}

          {activeCategory === ('forecast_config' as any) && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Operational Month</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={config.currentMonthIndex || 0}
                    onChange={e => onUpdate({ ...config, currentMonthIndex: parseInt(e.target.value) as MonthIndex })}
                  >
                    {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight px-1">Months prior to this will be locked as Actuals (PAST)</p>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Forecast Horizon (Months)</label>
                  <input 
                    type="number"
                    min="1"
                    max="12"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={config.defaultForecastMonths || 3}
                    onChange={e => onUpdate({ ...config, defaultForecastMonths: parseInt(e.target.value) || 3 })}
                  />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight px-1">Number of months from current month eligible for forecasting</p>
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
                  </div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Dynamic Forecasting Logic</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/50">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Past (Actuals)</span>
                    <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">Months prior to {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'][config.currentMonthIndex || 0]}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/50">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-2">Forecast Window</span>
                    <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">Next {config.defaultForecastMonths || 3} Months</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Future (Budget)</span>
                    <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">Remaining FY Months</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'cloud' && (
            <div className="space-y-8">
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-6">
                <div className="flex items-center space-x-4 mb-2">
                  <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeWidth="2.5"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Remote Server Configuration</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Connect to a public server for cross-platform data synchronization</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Server Public URL / IP</label>
                    <input 
                      type="text" 
                      placeholder="e.g. http://1.2.3.4:3000" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                      value={remoteUrl}
                      onChange={e => setRemoteUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Secret Sync Key (Optional)</label>
                    <input 
                      type="password" 
                      placeholder="Security token..." 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                      value={remoteKey}
                      onChange={e => setRemoteKey(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    onClick={() => onSyncConfigUpdate({ url: remoteUrl || 'local', key: remoteKey || 'local' })}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Save & Initialize Sync
                  </button>
                </div>
              </div>

              <div className="bg-indigo-900 rounded-[2rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-2">Cloud Persistence Protocol</h3>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-8">Manual registry snapshots and architectural restoration</p>
                  
                  <div className="flex items-center space-x-4">
                    <input 
                      type="text" 
                      placeholder="Snapshot Alias..." 
                      className="flex-grow bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-sm font-black placeholder:text-indigo-300/50 outline-none focus:bg-white/20 transition-all"
                      value={snapshotName}
                      onChange={e => setSnapshotName(e.target.value)}
                    />
                    <button 
                      onClick={handleCreateSnapshot}
                      disabled={isCreatingSnapshot}
                      className="bg-white text-indigo-900 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all disabled:opacity-50"
                    >
                      {isCreatingSnapshot ? 'Archiving...' : 'Create Snapshot'}
                    </button>
                  </div>
                </div>
              </div>

              {cloudError && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center space-x-3 text-red-600 animate-fadeIn">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="3"/></svg>
                  <span className="text-[10px] font-black uppercase">Sync protocol error: {cloudError}</span>
                </div>
              )}

              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Available Snapshots</h3>
                   <button onClick={loadSnapshots} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline">Refresh List</button>
                </div>
                <div className="overflow-x-auto max-h-[400px] no-scrollbar">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <tr className="text-[8px] font-black uppercase text-slate-400">
                        <th className="px-6 py-4 border-b">Registry Snapshot Name</th>
                        <th className="px-6 py-4 border-b">Archive Timestamp</th>
                        <th className="px-6 py-4 border-b text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-[10px] font-black text-slate-700">
                      {snapshots.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-black text-slate-900 uppercase">{s.id.split(':')[1]}</td>
                          <td className="px-6 py-4 font-mono text-slate-400 text-[9px]">{new Date(s.updated_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button onClick={() => onRestore(s.id)} className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Restore</button>
                              <button onClick={() => handleDeleteSnapshot(s.id)} className="p-1.5 text-red-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" strokeWidth="2.5"/></svg></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {snapshots.length === 0 && (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-300 italic">No remote snapshots identified</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'fiscal_locks' && (
            <SpreadsheetLocks
              config={config}
              fiscalLocks={aggregatedFiscalLocks}
              forecastMonthLocks={aggregatedMonthLocks}
              onToggleFiscalLock={onToggleFiscalLock}
              onToggleMonthLock={onToggleMonthLock}
            />
          )}

          {false && activeCategory === 'fiscal_locks' && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-8 animate-fadeIn">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 border-l-4 border-indigo-600 pl-4 mb-1">Fiscal Year Governance Matrix</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight pl-4 leading-normal">
                    Manage workbook entry permissions and editing windows across active operational years and categories.
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto shadow-xs">
                   <span className="px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Status</span>
                   <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center space-x-1.5 transition-all duration-300 ${
                     config.isFiscalLocked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                   }`}>
                     <span className={`w-1.5 h-1.5 rounded-full bg-white ${config.isFiscalLocked ? 'animate-pulse' : ''}`} />
                     <span>{config.isFiscalLocked ? 'System Locked' : 'System Unlocked'}</span>
                   </div>
                </div>
              </div>

              {/* Protocol Legend / Guide */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100/40 flex items-center justify-center text-[10px] font-black shrink-0">✓</div>
                  <div>
                    <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-wider leading-none mb-1">Unlocked Mode (Open)</h5>
                    <p className="text-[9px] text-slate-500 font-semibold tracking-tight">Authorized roles can write, edit, and adjust numbers in this period.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-lg bg-rose-50 text-rose-750 border border-rose-100/40 flex items-center justify-center text-[10px] font-black shrink-0">✗</div>
                  <div>
                    <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-wider leading-none mb-1">Locked Mode (Read-Only)</h5>
                    <p className="text-[9px] text-slate-500 font-semibold tracking-tight">Access is frozen. Content is strictly read-only for standard users.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100/40 flex items-center justify-center text-[10px] font-black shrink-0">!</div>
                  <div>
                    <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-wider leading-none mb-1">PMO Master Lock Rule</h5>
                    <p className="text-[9px] text-slate-500 font-semibold tracking-tight">Master lockdowns freeze all child operational modes (Budget, Forecast, Actuals).</p>
                  </div>
                </div>
              </div>

              {/* Visible Years Selector (Controls table columns to prevent congestion!) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider pl-1">Specify Matrix Fiscal Years:</span>
                  <div className="flex items-center space-x-2.5">
                    <button
                      onClick={() => setVisibleYears(['FY 24-25', 'FY 25-26', 'FY 26-27', 'FY 27-28'])}
                      className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider hover:underline"
                    >
                      Reset to Active
                    </button>
                    <span className="text-slate-300 text-xs text-center">|</span>
                    <button
                      onClick={() => setVisibleYears(fiscalYears)}
                      className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider hover:underline"
                    >
                      Show All Years
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-50/50 border border-slate-200/50 rounded-2xl">
                  {fiscalYears.map(fy => {
                    const isVisible = visibleYears.includes(fy);
                    return (
                      <button
                        key={fy}
                        onClick={() => {
                          if (isVisible) {
                            if (visibleYears.length > 1) {
                              setVisibleYears(visibleYears.filter(v => v !== fy));
                            }
                          } else {
                            setVisibleYears([...visibleYears, fy].sort((a, b) => fiscalYears.indexOf(a) - fiscalYears.indexOf(b)));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                          isVisible
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {fy}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Governance Matrix Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-700">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[260px] border-r border-slate-200/50">
                          Editing Permissions / Modules
                        </th>
                        {visibleYears.map(fy => (
                          <th key={fy} className="px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{fy}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      
                      {/* Budget Worksheet Lock Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-200/50">
                          <div className="flex items-start space-x-3">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2.5"/></svg>
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-0.5">Budget Workspace Lock</div>
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">Central worksheet entry permissions</div>
                            </div>
                          </div>
                        </td>
                        {visibleYears.map(fy => {
                          const isLocked = aggregatedFiscalLocks[`budget_page_${fy}`];
                          return (
                            <td key={fy} className="px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0">
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <button
                                  onClick={() => onToggleFiscalLock(fy as FiscalYear, undefined, 'budget')}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none cursor-pointer ${
                                    isLocked ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                                  title={isLocked ? "Click to unlock core Budget worksheet" : "Click to lock core Budget worksheet"}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-300 ${
                                    isLocked ? 'translate-x-5' : 'translate-x-0.5'
                                  }`} />
                                </button>
                                <span className={`text-[7px] font-black uppercase tracking-wider ${isLocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {isLocked ? 'Locked' : 'Unlocked'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* PMO Master Lock Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors bg-amber-50/10">
                        <td className="px-6 py-4 border-r border-slate-200/50">
                          <div className="flex items-start space-x-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-0.5">PMO Year Master Lock</div>
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">Overrides and freezes all PMO workspace modes</div>
                            </div>
                          </div>
                        </td>
                        {visibleYears.map(fy => {
                          const masterLocked = aggregatedFiscalLocks[`pmo_page_${fy}_master`];
                          return (
                            <td key={fy} className="px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0">
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <button
                                  onClick={() => onToggleFiscalLock(fy as FiscalYear, undefined, 'pmo')}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none cursor-pointer ${
                                    masterLocked ? 'bg-indigo-600' : 'bg-slate-200'
                                  }`}
                                  title={masterLocked ? "Year level master is LOCKED. Click to deactivate master lock." : "Year level master is UNLOCKED. Click to freeze all sub-operational modes."}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-300 ${
                                    masterLocked ? 'translate-x-5' : 'translate-x-0.5'
                                  }`} />
                                </button>
                                <span className={`text-[7px] font-black uppercase tracking-wider ${masterLocked ? 'text-indigo-600' : 'text-slate-400'}`}>
                                  {masterLocked ? 'Master Locked' : 'Active'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* PMO Budget Mode Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-200/50 pl-10">
                          <div className="flex items-start space-x-3">
                            <div className="w-5.5 h-5.5 rounded bg-slate-50 hover:bg-slate-105 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[8px] font-black text-indigo-500">PMO</span>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-700 uppercase tracking-wide mb-0.5">↳ PMO Budget adjustments</div>
                              <div className="text-[8px] text-slate-405 font-medium leading-tight">Editing of active project budgets inside PMO</div>
                            </div>
                          </div>
                        </td>
                        {visibleYears.map(fy => {
                          const masterLocked = aggregatedFiscalLocks[`pmo_page_${fy}_master`];
                          const isLocked = aggregatedFiscalLocks[`pmo_page_${fy}_Budget`] || masterLocked;
                          return (
                            <td key={fy} className={`px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0 transition-opacity ${masterLocked ? 'bg-slate-50/40' : ''}`}>
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <button
                                  disabled={masterLocked}
                                  onClick={() => onToggleFiscalLock(fy as FiscalYear, 'Budget', 'pmo')}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                    masterLocked 
                                      ? 'bg-rose-300 cursor-not-allowed opacity-50' 
                                      : isLocked 
                                        ? 'bg-rose-500 cursor-pointer' 
                                        : 'bg-emerald-500 cursor-pointer'
                                  }`}
                                  title={masterLocked ? "Forced to LOCKED by Master Lock Override" : isLocked ? "Budget items are LOCKED. Click to unlock." : "Budget items are UNLOCKED. Click to lock."}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-300 ${
                                    isLocked ? 'translate-x-5' : 'translate-x-0.5'
                                  }`} />
                                </button>
                                <span className={`text-[7px] font-black uppercase tracking-wider ${
                                  masterLocked ? 'text-rose-600/70 italic' : isLocked ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {masterLocked ? 'Forced Lock' : isLocked ? 'Locked' : 'Unlocked'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* PMO Forecast Mode Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-200/50 pl-10">
                          <div className="flex items-start space-x-3">
                            <div className="w-5.5 h-5.5 rounded bg-slate-50 hover:bg-slate-105 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[8px] font-black text-rose-500 font-mono">FC</span>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-700 uppercase tracking-wide mb-0.5">↳ PMO Forecast adjustments</div>
                              <div className="text-[8px] text-slate-405 font-medium leading-tight">Edits on forecasting modules & submissions</div>
                            </div>
                          </div>
                        </td>
                        {visibleYears.map(fy => {
                          const masterLocked = aggregatedFiscalLocks[`pmo_page_${fy}_master`];
                          const isLocked = aggregatedFiscalLocks[`pmo_page_${fy}_Forecast`] || masterLocked;
                          return (
                            <td key={fy} className={`px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0 transition-opacity ${masterLocked ? 'bg-slate-50/40' : ''}`}>
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <button
                                  disabled={masterLocked}
                                  onClick={() => onToggleFiscalLock(fy as FiscalYear, 'Forecast', 'pmo')}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                    masterLocked 
                                      ? 'bg-rose-300 cursor-not-allowed opacity-50' 
                                      : isLocked 
                                        ? 'bg-rose-500 cursor-pointer' 
                                        : 'bg-emerald-500 cursor-pointer'
                                  }`}
                                  title={masterLocked ? "Forced to LOCKED by Master Lock Override" : isLocked ? "Forecast items are LOCKED. Click to unlock." : "Forecast items are UNLOCKED. Click to lock."}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-300 ${
                                    isLocked ? 'translate-x-5' : 'translate-x-0.5'
                                  }`} />
                                </button>
                                <span className={`text-[7px] font-black uppercase tracking-wider ${
                                  masterLocked ? 'text-rose-600/70 italic' : isLocked ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {masterLocked ? 'Forced Lock' : isLocked ? 'Locked' : 'Unlocked'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* PMO Actuals Mode Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-200/50 pl-10">
                          <div className="flex items-start space-x-3">
                            <div className="w-5.5 h-5.5 rounded bg-slate-50 hover:bg-slate-105 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[8px] font-black text-emerald-500">$</span>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-700 uppercase tracking-wide mb-0.5">↳ PMO Actuals Spent logging</div>
                              <div className="text-[8px] text-slate-405 font-medium leading-tight">Monthly actual spend and resource hours entry</div>
                            </div>
                          </div>
                        </td>
                        {visibleYears.map(fy => {
                          const masterLocked = aggregatedFiscalLocks[`pmo_page_${fy}_master`];
                          const isLocked = aggregatedFiscalLocks[`pmo_page_${fy}_Actuals`] || masterLocked;
                          return (
                            <td key={fy} className={`px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0 transition-opacity ${masterLocked ? 'bg-slate-50/40' : ''}`}>
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <button
                                  disabled={masterLocked}
                                  onClick={() => onToggleFiscalLock(fy as FiscalYear, 'Actuals', 'pmo')}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                    masterLocked 
                                      ? 'bg-rose-300 cursor-not-allowed opacity-50' 
                                      : isLocked 
                                        ? 'bg-rose-500 cursor-pointer' 
                                        : 'bg-emerald-500 cursor-pointer'
                                  }`}
                                  title={masterLocked ? "Forced to LOCKED by Master Lock Override" : isLocked ? "Actual spend tracking is LOCKED. Click to unlock." : "Actual spend tracking is UNLOCKED. Click to lock."}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-300 ${
                                    isLocked ? 'translate-x-5' : 'translate-x-0.5'
                                  }`} />
                                </button>
                                <span className={`text-[7px] font-black uppercase tracking-wider ${
                                  masterLocked ? 'text-rose-600/70 italic' : isLocked ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {masterLocked ? 'Forced Lock' : isLocked ? 'Locked' : 'Unlocked'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Spend Forecast Months Summary Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-200/50">
                          <div className="flex items-start space-x-3">
                            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100/50 mt-0.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2.5"/></svg>
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-0.5">Forecast Monthly Closures</div>
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">Granular forecast month locks overview</div>
                            </div>
                          </div>
                        </td>
                        {visibleYears.map(fy => {
                          const fyMonthLocks = aggregatedMonthLocks[fy] || config.forecastMonthLocks?.[fy] || new Array(12).fill(false);
                          const unlockedCount = 12 - fyMonthLocks.filter(Boolean).length;
                          const isSelected = selectedMonthFY === fy;
                          
                          return (
                            <td key={fy} className="px-5 py-4 text-center border-r border-slate-200/50 last:border-r-0">
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <button
                                  onClick={() => setSelectedMonthFY(fy)}
                                  className={`px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all border shrink-0 ${
                                    isSelected
                                      ? 'bg-amber-600 border-amber-600 text-white shadow-sm font-black'
                                      : 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100/80'
                                  }`}
                                  title={`View/modify month details for ${fy}`}
                                >
                                  {unlockedCount === 12 ? 'ALL OPEN' : unlockedCount === 0 ? 'ALL FLOCKED' : `${unlockedCount}/12 Open`}
                                </button>
                                <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                                  {isSelected ? 'Editing Inline' : 'Click to Configure'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly Interactive Expandable Board for the Currently Selected Month Lock Fiscal Year */}
              {selectedMonthFY && (() => {
                const fyMonthLocks = aggregatedMonthLocks[selectedMonthFY] || config.forecastMonthLocks?.[selectedMonthFY] || new Array(12).fill(false);
                const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                const unlockedMonths = months.filter((_, idx) => !fyMonthLocks[idx]);
                const masterLocked = aggregatedFiscalLocks[`pmo_page_${selectedMonthFY}_master`];

                return (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-[2rem] p-6 space-y-5 animate-fadeIn">
                    
                    {/* Month Section Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                            Monthly Lock Detail Controller: <span className="text-amber-700 select-none font-black text-sm bg-amber-100/60 px-2.5 py-0.5 rounded-lg ml-1 border border-amber-200/20">{selectedMonthFY}</span>
                          </h4>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-tight mt-1.5 pl-4">
                          Selectively lock individual forecast calculation months. Locked months revert to read-only status.
                        </p>
                      </div>

                      {/* Lock/Unlock All Actions */}
                      <div className="flex items-center space-x-2 shrink-0">
                        <button 
                          onClick={() => !masterLocked && onToggleMonthLock(selectedMonthFY, 'none')}
                          disabled={masterLocked}
                          className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-xs shrink-0 ${
                            masterLocked 
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200/50' 
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-100 cursor-pointer active:scale-95'
                          }`}
                        >
                          Unlock All
                        </button>
                        <button 
                          onClick={() => !masterLocked && onToggleMonthLock(selectedMonthFY, 'all')}
                          disabled={masterLocked}
                          className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-xs shrink-0 ${
                            masterLocked 
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200/50' 
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-100 cursor-pointer active:scale-95'
                          }`}
                        >
                          Lock All
                        </button>
                      </div>
                    </div>

                    {/* Hard Lock Override Message */}
                    {masterLocked ? (
                      <div className="text-[9px] font-black text-rose-600 uppercase bg-rose-50 border border-rose-100/50 px-4 py-3 rounded-2xl flex items-center space-x-2">
                        <svg className="w-4 h-4 text-rose-500 mr-1.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        <span>🔒 ALL MONTH SWITCHES PREEMPTIVELY FROZEN WHILE PMO ACTIVE YEAR MASTER LOCK IS ENABLED.</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">
                        <span>Current Openings:</span>
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[8.5px] font-black tracking-widest">
                          {unlockedMonths.length === 12 ? 'ALL 12 MONTHS UNLOCKED' : unlockedMonths.length === 0 ? 'ALL LOCKED' : `${unlockedMonths.length} MONTHS UNLOCKED (${unlockedMonths.join(', ')})`}
                        </span>
                      </div>
                    )}

                    {/* Months Buttons Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                      {months.map((m, idx) => {
                        const isLocked = fyMonthLocks[idx];
                        return (
                          <button
                            key={m}
                            disabled={masterLocked}
                            onClick={() => !masterLocked && onToggleMonthLock(selectedMonthFY, idx)}
                            className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl border transition-all duration-350 relative group overflow-hidden ${
                              masterLocked 
                                ? 'bg-slate-105 text-slate-300 cursor-not-allowed border-slate-100' 
                                : isLocked 
                                  ? 'bg-rose-500 border-rose-500 text-white hover:bg-rose-600 cursor-pointer shadow-sm hover:shadow-md' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/10 cursor-pointer shadow-xs hover:shadow-sm'
                            }`}
                            title={masterLocked ? "Locked by master year override" : `${isLocked ? 'Locked' : 'Unlocked'} - Click to toggle month lock status`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              masterLocked ? 'text-slate-300' : isLocked ? 'text-white' : 'text-slate-800'
                            }`}>
                              {m}
                            </span>
                            
                            <div className="mt-1.5 transition-transform group-hover:scale-110">
                              {isLocked ? (
                                <svg className="w-3.5 h-3.5 text-current" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className={`w-3.5 h-3.5 ${masterLocked ? 'text-slate-200' : 'text-emerald-500 group-hover:text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 14 14">
                                  <path d="M3.5 6.5V4.5a3.5 3.5 0 117 0V6.5m-7 0a1.5 1.5 0 00-1.5 1.5v3.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V8a1.5 1.5 0 00-1.5-1.5m-7 0h7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className={`text-[7px] font-black uppercase tracking-widest mt-1 ${masterLocked ? 'text-slate-300' : isLocked ? 'text-rose-100' : 'text-slate-400'}`}>
                              {isLocked ? 'Locked' : 'Open'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                  </div>
                );
              })()}

            </div>
          )}

          {!['cloud', 'finance', 'users', 'history', 'benchmarks', 'fiscal_locks'].includes(activeCategory) && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center space-x-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 border-l-4 border-indigo-500 pl-4">{categories.find(c => c.id === activeCategory)?.label} Management</h3>
                  <button 
                    onClick={handleSortAlphabetical}
                    className="p-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-all"
                    title="Sort Alphabetically"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4h13M3 8h9M3 12h5m0 4h11m-11 4h8" strokeWidth="3" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <input 
                    type="text" 
                    placeholder={`New ${activeCategory.toString().slice(0, -1)}...`} 
                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                  <button onClick={handleAdd} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Add</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {(config[activeCategory as keyof MasterConfigState] as string[] || []).map((item, index, arr) => (
                  <div key={item} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                    {editingItem === item ? (
                      <input 
                        autoFocus
                        type="text" 
                        className="flex-grow bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black uppercase outline-none"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      />
                    ) : (
                      <span className="text-[11px] font-black uppercase text-slate-700 truncate mr-2">{item}</span>
                    )}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        disabled={index === 0}
                        onClick={() => handleMove(item, 'up')}
                        className={`p-1 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth="4"/></svg>
                      </button>
                      <button 
                        disabled={index === arr.length - 1}
                        onClick={() => handleMove(item, 'down')}
                        className={`p-1 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-20`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="4"/></svg>
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>
                      <button onClick={() => handleStartEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="3"/></svg></button>
                      <button onClick={() => handleRemove(item)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" strokeWidth="3"/></svg></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="p-8 space-y-6">
              <div className="flex items-center space-x-4">
                <div className="bg-amber-100 text-amber-600 p-3 rounded-2xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">{confirmModal.title}</h3>
              </div>
              <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase">{confirmModal.message}</p>
              <div className="flex items-center space-x-3 pt-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification Toast */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[2001] animate-slideUp">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center space-x-3 min-w-[300px] ${
            notification.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' :
            notification.type === 'error' ? 'bg-red-600 border-red-500 text-white' :
            'bg-slate-800 border-slate-700 text-white'
          }`}>
            {notification.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : notification.type === 'error' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
            )}
            <span className="text-[10px] font-black uppercase tracking-widest">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterConfig;
