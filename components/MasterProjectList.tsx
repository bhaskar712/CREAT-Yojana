import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { MasterProject, MasterConfigState, FiscalYear, ProjectStatus } from '../types';
import { Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { MasterProjectModal } from './MasterProjectModal';
import { MultiSelect } from './Filters';

export interface MasterProjectListProps {
  projects: MasterProject[];
  allMasterProjects?: MasterProject[];
  onSave: (p: MasterProject) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  config: MasterConfigState;
  verticals: string[];
  currentFY?: string;
}

export const MasterProjectList: React.FC<MasterProjectListProps> = ({ projects, allMasterProjects, onSave, onDelete, onDeleteAll, config, verticals, currentFY }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<MasterProject | undefined>();
  const [filters, setFilters] = useState({ domain: ['All'], vertical: ['All'], family: ['All'], status: ['All'], search: '' });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (filters.domain.includes('All') || filters.domain.includes(p.buDomain)) &&
      (filters.vertical.includes('All') || filters.vertical.includes(p.vertical)) &&
      (filters.family.includes('All') || filters.family.includes(p.productFamily)) &&
      (filters.status.includes('All') || filters.status.includes(p.status)) &&
      (filters.search === '' || p.name.toLowerCase().includes(filters.search.toLowerCase()) || p.code.toLowerCase().includes(filters.search.toLowerCase()))
    );
  }, [projects, filters]);

  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredProjects]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(sortedProjects.map((p, index) => ({
        '#': index + 1,
        Code: p.code,
        Name: p.name,
        'Product Family': p.productFamily,
        Domain: p.buDomain,
        Vertical: p.vertical,
        Type: p.projectType,
        Status: p.status,
        PACE: p.pace,
        'Start Date': p.startDate,
        FYs: p.applicableFYs.join('|')
    })));
    
    // Enable filtering
    ws['!autofilter'] = { ref: ws['!ref'] as string };
    
    // Set column widths
    ws['!cols'] = [
        { wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
        { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Projects");
    XLSX.writeFile(wb, "Master Project List.xlsx");
  };

  const [importStats, setImportStats] = useState<{ new: number, updates: number, total: number } | null>(null);
  const [parsedProjects, setParsedProjects] = useState<MasterProject[]>([]);

  const handleImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const xrefSource = allMasterProjects || projects;
        const existingCodeXref = new Map(xrefSource.map(p => [p.code, p.id]));
        
        let newCount = 0;
        let updateCount = 0;
        let duplicateInFileCount = 0;
        const seenInFile = new Set<string>();

        const newProjects: MasterProject[] = json.map(row => {
            const code = String(row.Code || row.CODE || row.code || '');
            let id = existingCodeXref.get(code);
            
            const isExistingInSource = xrefSource.some(p => p.code === code);
            const isFirstOccurrenceInFile = code && !seenInFile.has(code);
            if (code) seenInFile.add(code);

            if (id) {
                if (isExistingInSource) {
                    if (isFirstOccurrenceInFile) updateCount++;
                } else if (code) {
                    duplicateInFileCount++;
                }
            } else {
                id = Math.random().toString();
                existingCodeXref.set(code, id);
                if (code) {
                    if (isFirstOccurrenceInFile) newCount++; // Only count if code is present
                }
            }

            const parsedFYs = String(row.FYs || row.FYS || row.fys || row['Applicable FYs'] || row['APPLICABLE FYS'] || '')
              .split(/[|,]/)
              .map(fy => fy.trim())
              .filter(fy => fy !== '') as FiscalYear[];
            
            if (currentFY && currentFY !== 'All FY' && !parsedFYs.includes(currentFY as FiscalYear)) {
                parsedFYs.push(currentFY as FiscalYear);
            }

            return {
                id,
                code,
                name: String(row.Name || row.NAME || row.name || ''),
            productFamily: String(row['Product Family'] || row['PRODUCT FAMILY'] || row['Family'] || row['Product_Family'] || 'NA'),
            buDomain: String(row.Domain || row.DOMAIN || row.domain || 'ACS'),
            vertical: String(row.Vertical || row.VERTICAL || row.vertical || ''),
            projectType: String(row.Type || row.TYPE || row.type || 'NA'),
            status: (String(row.Status || row.STATUS || row.status || '-') as ProjectStatus),
            pace: String(row.PACE || row.Pace || row.pace || 'NA'),
            startDate: String(row['Start Date'] || row['START DATE'] || row['Start_Date'] || ''),
            category: 'New',
            businessUnit: 'NA',
            applicableFYs: parsedFYs
            };
        });
        
        // deduplicate newProjects by code, taking the last occurrence
        const deduplicatedProjects = Array.from(
          new Map(newProjects.filter(p => p.code).map(p => [p.code, p])).values()
        );
        
        setParsedProjects(deduplicatedProjects);
        setImportStats({ new: newCount, updates: updateCount, total: deduplicatedProjects.length });
        setImportModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input to allow re-selection
  };

  const executeImport = () => {
    parsedProjects.forEach(p => p.code && onSave(p));
    setImportModalOpen(false);
    setImportFile(null);
    setParsedProjects([]);
    setImportStats(null);
  };

  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);

  const resetFilters = () => setFilters({ search: '', vertical: ['All'], domain: ['All'], family: ['All'], status: ['All'] });

  return (
    <div className="space-y-6 relative">
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setImportModalOpen(false); setImportFile(null); }}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-2 relative z-10 flex items-center justify-center gap-3">
                <Upload size={28} className="opacity-90" /> Data Import
              </h2>
              <p className="text-indigo-100/90 text-sm font-medium relative z-10 text-center">
                Review and confirm data migration
              </p>
            </div>
            <div className="p-8 pb-10">
              <div className="bg-indigo-50/50 rounded-2xl p-6 border text-center border-indigo-100/50 mb-8">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">CONFIRM IMPORT</h3>
                {importStats ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-bold text-slate-500 uppercase">File: {importFile?.name}</p>
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100/50">
                        <div className="text-2xl font-black text-indigo-600">{importStats.new}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">New</div>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100/50">
                        <div className="text-2xl font-black text-indigo-600">{importStats.updates}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Updates</div>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100/50">
                        <div className="text-2xl font-black text-slate-600">{importStats.total}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-500 mt-2 leading-relaxed uppercase">Importing {importFile?.name} will overwrite matched existing projects. Proceed?</p>
                )}
              </div>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={() => { setImportModalOpen(false); setImportFile(null); setParsedProjects([]); setImportStats(null); }}
                  className="flex-1 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all border-2 border-transparent hover:border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeImport}
                  className="flex-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Proceed with Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteAllModalOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-2 relative z-10 flex items-center justify-center gap-3">
                <Trash2 size={28} className="opacity-90" /> Delete All Data
              </h2>
              <p className="text-rose-100/90 text-sm font-medium relative z-10 text-center">
                Review and confirm deletion
              </p>
            </div>
            <div className="p-8 pb-10">
              <div className="bg-rose-50/50 rounded-2xl p-6 border text-center border-rose-100/50 mb-8">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">CONFIRM DELETION</h3>
                <p className="text-sm font-bold text-slate-500 mt-2 leading-relaxed uppercase">Are you sure you want to delete all projects? This action cannot be undone.</p>
              </div>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={() => setDeleteAllModalOpen(false)}
                  className="flex-1 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all border-2 border-transparent hover:border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { onDeleteAll(); setDeleteAllModalOpen(false); }}
                  className="flex-2 bg-rose-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all"
                >
                  Confirm Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 p-2 rounded-2xl space-y-2 shadow-xs">
        <div className="flex flex-wrap items-end gap-1">
          <MultiSelect label="DOMAIN" selected={filters.domain} options={config.buDomains} onChange={v => setFilters({...filters, domain: v})} />
          <MultiSelect label="VERTICAL" selected={filters.vertical} options={verticals} onChange={v => setFilters({...filters, vertical: v})} />
          <MultiSelect label="FAMILY" selected={filters.family} options={config.productFamilies} onChange={v => setFilters({...filters, family: v})} />
          <MultiSelect label="STATUS" selected={filters.status} options={config.pfsStatuses || ['Active', 'Closed', '-']} onChange={v => setFilters({...filters, status: v})} />
          
          <button 
            onClick={resetFilters} 
            className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 h-6 rounded-md text-[7px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-xs shrink-0 self-end ml-auto"
          >
            RESET
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-grow w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3.5"/>
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="QUICK SEARCH..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner h-10"
              value={filters.search} 
              onChange={e => setFilters({ ...filters, search: e.target.value })} 
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => {setEditingProject(undefined); setModalOpen(true);}} className="h-10 px-6 bg-indigo-600 text-white rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus size={14} /> <span>New</span>
            </button>
            <label className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50">
              <Upload size={14} /> <span>Import</span>
              <input type="file" onChange={handleImportSelect} className="hidden" accept=".xlsx,.xls" />
            </label>
            <button onClick={handleExport} disabled={projects.length === 0} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={14} /> <span>Export</span>
            </button>
            <button onClick={() => setDeleteAllModalOpen(true)} disabled={projects.length === 0} className="h-10 px-4 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-100 transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 size={14} /> <span>Delete All</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-left text-[10px] text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-bold uppercase tracking-wider w-12">#</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider w-24">Code</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Product Family</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Domain</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Vertical</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">PACE</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Start Date</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">FYs</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedProjects.map((p, index) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 font-mono">{index + 1}</td>
                <td className="px-4 py-2 font-mono font-semibold">{p.code}</td>
                <td className="px-4 py-2 font-bold">{p.name}</td>
                <td className="px-4 py-2">{p.productFamily}</td>
                <td className="px-4 py-2">{p.buDomain}</td>
                <td className="px-4 py-2">{p.vertical}</td>
                <td className="px-4 py-2">{p.projectType}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.pace}</td>
                <td className="px-4 py-2">{p.startDate || '-'}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2" title={p.applicableFYs.join(', ')}>
                  {(() => {
                      if (!p.applicableFYs || p.applicableFYs.length === 0) return <span className="text-slate-400">-</span>;
                      const sorted = [...p.applicableFYs].sort((a, b) => b.localeCompare(a));
                      return (
                          <>
                              <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-indigo-200/60 shadow-sm">{sorted[0]}</span>
                              {sorted.length > 1 && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">+{sorted.length - 1} prior</span>}
                          </>
                      )
                  })()}
                  </div>
                </td>
                <td className="px-4 py-2 flex justify-center gap-2">
                  <button onClick={() => {setEditingProject(p); setModalOpen(true);}} className="text-indigo-600 hover:text-indigo-800"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(p.id)} className="text-rose-600 hover:text-rose-800"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MasterProjectModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={(p: MasterProject) => { onSave({...p, id: p.id || Math.random().toString()}); setModalOpen(false); }}
        config={config}
        allowedVerticals={verticals}
        project={editingProject}
      />
    </div>
  );
};

