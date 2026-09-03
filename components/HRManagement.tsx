import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { toBlob } from 'html-to-image';
import { Employee, ProjectData, RESOURCE_SKILLS, MANPOWER_CATEGORIES, MasterConfigState, generateUUID } from '../types';
import { processResourceImport, exportResourceRegistry } from '../services/exportService';
import { ResourcesDashboard } from './ResourcesDashboard';
import { normalizeSkill, normalizeVertical, normalizeDepartment } from '../constants';

interface HRManagementProps {
  employees: Employee[];
  projects: ProjectData[];
  config: MasterConfigState;
  onUpdateEmployees: (employees: Employee[]) => void;
  onDeleteEmployee: (id: string, name: string) => void;
  onDeleteAll?: () => void;
  isAdmin?: boolean;
  zoom: number;
  setZoom: (z: number) => void;
  layout: 'horizontal' | 'columnar';
  setLayout: (l: 'horizontal' | 'columnar') => void;
  collapsedNodes: Set<string>;
  setCollapsedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewMode: 'tabular' | 'graphical' | 'matrix' | 'dashboard';
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
  selectedFY?: any;
  syncConfig?: any;
}

const copyStyledToClipboard = async (html: string, plain: string) => {
  try {
    const blobHtml = new Blob([html], { type: 'text/html' });
    const blobText = new Blob([plain], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
    await navigator.clipboard.write(data);
    alert("Table copied to clipboard.");
  } catch (err) {
    console.error("Clipboard Error:", err);
    await navigator.clipboard.writeText(plain);
    alert("Copied as plain TSV.");
  }
};

const copyTsvToClipboard = async (plain: string) => {
  await navigator.clipboard.writeText(plain);
  alert("TSV copied to clipboard.");
};

const SortIndicator = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => {
  if (!active) return <span className="ml-1 opacity-20 text-[8px]">↕</span>;
  return <span className="ml-1 text-indigo-400 font-black text-[9px] group-hover:text-indigo-600 transition-colors">{direction === 'asc' ? '↑' : '↓'}</span>;
};

const ResourceImportInspectionModal = ({ isOpen, data, onClose, onConfirm }: { 
  isOpen: boolean, 
  data: any, 
  onClose: () => void, 
  onConfirm: () => void 
}) => {
  if (!isOpen || !data) return null;
  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
        <div className="bg-indigo-600 p-8 text-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Resources Inspection</h3>
              <p className="text-[10px] font-black opacity-70 uppercase mt-1 tracking-widest">Validating Resource Payload</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg>
            </button>
          </div>
          <div className="flex wrap gap-4 mt-6">
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10"><span className="text-[8px] font-black uppercase opacity-60 block">Total Entries</span><span className="text-xl font-black none">{data.summary.total}</span></div>
            <div className="bg-emerald-50/20 px-4 py-2 rounded-xl border border-emerald-500/20"><span className="text-[8px] font-black uppercase opacity-60 block">Valid New</span><span className="text-xl font-black none">{data.summary.valid}</span></div>
            <div className="bg-blue-50/20 px-4 py-2 rounded-xl border border-blue-500/20"><span className="text-[8px] font-black uppercase opacity-60 block">Updates</span><span className="text-xl font-black none">{data.summary.updates}</span></div>
            <div className="bg-red-50/20 px-4 py-2 rounded-xl border border-red-500/20"><span className="text-[8px] font-black uppercase opacity-60 block">Errors</span><span className="text-xl font-black none">{data.summary.errors}</span></div>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-6 no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Emp ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">Validation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data.resources || []).map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors h-12">
                  <td className="px-4 py-2"><span className={`px-2 py-1 rounded text-[7px] font-black uppercase ${r.importStatus === 'valid' ? 'bg-emerald-50 text-emerald-600' : r.importStatus === 'update' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{r.importStatus}</span></td>
                  <td className="px-4 py-2 font-mono text-[10px] font-bold text-slate-600">{r.empId}</td>
                  <td className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase truncate max-w-[200px]">{r.name}</td>
                  <td className="px-4 py-2 text-[10px] font-bold text-slate-500">{r.vertical}</td>
                  <td className="px-4 py-2">{(r.errors || []).length > 0 ? (<div className="text-[8px] text-red-500 font-bold uppercase depth-tight">{(r.errors || []).map((e: string, i: number) => <div key={i}>• {e}</div>)}</div>) : (<span className="text-[8px] text-slate-300 font-black uppercase">Protocol Compliant</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <button onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700">Abort Import</button>
          <button onClick={onConfirm} disabled={data.summary.valid === 0 && data.summary.updates === 0} className="bg-indigo-600 text-white px-12 py-4 rounded-2xl w-full sm:w-auto text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Finalize & Commit Resource Changes</button>
        </div>
      </div>
    </div>
  );
};

const HRMultiSelect: React.FC<{ label: string; options: string[]; selected: string[]; onChange: (vals: string[]) => void }> = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { 
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (opt: string) => {
    if (opt === 'All') {
      return onChange(['All']);
    }
    let next = selected.includes('All') ? [] : [...selected];
    if (next.includes(opt)) {
      next = next.filter(o => o !== opt);
    } else {
      next.push(opt);
    }
    if (next.length === 0) next = ['All'];
    onChange(next);
  };

  const filteredOptions = useMemo(() => {
    const opts = options.filter(o => o !== 'All'); 
    if (!searchTerm.trim()) return opts;
    return opts.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  const isAllSelected = selected.includes('All');
  const display = isAllSelected ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`;
  
  return (
    <div className="relative flex-grow min-w-[100px]" ref={containerRef}>
      <label className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-1 block pl-2">{label}</label>
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full bg-white border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-slate-200'} rounded-xl px-3 py-1 text-[9px] font-black uppercase shadow-xs flex items-center justify-between transition-all h-7 truncate`}>
        <span className={selected.includes('All') ? 'text-slate-400' : 'text-indigo-600'}>{display}</span>
        <svg className={`w-2.5 h-2.5 ml-2 transition-transform ${isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[180px] bg-white border border-slate-200 rounded-2xl shadow-xl z-[300] overflow-hidden animate-fadeIn py-2">
          <div className="px-3 py-2 border-b border-slate-50 mb-1">
            <input 
              autoFocus
              type="text" 
              placeholder="Search..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto no-scrollbar py-1">
            <label className={`flex items-center px-4 py-2 hover:bg-indigo-50 cursor-pointer group ${isAllSelected ? 'bg-indigo-50/40' : ''}`} onClick={(e) => { e.stopPropagation(); toggle('All'); }}>
              <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${isAllSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                {isAllSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className={`ml-2.5 text-[9px] font-black uppercase tracking-tight truncate ${isAllSelected ? 'text-indigo-700' : 'text-slate-600'}`}>All</span>
            </label>
            {filteredOptions.map(opt => {
              const isSelected = selected.includes(opt);
              return (
                <label key={opt} className={`flex items-center px-4 py-2 hover:bg-indigo-50 cursor-pointer group ${isSelected ? 'bg-indigo-50/40' : ''}`} onClick={(e) => { e.stopPropagation(); toggle(opt); }}>
                  <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                    {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`ml-2.5 text-[9px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>{opt}</span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && searchTerm && (
              <div className="px-4 py-4 text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryBox = ({ value, label, type = 'dark' }: { value: number, label: string, type?: 'dark' | 'orange' | 'indigo' | 'emerald', children?: React.ReactNode }) => {
  const styles = { dark: 'bg-slate-900/30 border-slate-800/40 text-white/90', orange: 'bg-orange-950/10 border-orange-900/20 text-orange-400/80', indigo: 'bg-indigo-950/10 border-indigo-900/20 text-indigo-400/80', emerald: 'bg-emerald-950/10 border-emerald-900/20 text-emerald-400/80' };
  const styleKey = (type || 'dark') as keyof typeof styles;
  return (
    <div className={`flex flex-col items-center justify-center px-5 py-2 rounded-2xl border ${styles[styleKey]} min-w-[100px] shadow-sm transition-all hover:bg-opacity-50`}>
      <span className="text-2xl font-black leading-none tracking-tight">{value}</span>
      <span className="text-[7px] font-bold uppercase tracking-[0.1em] opacity-40 mt-1">{label}</span>
    </div>
  );
};

const Operator = ({ children }: { children?: React.ReactNode }) => (<span className="textxl font-black text-slate-800 opacity-20 px-1">{children}</span>);

const ResourceMatrixView = React.forwardRef<HTMLDivElement, { employees: Employee[], verticals: string[], config: MasterConfigState }>(({ employees, verticals, config }, ref) => {
  const isIntern = (e: Employee) => e.category?.toUpperCase().includes('INTERN');
  const isConsultant = (e: Employee) => e.category?.toLowerCase().includes('consultant');
  const baseEmployees = useMemo(() => employees.filter(e => !isIntern(e)), [employees]);
  const internEmployees = useMemo(() => employees.filter(e => isIntern(e)), [employees]);
  const coreInternal = useMemo(() => employees.filter(e => !isIntern(e) && !isConsultant(e) && MANPOWER_CATEGORIES.includes(normalizeSkill(e.skill))).length, [employees]);
  const coreConsultants = useMemo(() => employees.filter(e => !isIntern(e) && isConsultant(e) && MANPOWER_CATEGORIES.includes(normalizeSkill(e.skill))).length, [employees]);
  const coreTotal = coreInternal + coreConsultants;
  const supportInternal = useMemo(() => employees.filter(e => !isIntern(e) && !isConsultant(e) && !MANPOWER_CATEGORIES.includes(normalizeSkill(e.skill))).length, [employees]);
  const supportConsultants = useMemo(() => employees.filter(e => !isIntern(e) && isConsultant(e) && !MANPOWER_CATEGORIES.includes(normalizeSkill(e.skill))).length, [employees]);
  const supportTotal = supportInternal + supportConsultants;
  const aggregateInternal = useMemo(() => employees.filter(e => !isIntern(e) && !isConsultant(e)).length, [employees]);
  const aggregateExternal = useMemo(() => employees.filter(e => !isIntern(e) && isConsultant(e)).length, [employees]);
  const aggregateTotal = aggregateInternal + aggregateExternal;
  const internTotal = useMemo(() => employees.filter(isIntern).length, [employees]);
  const grandTotal = employees.length;
  const grandTotalInternal = aggregateInternal + internTotal;
  const grandTotalConsultants = aggregateExternal;

  const getMatrixData = (empList: Employee[]) => {
    const coreSkills = MANPOWER_CATEGORIES;
    const supportSkills = RESOURCE_SKILLS.filter(s => !MANPOWER_CATEGORIES.includes(s));
    const calculateRows = (skills: string[]) => {
      return skills.map(cat => {
        const row: any = { category: cat };
        let rowTotal = 0; let rowConsultants = 0;
        verticals.forEach(v => {
          const cellEmployees = empList.filter(e => {
            const normS = normalizeSkill(e.skill);
            const normV = normalizeVertical(e.vertical);
            return normS === cat && normV === normalizeVertical(v);
          });
          const total = cellEmployees.length;
          const consultants = cellEmployees.filter(isConsultant).length;
          row[v] = { total, consultants };
          rowTotal += total; rowConsultants += consultants;
        });
        row.summary = { total: rowTotal, consultants: rowConsultants };
        return row;
      });
    };
    const coreRows = calculateRows(coreSkills);
    const supportRows = calculateRows(supportSkills);
    const getVerticalTotals = (rows: any[]) => {
      const totals: any = { summary: { total: 0, consultants: 0 } };
      verticals.forEach(v => {
        const total = rows.reduce((sum, r) => sum + r[v].total, 0);
        const consultants = rows.reduce((sum, r) => sum + r[v].consultants, 0);
        totals[v] = { total, consultants };
        totals.summary.total += total; totals.summary.consultants += consultants;
      });
      return totals;
    };
    return { coreRows, supportRows, coreTotals: getVerticalTotals(coreRows), supportTotals: getVerticalTotals(supportRows) };
  };

  const baseMatrix = useMemo(() => getMatrixData(baseEmployees), [baseEmployees, verticals]);
  const internMatrix = useMemo(() => getMatrixData(internEmployees), [internEmployees, verticals]);

  const RenderCell = ({ total, consultants, isHeaderCell = false, isSummary = false }: { total: number, consultants: number, isHeaderCell?: boolean, isSummary?: boolean }) => {
    if (total === 0) return <span className="text-slate-100 text-[10px] font-black opacity-20">0</span>;
    const totalColor = isHeaderCell ? 'text-white' : isSummary ? 'text-indigo-600' : 'text-slate-900';
    const consultantColor = isHeaderCell ? 'text-orange-300' : 'text-orange-500';
    return (
      <div className="flex flex-col items-center leading-none">
        <span className={`${totalColor} font-black text-[11px]`}>{total}</span>
        {consultants > 0 && <span className={`${consultantColor} text-[8px] font-black mt-0.5`}>({consultants})</span>}
      </div>
    );
  };

  const MatrixTable = ({ title, matrixData, themeColor = 'slate' }: any) => {
    const colors = { slate: { header: 'bg-slate-900', agg: 'bg-indigo-50', aggText: 'text-indigo-600' }, emerald: { header: 'bg-emerald-900', agg: 'bg-emerald-50', aggText: 'text-emerald-600' } }[themeColor as 'slate' | 'emerald'] || { header: 'bg-slate-900', agg: 'bg-indigo-50', aggText: 'text-indigo-600' };
    
    const handleExport = (type: 'tsv' | 'styled') => {
        const headers = ['Skill Category', 'Aggregate', ...verticals];
        const rows: any[] = [];
        const fmt = (cell: any) => `${cell.total}${cell.consultants > 0 ? ` (${cell.consultants})` : ''}`;

        if (themeColor === 'slate') {
            matrixData.coreRows.forEach((r: any) => rows.push([r.category, fmt(r.summary), ...verticals.map((v:string) => fmt(r[v]))]));
            // Fix: Use matrixData.coreTotals[v] instead of r[v] as r is out of scope.
            rows.push(['Total Core (A)', fmt(matrixData.coreTotals.summary), ...verticals.map((v:string) => fmt(matrixData.coreTotals[v]))]);
            matrixData.supportRows.forEach((r: any) => rows.push([r.category, fmt(r.summary), ...verticals.map((v:string) => fmt(r[v]))]));
            rows.push(['Total Support (B)', fmt(matrixData.supportTotals.summary), ...verticals.map((v:string) => fmt(matrixData.supportTotals[v]))]);
        } else {
             [...matrixData.coreRows, ...matrixData.supportRows].forEach((r: any) => rows.push([r.category, fmt(r.summary), ...verticals.map((v:string) => fmt(r[v]))]));
            const tInterns = { summary: { total: matrixData.coreTotals.summary.total + matrixData.supportTotals.summary.total, consultants: matrixData.coreTotals.summary.consultants + matrixData.supportTotals.summary.consultants } };
            // Fix: Use matrixData.supportTotals[v] instead of matrixData.supportTotals as it is indexed by vertical.
            const vData = verticals.map((v: string) => fmt({ total: (matrixData.coreTotals[v]?.total || 0) + (matrixData.supportTotals[v]?.total || 0), consultants: (matrixData.coreTotals[v]?.consultants || 0) + (matrixData.supportTotals[v]?.consultants || 0) }));
            rows.push(['Total Interns', fmt(tInterns.summary), ...vData]);
        }

        const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
        if (type === 'tsv') {
            copyTsvToClipboard(tsv);
        } else {
            const html = `<table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;"><thead><tr style="background: #0f172a; color: white;">${headers.map(h => `<th style="padding: 5px;">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c: any) => `<td style="padding: 5px; border: 1px solid #ccc;">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            copyStyledToClipboard(html, tsv);
        }
    };

    return (
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden animate-fadeIn rounded-[1rem] mb-8 last:mb-0">
        <div className={`${colors.header} px-4 py-3 flex justify-between items-center`}>
            <h3 className="text-white text-sm font-black uppercase tracking-tight">{title}</h3>
            <div className="flex space-x-2">
                <button onClick={() => handleExport('tsv')} className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold px-2 py-1 rounded transition-colors uppercase">TSV</button>
                <button onClick={() => handleExport('styled')} className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold px-2 py-1 rounded transition-colors uppercase">Styled</button>
            </div>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-[7px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-3 py-2 border-b border-r border-slate-100 sticky left-0 bg-slate-50 z-20">Skill Category</th>
                <th className={`px-2 py-2 border-b border-r border-slate-100 ${colors.agg} text-center ${colors.aggText}`}>Aggregate</th>
                {verticals.map(v => <th key={v} className="px-2 py-2 border-b border-r border-slate-100 text-center">{v}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[9px] font-black uppercase">
              {themeColor === 'slate' ? (
                <>
                  {matrixData.coreRows.map((row: any) => (<tr key={row.category} className="hover:bg-slate-50 transition-colors h-8"><td className="px-3 py-1 border-r border-slate-100 sticky left-0 bg-white z-10 text-slate-500 truncate max-w-[140px]">{row.category}</td><td className={`px-2 py-1 border-r border-slate-100 ${colors.agg}/20 text-center shadow-inner`}><RenderCell total={row.summary.total} consultants={row.summary.consultants} isSummary /></td>{verticals.map((v: string) => <td key={v} className="px-2 py-1 border-r border-slate-100 text-center"><RenderCell total={row[v].total} consultants={row[v].consultants} /></td>)}</tr>))}
                  <tr className="bg-indigo-100 text-indigo-900 italic font-black h-8 shadow-inner"><td className="px-3 py-1 border-r border-slate-200 sticky left-0 bg-indigo-100 z-10">Total Core (A)</td><td className="px-2 py-1 border-r border-slate-200 text-center bg-indigo-200/40"><RenderCell total={matrixData.coreTotals.summary.total} consultants={matrixData.coreTotals.summary.consultants} isSummary /></td>{verticals.map((v: string) => <td key={v} className="px-2 py-1 border-r border-slate-100 text-center"><RenderCell total={matrixData.coreTotals[v].total} consultants={matrixData.coreTotals[v].consultants} /></td>)}</tr>
                  {matrixData.supportRows.map((row: any) => (<tr key={row.category} className="hover:bg-slate-50 transition-colors h-8"><td className="px-3 py-1 border-r border-slate-100 sticky left-0 bg-white z-10 text-slate-500 truncate max-w-[140px]">{row.category}</td><td className={`px-2 py-1 border-r border-slate-100 ${colors.agg}/20 text-center shadow-inner`}><RenderCell total={row.summary.total} consultants={row.summary.consultants} isSummary /></td>{verticals.map((v: string) => <td key={v} className="px-2 py-1 border-r border-slate-100 text-center"><RenderCell total={row[v].total} consultants={row[v].consultants} /></td>)}</tr>))}
                  <tr className="bg-indigo-100 text-indigo-900 italic font-black h-8 shadow-inner"><td className="px-3 py-1 border-r border-slate-200 sticky left-0 bg-indigo-100 z-10">Total Support (B)</td><td className="px-2 py-1 border-r border-slate-200 text-center bg-indigo-200/40"><RenderCell total={matrixData.supportTotals.summary.total} consultants={matrixData.supportTotals.summary.consultants} isSummary /></td>{verticals.map((v: string) => <td key={v} className="px-2 py-1 border-r border-slate-100 text-center"><RenderCell total={matrixData.supportTotals[v].total} consultants={matrixData.supportTotals[v].consultants} /></td>)}</tr>
                </>
              ) : (
                <>
                  {[...matrixData.coreRows, ...matrixData.supportRows].map((row: any) => (<tr key={row.category} className="hover:bg-slate-50 transition-colors h-8"><td className="px-3 py-1 border-r border-slate-100 sticky left-0 bg-white z-10 text-slate-500 truncate max-w-[140px]">{row.category}</td><td className={`px-2 py-1 border-r border-slate-100 ${colors.agg}/20 text-center shadow-inner`}><RenderCell total={row.summary.total} consultants={row.summary.consultants} isSummary /></td>{verticals.map((v: string) => <td key={v} className="px-2 py-1 border-r border-slate-100 text-center"><RenderCell total={row[v].total} consultants={row[v].consultants} /></td>)}</tr>))}
                  <tr className={`${colors.header} text-white italic h-9`}><td className={`px-3 py-2 sticky left-0 ${colors.header} z-10`}>Total Interns</td><td className="px-2 py-2 text-center bg-white/10"><RenderCell total={matrixData.coreTotals.summary.total + matrixData.supportTotals.summary.total} consultants={matrixData.coreTotals.summary.consultants + matrixData.supportTotals.summary.consultants} isHeaderCell /></td>{verticals.map((v: string) => (<td key={v} className="px-2 py-2 text-center"><RenderCell total={(matrixData.coreTotals[v]?.total || 0) + (matrixData.supportTotals[v]?.total || 0)} consultants={(matrixData.coreTotals[v]?.consultants || 0) + (matrixData.supportTotals[v]?.consultants || 0)} isHeaderCell /></td>))}</tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const LocationMatrixView = () => {
    const locations = config.locations || [];
    const locationData = useMemo(() => { return locations.map(loc => { const row: any = { location: loc }; let rowTotal = 0; let rowConsultants = 0; verticals.forEach(v => { const cellEmployees = baseEmployees.filter(e => e.location === loc && e.vertical === v); const total = cellEmployees.length; const consultants = cellEmployees.filter(isConsultant).length; row[v] = { total, consultants }; rowTotal += total; rowConsultants += consultants; }); row.summary = { total: rowTotal, consultants: rowConsultants }; return row; }).sort((a, b) => b.summary.total - a.summary.total); }, [locations, verticals, baseEmployees]);
    
    const handleExport = (type: 'tsv' | 'styled') => {
        const headers = ['Operating Location', 'Aggregate', ...verticals];
        const fmt = (cell: any) => `${cell.total}${cell.consultants > 0 ? ` (${cell.consultants})` : ''}`;
        const rows = locationData.map((r: any) => [r.location, fmt(r.summary), ...verticals.map((v:string) => fmt(r[v]))]);
        const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
        if (type === 'tsv') {
            copyTsvToClipboard(tsv);
        } else {
            const html = `<table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;"><thead><tr style="background: #0f172a; color: white;">${headers.map(h => `<th style="padding: 5px;">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c: any) => `<td style="padding: 5px; border: 1px solid #ccc;">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            copyStyledToClipboard(html, tsv);
        }
    };

    return (
        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden animate-fadeIn rounded-[1rem] mb-8 last:mb-0">
            <div className="bg-blue-900 px-4 py-3 flex justify-between items-center">
                <h3 className="text-white text-sm font-black uppercase tracking-tight">Location-wise Resource Distribution</h3>
                <div className="flex space-x-2">
                    <button onClick={() => handleExport('tsv')} className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold px-2 py-1 rounded transition-colors uppercase">TSV</button>
                    <button onClick={() => handleExport('styled')} className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold px-2 py-1 rounded transition-colors uppercase">Styled</button>
                </div>
            </div>
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead><tr className="bg-slate-50 text-[7px] font-black text-slate-400 uppercase tracking-widest"><th className="px-3 py-2 border-b border-r border-slate-100 sticky left-0 bg-slate-50 z-20">Operating Location</th><th className="px-2 py-2 border-b border-r border-slate-100 bg-blue-50 text-center text-blue-600">Aggregate</th>{verticals.map(v => <th key={v} className="px-2 py-2 border-b border-r border-slate-100 text-center">{v}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-50 text-[9px] font-black uppercase">{locationData.map((row: any) => (<tr key={row.location} className="hover:bg-slate-50 transition-colors h-8"><td className="px-3 py-1 border-r border-slate-100 sticky left-0 bg-white z-10 text-slate-500">{row.location}</td><td className="px-2 py-1 border-r border-slate-100 bg-blue-50/20 text-center shadow-inner"><RenderCell total={row.summary.total} consultants={row.summary.consultants} isSummary /></td>{verticals.map((v: string) => <td key={v} className="px-2 py-1 border-r border-slate-100 text-center"><RenderCell total={row[v].total} consultants={row[v].consultants} /></td>)}</tr>))}</tbody>
                </table>
            </div>
        </div>
    );
  };

  return (
    <div ref={ref} className="space-y-2">
      <MatrixTable title="Main Resource Matrix (Excl. Interns)" matrixData={baseMatrix} themeColor="slate" />
      <MatrixTable title="Intern Resource Matrix" matrixData={internMatrix} themeColor="emerald" />
      <LocationMatrixView />
      <div className="bg-[#0a0f1a] rounded-[2.5rem] p-10 xl:p-12 text-white flex flex-col xl:flex-row items-center justify-between shadow-2xl mt-12 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/[0.03] rounded-full blur-[100px] -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/[0.02] rounded-full blur-[80px] -ml-32 -mb-32"></div>
        <div className="flex flex-col mb-12 xl:mb-0 relative z-10 text-center xl:text-left shrink-0 max-w-[300px]"><span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2 leading-none">Organizational Intelligence</span><h4 className="text-3xl font-black uppercase tracking-tight text-white leading-[1.0]">CREAT RESOURCE<br/><span className="text-indigo-600 opacity-80">SUMMARY</span></h4><div className="flex items-center space-x-2 mt-6 justify-center xl:justify-start"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60 animate-pulse"></div><span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Real-time Resource Registry</span></div></div>
        <div className="flex flex-col xl:flex-row items-center gap-8 xl:gap-10 relative z-10 w-full xl:w-auto">
          <div className="flex flex-col gap-5 border-l border-white/5 pl-8">
            <div className="flex flex-col items-center xl:items-end"><span className="text-[8px] font-black text-indigo-400/50 uppercase tracking-[0.2em] mb-2 mr-1">Core Staff (R&D)</span><div className="flex items-center gap-2"><SummaryBox value={coreInternal} label="Internal" type="dark" /><Operator>+</Operator><SummaryBox value={coreConsultants} label="External" type="orange" /><Operator>=</Operator><SummaryBox value={coreTotal} label="Core Total" type="indigo" /></div></div>
            {/* Fix: Added missing required 'label' prop to the SummaryBox for Support Total */}
            <div className="flex flex-col items-center xl:items-end"><span className="text-[8px] font-black text-indigo-400/50 uppercase tracking-[0.2em] mb-2 mr-1">Support Functions</span><div className="flex items-center gap-2"><SummaryBox value={supportInternal} label="Internal" type="dark" /><Operator>+</Operator><SummaryBox value={supportConsultants} label="External" type="orange" /><Operator>=</Operator><SummaryBox value={supportTotal} label="Support Total" type="indigo" /></div></div>
            <div className="flex flex-col items-center xl:items-end pt-5 mt-2 border-t border-white/5"><span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-2 mr-1">Consolidated Aggregate</span><div className="flex items-center gap-2"><SummaryBox value={aggregateInternal} label="Internal Sum" type="dark" /><Operator>+</Operator><SummaryBox value={aggregateExternal} label="External Sum" type="orange" /><Operator>=</Operator><SummaryBox value={aggregateTotal} label="Total Base" type="indigo" /></div></div>
          </div>
          <div className="flex flex-col items-center xl:items-end xl:border-l xl:border-white/5 xl:pl-10 h-full justify-center"><span className="text-[8px] font-black text-emerald-400/50 uppercase tracking-[0.2em] mb-3 leading-none">Interns</span><div className="bg-emerald-950/10 border border-emerald-900/20 rounded-3xl p-8 flex flex-col items-center justify-center min-w-[130px]"><span className="text-4xl font-black text-emerald-500/80 leading-none tracking-tight">{internTotal}</span><span className="text-[7px] font-bold text-emerald-900/60 uppercase tracking-widest mt-2">Active Capacity</span></div></div>
          <div className="bg-indigo-600/90 px-12 py-8 rounded-[2.5rem] shadow-xl flex flex-col items-center xl:items-end relative overflow-hidden border border-white/10"><div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50"></div><span className="text-[10px] font-black text-indigo-100/60 uppercase tracking-[0.3em] mb-1 relative z-10">Total Headcount</span><div className="flex items-baseline space-x-2 relative z-10 leading-none"><span className="text-6xl font-black text-white tracking-tighter">{grandTotal}</span></div><div className="flex items-center space-x-2 mt-5 relative z-10 border-t border-white/10 pt-4 w-full justify-end"><span className="text-[9px] font-black text-indigo-100/40 uppercase tracking-tight">{grandTotalInternal} INT</span><div className="w-1 h-1 rounded-full bg-white opacity-10"></div><span className="text-[9px] font-black text-orange-200/60 uppercase tracking-tight">{grandTotalConsultants} CONS</span></div></div>
        </div>
      </div>
    </div>
  );
});

const ModalLabel = ({ children, required }: { children?: React.ReactNode, required?: boolean }) => (
  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">{children} {required && <span className="text-red-500">*</span>}</label>
);
const ModalInput = (props: any) => (<input {...props} className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl px-5 py-4 text-[12px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs placeholder:text-slate-300" />);
const ModalSelect = (props: any) => (<select {...props} className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-5 py-4 text-[12px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs" />);

const OrgNode: React.FC<{ 
  node: any, 
  level?: number, 
  isFirstSibling?: boolean, 
  isLastSibling?: boolean, 
  siblingCount?: number, 
  layout?: 'horizontal' | 'columnar',
  onToggleCollapse: (id: string) => void,
  collapsedNodes: Set<string>
}> = ({ node, level = 0, isFirstSibling = false, isLastSibling = false, siblingCount = 1, layout = 'horizontal', onToggleCollapse, collapsedNodes }) => {
  const [showInfo, setShowInfo] = useState(false);
  const isConsultant = node.category?.toLowerCase().includes('consultant');
  const isSelfCollapsed = collapsedNodes.has(node.treeId);

  const { direct, dotted } = useMemo(() => {
    if (!node.children || node.children.length === 0) return { direct: 0, dotted: 0 };
    const d = node.children.filter((c: any) => !c.isDotted).length;
    const dot = node.children.filter((c: any) => c.isDotted).length;
    return { direct: d, dotted: dot };
  }, [node.children]);
  
  return (
    <div className={`flex flex-col items-center relative ${layout === 'columnar' ? 'w-fit' : ''} ${showInfo ? 'z-[1000]' : 'z-10'}`}>
      {level > 0 && (
        <div className="flex flex-col items-center w-full relative">
          {siblingCount > 1 && layout === 'horizontal' && (
            <div className={`absolute top-0 h-0.5 bg-slate-300 z-0 ${isFirstSibling ? 'left-1/2 right-0' : isLastSibling ? 'left-0 right-1/2' : 'left-0 right-0'}`}></div>
          )}
          <div className="w-0.5 h-8 z-10 bg-slate-300"></div>
        </div>
      )}
      <div className="px-4 flex flex-col items-center relative">
        <div className="relative">
          {/* Main Card Container */}
          <div className={`w-64 bg-white rounded-2xl shadow-md border-2 transition-all group/card overflow-hidden flex flex-col ${node.isVirtual ? 'border-slate-300 border-dashed' : node.isDotted ? 'border-dashed border-slate-400 opacity-80' : isConsultant ? 'border-amber-400 bg-amber-50/5' : 'border-indigo-600'}`}>
            {/* Top Section */}
            <div className={`px-4 py-3 text-center border-b flex flex-col items-center justify-center min-h-[75px] ${node.isVirtual ? 'bg-slate-50' : node.isDotted ? 'bg-slate-50/50' : isConsultant ? 'bg-amber-100/50' : 'bg-indigo-100/50'}`}>
              {!node.isVirtual && <div className={`text-[6px] font-black uppercase tracking-[0.2em] mb-1.5 px-2 py-0.5 rounded-full ${node.isDotted ? 'bg-slate-500 text-white' : isConsultant ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'}`}>{node.isDotted ? 'Dotted (Project)' : isConsultant ? 'Consultant' : 'Employee'}</div>}
              <div className={`text-[10px] font-black uppercase tracking-tight break-words whitespace-normal leading-tight px-1 w-full ${node.isVirtual ? 'text-slate-500' : node.isDotted ? 'text-slate-600' : isConsultant ? 'text-amber-900' : 'text-indigo-900'}`}>{node.name}</div>
            </div>
            {/* Bottom Section */}
            <div className="px-4 py-3 text-center space-y-1 bg-white flex-grow flex flex-col justify-center">
              {node.productFamily && node.productFamily !== 'NA' && <div className="text-[8px] font-black uppercase text-indigo-600 border-b border-slate-50 pb-1 mb-1">{node.productFamily}</div>}
              <div className="text-[9px] font-bold text-slate-700 leading-tight uppercase break-words">{node.skill || 'Talent Pool'}</div>
            </div>
          </div>

          {/* Info Trigger - Outside overflow-hidden card */}
          <div className="absolute top-2 right-2 z-[60]">
            <button 
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm text-slate-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
            </button>
          </div>

          {/* Popover - Outside overflow-hidden card */}
          {showInfo && (
            <div className="absolute top-0 left-full ml-4 w-64 bg-slate-900 text-white p-5 rounded-[1.5rem] shadow-2xl z-[1000] animate-fadeIn text-left border border-white/10 backdrop-blur-xl ring-1 ring-white/20">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">Reporting Structure</span>
                  <div className="flex space-x-3">
                    <div className="flex flex-col items-center"><span className="text-sm font-black text-indigo-400 leading-none">{direct}</span><span className="text-[7px] font-black uppercase opacity-50 mt-1">Direct</span></div>
                    <div className="flex flex-col items-center"><span className="text-sm font-black text-emerald-400 leading-none">{dotted}</span><span className="text-[7px] font-black uppercase opacity-50 mt-1">Dotted</span></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Product Family</span>
                  <span className="text-[11px] font-black text-white uppercase leading-tight block bg-white/5 p-2 rounded-lg border border-white/5">{node.productFamily || 'NA'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Allocated Project</span>
                  <span className="text-[11px] font-black text-emerald-400 uppercase leading-tight block bg-emerald-400/5 p-2 rounded-lg border border-emerald-400/10">{node.projectLabel || 'Unallocated'}</span>
                </div>
              </div>
              {/* Arrow pointer */}
              <div className="absolute top-3 -left-1.5 w-3 h-3 bg-slate-900 rotate-45 border-l border-b border-white/10"></div>
            </div>
          )}
        </div>
        {node.children?.length > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.treeId); }} 
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shadow-lg z-50 bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              {isSelfCollapsed ? <path d="M12 4v16m8-8H4" /> : <path d="M20 12H4" />}
            </svg>
          </button>
        )}
      </div>
      {node.children?.length > 0 && !isSelfCollapsed && (
        <div className="flex flex-col items-center w-full animate-fadeIn relative z-10">
          <div className="w-0.5 h-12 bg-slate-300"></div>
          {layout === 'columnar' ? (
            <div className="flex flex-wrap justify-center gap-12 px-8 py-8 w-full border-2 border-slate-100 bg-slate-50/10 rounded-2xl shadow-inner relative items-start">
              {node.children.map((child: any) => (
                <OrgNode 
                  key={child.treeId} 
                  node={child} 
                  level={level + 1} 
                  layout={layout} 
                  onToggleCollapse={onToggleCollapse} 
                  collapsedNodes={collapsedNodes} 
                />
              ))}
            </div>
          ) : (
            <div className="flex items-start min-w-max px-24">
              {node.children.map((child: any, idx: number) => (
                <OrgNode 
                  key={child.treeId} 
                  node={child} 
                  level={level + 1} 
                  isFirstSibling={idx === 0} 
                  isLastSibling={idx === node.children.length - 1} 
                  siblingCount={node.children.length} 
                  layout={layout} 
                  onToggleCollapse={onToggleCollapse} 
                  collapsedNodes={collapsedNodes}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HRManagement: React.FC<HRManagementProps> = ({ 
  employees, 
  projects, 
  config, 
  onUpdateEmployees, 
  onDeleteEmployee, 
  onDeleteAll, 
  isAdmin, 
  zoom, 
  setZoom, 
  layout, 
  setLayout, 
  collapsedNodes, 
  setCollapsedNodes, 
  viewMode, 
  notify,
  selectedFY,
  syncConfig
}) => {
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee, direction: 'asc' | 'desc' } | null>({ key: 'empId', direction: 'asc' });
  const [seatData, setSeatData] = useState<any[]>([]);
  

// ADDING SERVER FETCH FUNCTION
const fetchSeatsFromServer = async () => {
  try {
    const syncKey = syncConfig?.key || localStorage.getItem('sync_key') || '';
    const response = await fetch('/api/seats', {
      headers: {
        'x-sync-key': syncKey
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch seats');
    const seats = await response.json();
    console.log("Server Seats:", seats);
    setSeatData(seats);
  } catch (error) {
    console.warn("Could not fetch seats from server, using local state only:", error);
  }
};
  const [isImportInspectionOpen, setIsImportInspectionOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isLayoutChanging, setIsLayoutChanging] = useState(false);
  const [isSeatPickerOpen, setIsSeatPickerOpen] = useState(false);
  const [hrFilters, setHrFilters] = useState({ vertical: ['All'], functionalTeam: ['All'], location: ['All'], category: ['All'], band: ['All'], skill: ['All'], skillLevel2: ['All'], prm: ['All'], frm: ['All'], family: ['All'], project: ['All'], status: ['Active'], allocation: ['All'] });

  // Panning State
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!viewportRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - viewportRef.current.offsetLeft);
    setStartY(e.pageY - viewportRef.current.offsetTop);
    setScrollLeft(viewportRef.current.scrollLeft);
    setScrollTop(viewportRef.current.scrollTop);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !viewportRef.current) return;
    e.preventDefault();
    const x = e.pageX - viewportRef.current.offsetLeft;
    const y = e.pageY - viewportRef.current.offsetTop;
    const walkX = (x - startX) * 1.5; // Scroll speed
    const walkY = (y - startY) * 1.5;
    viewportRef.current.scrollLeft = scrollLeft - walkX;
    viewportRef.current.scrollTop = scrollTop - walkY;
  };

  const categoryOptions = useMemo(() => {
    const requested = ['Employee - CREAT', 'Employee - ATG', 'Consultant - CREAT', 'Consultant - ATG'];
    const dataCats = employees.map(e => e.category).filter(Boolean);
    const all = Array.from(new Set([...requested, ...dataCats])).sort();
    return all;
  }, [employees]);

  const updateFilter = (key: string, val: string[]) => setHrFilters(prev => ({ ...prev, [key]: val }));
  const resetHrFilters = () => { setHrFilters({ vertical: ['All'], functionalTeam: ['All'], location: ['All'], category: ['All'], band: ['All'], skill: ['All'], skillLevel2: ['All'], prm: ['All'], frm: ['All'], family: ['All'], project: ['All'], status: ['Active'], allocation: ['All'] }); setSearch(""); };
  const findEmployeeNameById = useCallback((id?: any) => { 
    if (!id) return ''; 
    const idStr = typeof id === 'object' ? (id.text || id.result || String(id)) : String(id);
    if (idStr === "[object Object]") return "";
    const norm = idStr.trim().toLowerCase(); 
    let found = employees.find(e => (e.empId || '').trim().toLowerCase() === norm); 
    if (!found) found = employees.find(e => (e.name || '').trim().toLowerCase() === norm); 
    return found ? found.name : idStr; 
  }, [employees]);

  const calculateExperienceBracket = useCallback((doj?: string) => {
    if (!doj || doj === 'NA' || doj === '') return 'NA';
    try {
      const joiningDate = new Date(doj);
      if (isNaN(joiningDate.getTime())) {
        // Try parsing manually if browser Date fails
        const parts = doj.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          const d = parseInt(parts[2]);
          const manualDate = new Date(y, m, d);
          if (!isNaN(manualDate.getTime())) return calculateInternalBracket(manualDate);
        }
        return 'NA';
      }
      return calculateInternalBracket(joiningDate);
    } catch {
      return 'NA';
    }

    function calculateInternalBracket(date: Date) {
      const today = new Date();
      let years = today.getFullYear() - date.getFullYear();
      const m = today.getMonth() - date.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
        years--;
      }

      if (years > 20) return '> 20';
      if (years >= 15) return '15 - 20';
      if (years >= 10) return '10 - 15';
      if (years >= 5) return '5 - 10';
      if (years >= 2) return '2 - 5';
      return '0 - 2';
    }
  }, []);

  const getEmployeeAllocations = useCallback((email?: string, manualId?: string) => {
    const allocations: {code: string, label: string}[] = [];
    const searchEmail = email?.toLowerCase();
    
    if (manualId) {
      const p = projects.find(proj => proj.id === manualId);
      if (p) allocations.push({code: String(p.code), label: `${p.code}: ${p.name}`});
    }
    
    if (searchEmail) {
        projects.forEach(p => {
           const isAllocated = Object.values(p.employeeSkills || {}).some(skillMap => 
              Object.keys(skillMap || {}).some(e => e.toLowerCase() === searchEmail)
           );
           if (isAllocated && !allocations.some(a => a.code === String(p.code))) {
              allocations.push({code: String(p.code), label: `${p.code}: ${p.name}`});
           }
        });
    }
    
    return allocations;
  }, [projects]);

  const calculateCurrentAllocation = useCallback((email?: string, id?: string, allocatedProjId?: string) => {
    if (!email && !id && !allocatedProjId) return 0;
    if (allocatedProjId) return 100;
    const searchEmail = email?.toLowerCase();
    const searchId = id?.toLowerCase();
    let totalAllocation = 0;
    
    // Determine the month indices subset
    let fyStartYear = 2019;
    let yearLimit = 1;
    if (selectedFY && selectedFY !== 'All FY') {
      const parts = selectedFY.split(' ');
      if (parts.length > 1) {
        const yearPart = parts[1].split('-')[0];
        fyStartYear = parseInt(yearPart) + 2000;
        yearLimit = 12;
      }
    } else {
      fyStartYear = 2025; // fallback
      yearLimit = 12;
    }
    const yearOffset = (fyStartYear - 2019) * 12;
    const monthIndices = Array.from({length: yearLimit}, (_, i) => yearOffset + i);
    
    // If selectedFY is 'All FY', fallback to average over the entire 144
    if (selectedFY === 'All FY') {
        monthIndices.length = 144;
        for (let i=0; i<144; i++) monthIndices[i] = i;
    }
    
    projects.forEach(p => {
       if (p.id === allocatedProjId) {
          totalAllocation += 1;
       }
       Object.values(p.employeeSkills || {}).forEach(skillMap => {
          // Robustly find the key, akin to getEmployeeAllocations
          const matchingEmailKey = Object.keys(skillMap || {}).find(e => 
             (searchEmail && e.toLowerCase() === searchEmail) || 
             (searchId && e.toLowerCase() === searchId)
          );
          
          if (matchingEmailKey) {
             const empAllocations = skillMap[matchingEmailKey] as number[];
             if (empAllocations) {
                 const fyAllocs = monthIndices.map(idx => empAllocations[idx] || 0);
                 const sum = fyAllocs.reduce((a, b) => a + b, 0);
                 totalAllocation += (sum / fyAllocs.length);
             }
          }
       });
    });

    const empRecord = employees.find(e => (searchEmail && e.email?.toLowerCase() === searchEmail) || (searchId && e.id?.toLowerCase() === searchId));
    if (totalAllocation === 0 && empRecord?.allocatedProjectId) {
      return 100;
    }

    return Math.round(totalAllocation * 100);
  }, [projects, selectedFY, employees]);

  const findProjectLabelById = useCallback((id?: string) => { if (!id) return 'Unallocated'; const p = projects.find(proj => proj.id === id); return p ? `${p.code}: ${p.name}` : id; }, [projects]);
  const filterOptions = useMemo(() => ({ 
    prm: Array.from(new Set(employees.filter(e => e.prmId).map(e => findEmployeeNameById(e.prmId)))).sort(), 
    frm: Array.from(new Set(employees.filter(e => e.frmId).map(e => findEmployeeNameById(e.frmId)))).sort(), 
    family: config?.productFamilies || [], 
    skillLevel2: config?.skillLevelsL2 || [], 
    project: Array.from(new Set([
      ...employees.filter(e => e.allocatedProjectId).map(e => findProjectLabelById(e.allocatedProjectId)),
      ...projects.map(p => `${p.code}: ${p.name}`)
    ])).sort(),
    allocation: ['0%', '1-50%', '51-99%', '100%', '>100%']
  }), [employees, projects, config, findEmployeeNameById, findProjectLabelById]);

  const handleSort = (key: keyof Employee) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  useEffect(() => {
    fetchSeatsFromServer();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'seatUpdated' || e.key === 'employeeDataUpdated' || e.key === 'sync_key') {
        fetchSeatsFromServer();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [employees]);
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SEAT_SELECTED') {
        console.log("HRManagement received SEAT_SELECTED message:", event.data);
        const { seatNumber, index } = event.data;
        if (editingEmployee) {
          console.log("Applying seat selection to editingEmployee:", editingEmployee.id || 'New Resource');
          setEditingEmployee(prev => ({ ...prev, seat: seatNumber, seatIndex: index }));
          setIsSeatPickerOpen(false);
          notify(`Seat ${seatNumber} selected and applied.`, "success");
        } else {
          console.warn("Received SEAT_SELECTED but no editingEmployee in state.");
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [editingEmployee]);

  useEffect(() => {
    localStorage.setItem("seatData", JSON.stringify(seatData));
  }, [seatData]);

  const captureSnapshot = useCallback(async () => {
    let target = viewMode === 'tabular' ? listContainerRef.current : viewMode === 'matrix' ? matrixContainerRef.current : viewportRef.current;
    if (!target || isSnapshotting) return;
    setIsSnapshotting(true);
    try {
      const blob = await toBlob(target, { backgroundColor: '#ffffff', pixelRatio: 2.0, cacheBust: true });
      if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert("Snapshot saved to clipboard.");
    } catch { alert("Snapshot failed."); } finally { setIsSnapshotting(false); }
  }, [viewMode, isSnapshotting]);

  const buildHierarchy = useCallback((empList: Employee[]) => {
    if (!empList || empList.length === 0) return [];

    const nodeMap = new Map<string, any>();
    const allEmpsMap = new Map<string, Employee>();
    const nameToId = new Map<string, string>();
    const empIdToId = new Map<string, string>();

    employees.forEach(e => {
      allEmpsMap.set(e.id, e);
      if (e.name) nameToId.set(e.name.trim().toLowerCase(), e.id);
      if (e.empId) empIdToId.set(e.empId.trim().toLowerCase(), e.id);
    });

    const getResolvedId = (ref?: string) => {
      if (!ref || ref.trim() === '') return null;
      if (allEmpsMap.has(ref)) return ref;
      const n = ref.trim().toLowerCase();
      return empIdToId.get(n) || nameToId.get(n) || null;
    };

    empList.forEach(e => {
      nodeMap.set(e.id, { ...e, projectLabel: findProjectLabelById(e.allocatedProjectId), children: [], isVirtual: false, treeId: e.id, isDotted: false });
    });

    const ensurePathToRoot = (emp: Employee, visited = new Set<string>()) => {
      if (visited.has(emp.id)) return;
      visited.add(emp.id);

      const frmId = getResolvedId(emp.frmId);
      const prmId = getResolvedId(emp.prmId);
      
      const targets = new Set<string>();
      if (frmId) targets.add(frmId);
      if (prmId) targets.add(prmId);

      targets.forEach(parentId => {
        if (parentId && parentId !== emp.id) {
           if (!nodeMap.has(parentId)) {
              const parentObj = allEmpsMap.get(parentId);
              let fallbackName = 'UNKNOWN MANAGER';
              if (parentId === frmId) fallbackName = emp.frmId || fallbackName;
              else if (parentId === prmId) fallbackName = emp.prmId || fallbackName;

              nodeMap.set(parentId, { 
                ...(parentObj || { 
                  id: parentId, 
                  empId: 'EXT', 
                  name: fallbackName, 
                  band: 'EX', 
                  category: 'Management Pool',
                  skill: 'Management'
                }), 
                projectLabel: parentObj ? findProjectLabelById(parentObj.allocatedProjectId) : 'NA',
                children: [], 
                isVirtual: true, 
                treeId: parentId,
                isDotted: false 
              });
              if (parentObj) ensurePathToRoot(parentObj, visited);
           }
        }
      });
    };
    empList.forEach(e => ensurePathToRoot(e));

    const roots: any[] = [];
    nodeMap.forEach(node => {
      const frmId = getResolvedId(node.frmId);
      const prmId = getResolvedId(node.prmId);
      
      let isRoot = true;

      // Functional Manager (Solid)
      if (frmId && nodeMap.has(frmId)) {
         const parent = nodeMap.get(frmId);
         if (parent.treeId !== node.treeId) {
           node.isDotted = false;
           if (!parent.children.some((c: any) => c.treeId === node.treeId)) {
              parent.children.push(node);
           }
           isRoot = false;
         }
      }

      // Project Manager (Dotted)
      if (prmId && nodeMap.has(prmId)) {
         if (!frmId || (frmId !== prmId)) {
            const parent = nodeMap.get(prmId);
            if (parent.treeId !== node.treeId) {
               if (!frmId) {
                  node.isDotted = true;
                  if (!parent.children.some((c: any) => c.treeId === node.treeId)) {
                     parent.children.push(node);
                  }
                  isRoot = false;
               } else {
                  const dottedNode = {
                     ...node,
                     treeId: `${node.id}-dotted`,
                     isDotted: true,
                     children: [] 
                  };
                  if (!parent.children.some((c: any) => c.treeId === dottedNode.treeId)) {
                     parent.children.push(dottedNode);
                  }
               }
            }
         }
      }

      if (isRoot) {
         roots.push(node);
      }
    });

    if (roots.length === 0 && nodeMap.size > 0) {
        roots.push(nodeMap.values().next().value);
    }

    return roots;
  }, [employees]);

  const filteredEmployeesList = useMemo(() => {
    const s = search.toLowerCase().trim();
    let result = employees.filter(e => {
      // Apply status filter
      const eStatus = e.status || 'Active';
      if (!hrFilters.status.includes('All') && !hrFilters.status.includes(eStatus)) return false;
      
      const allocations = getEmployeeAllocations(e.email, e.allocatedProjectId);
      const prmName = findEmployeeNameById(e.prmId);
      const frmName = findEmployeeNameById(e.frmId);
      const alloc = calculateCurrentAllocation(e.email, e.id);

      const isMatchAllocation = (val: number, filter: string[]) => {
        if (filter.includes('All')) return true;
        if (val === 0 && filter.includes('0%')) return true;
        if (val > 0 && val <= 50 && filter.includes('1-50%')) return true;
        if (val > 50 && val < 100 && filter.includes('51-99%')) return true;
        if (val === 100 && filter.includes('100%')) return true;
        if (val > 100 && filter.includes('>100%')) return true;
        return false;
      };

      return (!s || e.name.toLowerCase().includes(s) || (e.empId || '').toLowerCase().includes(s)) && 
             (hrFilters.vertical.includes('All') || hrFilters.vertical.includes(e.vertical)) && 
             (hrFilters.functionalTeam.includes('All') || hrFilters.functionalTeam.includes(e.functionalTeam || 'NA')) && 
             (hrFilters.location.includes('All') || hrFilters.location.includes(e.location)) && 
             (hrFilters.category.includes('All') || 
              hrFilters.category.some(cat => {
                const vert = (e.vertical || '').trim().toUpperCase();
                const categ = (e.category || '').trim().toUpperCase();
                const isATG = vert === 'ATG' || categ.includes('ATG');
                const isConsultant = categ.includes('CONSULTANT');
                
                if (cat === 'Employee - CREAT') return !isATG && !isConsultant;
                if (cat === 'Employee - ATG') return isATG && !isConsultant;
                if (cat === 'Consultant - CREAT') return !isATG && isConsultant;
                if (cat === 'Consultant - ATG') return isATG && isConsultant;
                
                return e.category === cat;
              })
             ) && 
             (hrFilters.band.includes('All') || hrFilters.band.includes(e.band)) && 
             (hrFilters.skill.includes('All') || hrFilters.skill.includes(e.skill)) && 
             (hrFilters.skillLevel2.includes('All') || hrFilters.skillLevel2.includes(e.skillLevel2)) &&
             (hrFilters.prm.includes('All') || hrFilters.prm.includes(prmName)) &&
             (hrFilters.frm.includes('All') || hrFilters.frm.includes(frmName)) &&
             (hrFilters.family.includes('All') || hrFilters.family.includes(e.productFamily)) &&
             (hrFilters.project.includes('All') || allocations.some(a => hrFilters.project.includes(a.label)) || (allocations.length === 0 && hrFilters.project.includes('Unallocated'))) &&
             isMatchAllocation(alloc, hrFilters.allocation);
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = String(a[sortConfig.key] || "").toLowerCase();
        const valB = String(b[sortConfig.key] || "").toLowerCase();
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        return valA.localeCompare(valB, undefined, { numeric: true }) * dir;
      });
    }

    return result;
  }, [employees, search, hrFilters, findProjectLabelById, findEmployeeNameById, sortConfig]);

  const hierarchyData = useMemo(() => {
    const isAnyFilterActive = search.trim() !== '' || Object.values(hrFilters).some(val => Array.isArray(val) && !val.includes('All'));
    const activeEmployees = employees.filter(e => e.status !== 'Inactive');
    return buildHierarchy(isAnyFilterActive ? filteredEmployeesList.filter(e => e.status !== 'Inactive') : activeEmployees);
  }, [employees, filteredEmployeesList, hrFilters, search, buildHierarchy]);

  const handleExportResources = async () => {
    if (employees.length === 0) return alert("No resource records identified.");
    try {
      await exportResourceRegistry(employees, projects, config);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please check console for details.");
    }
  };

  const handleImportResources = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const data = await processResourceImport(file, config, employees, projects); setPendingImportData(data); setIsImportInspectionOpen(true); } catch (err: any) { alert("Import Error: " + err.message); } finally { e.target.value = ''; }
  };

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedNodes(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  }, [setCollapsedNodes]);

  const handleExpandAll = () => {
    setCollapsedNodes(new Set());
  };

  const handleCollapseAll = () => {
    const allIds = new Set<string>();
    const traverse = (nodes: any[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allIds.add(n.treeId);
          traverse(n.children);
        }
      });
    };
    traverse(hierarchyData);
    setCollapsedNodes(allIds);
  };

  const handleSaveResource = () => {
    if (!editingEmployee || !editingEmployee.empId || !editingEmployee.name) {
      alert("Critical Data Missing: Employee ID and Name are required.");
      return;
    }

    // Persist seat allocation if selected
    if (editingEmployee.seat) {
      setSeatData(prev => {
        const filtered = prev.filter(s => 
          String(s.employeeId).trim().toLowerCase() !== String(editingEmployee.empId).trim().toLowerCase()
        );
        return [...filtered, { 
          employeeId: editingEmployee.empId, 
          employeeName: editingEmployee.name,
          seatNumber: editingEmployee.seat,
          index: editingEmployee.seatIndex
        }];
      });
      // Optionally notify server if API exists
      const syncKey = syncConfig?.key || localStorage.getItem('sync_key');
      if (syncKey) {
        fetch('/api/seats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-sync-key': syncKey },
          body: JSON.stringify({ 
            employeeId: editingEmployee.empId, 
            employeeName: editingEmployee.name,
            seatNumber: editingEmployee.seat,
            index: editingEmployee.seatIndex
          })
        }).catch(err => console.warn("Failed to sync seat to server:", err));
      }
    }

    const updated = editingEmployee.id 
      ? employees.map(ex => ex.id === editingEmployee.id ? (editingEmployee as Employee) : ex) 
      : [...employees, { ...editingEmployee, id: generateUUID(), status: 'Active' } as Employee];
    
    onUpdateEmployees(updated);
    setEditingEmployee(null);
    notify("Resource successfully updated.", "success");
  };

  const renderAnalytics = () => {
    const totalCount = filteredEmployeesList.length;
    let allocated = 0;
    let notAllocated = 0;
    let underUtilized = 0;
    let overUtilized = 0;
    
    filteredEmployeesList.forEach(e => {
       const alloc = calculateCurrentAllocation(e.email, e.id);
       if (alloc === 0) {
          notAllocated++;
       } else if (alloc > 0 && alloc < 100) {
          underUtilized++;
          allocated++;
       } else if (alloc === 100) {
          allocated++;
       } else if (alloc > 100) {
          overUtilized++;
          allocated++;
       }
    });

    const allocPct = totalCount > 0 ? Math.round((allocated / totalCount) * 100) : 0;
    const notAllocPct = totalCount > 0 ? Math.round((notAllocated / totalCount) * 100) : 0;
    const underUtilPct = totalCount > 0 ? Math.round((underUtilized / totalCount) * 100) : 0;
    const overUtilPct = totalCount > 0 ? Math.round((overUtilized / totalCount) * 100) : 0;
    const totalActive = filteredEmployeesList.filter(e => e.status !== 'Inactive').length;

    return (
      <div className="bg-white border border-slate-100 p-1 rounded-full flex flex-col md:flex-row items-center shadow-sm overflow-hidden w-full shrink-0 gap-2 md:gap-0 min-h-[50px] animate-fadeIn">
        <div className="px-6 flex flex-col shrink-0 text-center md:text-left">
          <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-tighter leading-none">Resources Hub</h2>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-none">Capacity Metrics</span>
        </div>
        <div className="flex-grow flex items-center bg-slate-50/50 rounded-full py-1.5 px-4 border border-slate-100 w-full justify-between divide-x divide-slate-200/60 overflow-hidden h-full">
          <div className="px-4 xl:px-6 text-center bg-emerald-500 rounded-full py-2.5 mx-1 shadow-lg shrink-0 min-w-[85px] flex flex-col justify-center h-[calc(100%-4px)] my-auto transition-all">
            <p className="text-[16px] xl:text-[18px] font-black text-white leading-none h-[1em] mb-1">{totalCount}</p>
            <h4 className="text-[7px] xl:text-[8px] font-black text-white/70 uppercase tracking-widest leading-none">TOTAL <span className="text-[6px]">BASE</span></h4>
          </div>
          <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
            <p className="text-[14px] xl:text-[16px] font-black text-indigo-600 leading-none h-[1em] mb-1">{allocated}</p>
            <h4 className="text-[7px] xl:text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">Allocated ({allocPct}%) <span className="text-[6px] opacity-60">BASE</span></h4>
          </div>
          <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
            <p className="text-[14px] xl:text-[16px] font-black text-slate-400 leading-none h-[1em] mb-1">{notAllocated}</p>
            <h4 className="text-[7px] xl:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Not Alloc ({notAllocPct}%) <span className="text-[6px] opacity-60">BASE</span></h4>
          </div>
          <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
            <p className="text-[14px] xl:text-[16px] font-black text-orange-600 leading-none h-[1em] mb-1">{underUtilized}</p>
            <h4 className="text-[7px] xl:text-[8px] font-black text-orange-400 uppercase tracking-widest leading-none">Underutilized ({underUtilPct}%) <span className="text-[6px] opacity-60">BASE</span></h4>
          </div>
          <div className="px-3 xl:px-4 text-center shrink-0 min-w-[70px] flex flex-col justify-center">
            <p className="text-[14px] xl:text-[16px] font-black text-red-600 leading-none h-[1em] mb-1">{overUtilized}</p>
            <h4 className="text-[7px] xl:text-[8px] font-black text-red-400 uppercase tracking-widest leading-none">Overutilized ({overUtilPct}%) <span className="text-[6px] opacity-60">BASE</span></h4>
          </div>
          <div className="px-3 xl:px-4 text-center first:pl-0 shrink-0 min-w-[70px] flex flex-col justify-center">
            <p className="text-[14px] xl:text-[16px] font-black text-slate-900 leading-none h-[1em] mb-1">
              {totalActive} <span className="text-[9px] text-slate-300 font-bold">/ {totalCount}</span>
            </p>
            <h4 className="text-[7px] xl:text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Active / Total</h4>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 max-w-full leading-none">
      {renderAnalytics()}
      {viewMode === 'graphical' && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm mr-2">
              <button onClick={() => setLayout(layout === 'horizontal' ? 'columnar' : 'horizontal')} className="px-4 py-2 text-slate-500 hover:text-indigo-600 transition-colors uppercase text-[9px] font-black flex items-center space-x-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16" strokeWidth="3" strokeLinecap="round" /></svg>
                <span>{layout === 'horizontal' ? 'Columnar' : 'Horizontal'}</span>
              </button>
              <div className="w-px h-6 bg-slate-100 mx-1 self-center"></div>
              <button onClick={handleExpandAll} className="px-3 py-2 text-slate-500 hover:text-indigo-600 transition-colors uppercase text-[9px] font-black">Expand All</button>
              <button onClick={handleCollapseAll} className="px-3 py-2 text-slate-500 hover:text-indigo-600 transition-colors uppercase text-[9px] font-black">Collapse All</button>
              <div className="w-px h-6 bg-slate-100 mx-1 self-center"></div>
              <button onClick={() => setZoom(Math.max(0.1, zoom-0.1))} className="p-2 font-black text-slate-400 hover:text-indigo-600 transition-colors" title="Zoom Out">-</button>
              <span className="flex items-center px-2 text-[9px] font-black text-slate-400 w-14 justify-center bg-slate-50 rounded-lg">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(2, zoom+0.1))} className="p-2 font-black text-slate-400 hover:text-indigo-600 transition-colors" title="Zoom In">+</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm space-y-6">
        <div className="flex flex-wrap gap-2 items-end">
          <HRMultiSelect label="Vertical" options={config?.verticals || []} selected={hrFilters.vertical} onChange={v => updateFilter('vertical', v)} />
          <HRMultiSelect label="Func. Team" options={config?.functionalTeams || []} selected={hrFilters.functionalTeam} onChange={v => updateFilter('functionalTeam', v)} />
          <HRMultiSelect label="Location" options={config?.locations || []} selected={hrFilters.location} onChange={v => updateFilter('location', v)} />
          <HRMultiSelect label="Category" options={categoryOptions} selected={hrFilters.category} onChange={v => updateFilter('category', v)} />
          <HRMultiSelect label="Band" options={config?.bands || []} selected={hrFilters.band} onChange={v => updateFilter('band', v)} />
          <HRMultiSelect label="Skill L1" options={RESOURCE_SKILLS} selected={hrFilters.skill} onChange={v => updateFilter('skill', v)} />
          <HRMultiSelect label="Skill L2" options={filterOptions.skillLevel2} selected={hrFilters.skillLevel2} onChange={v => updateFilter('skillLevel2', v)} />
          <HRMultiSelect label="PR Manager" options={filterOptions.prm} selected={hrFilters.prm} onChange={v => updateFilter('prm', v)} />
          <HRMultiSelect label="FR Manager" options={filterOptions.frm} selected={hrFilters.frm} onChange={v => updateFilter('frm', v)} />
          <HRMultiSelect label="Family" options={filterOptions.family} selected={hrFilters.family} onChange={v => updateFilter('family', v)} />
          <HRMultiSelect label="Alloc. Project" options={filterOptions.project} selected={hrFilters.project} onChange={v => updateFilter('project', v)} />
          <HRMultiSelect label="% Alloc." options={filterOptions.allocation} selected={hrFilters.allocation} onChange={v => updateFilter('allocation', v)} />
          <HRMultiSelect label="Status" options={['Active', 'Inactive']} selected={hrFilters.status} onChange={v => updateFilter('status', v)} />
          <button onClick={resetHrFilters} className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 h-7 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-xs shrink-0 self-end ml-auto">RESET</button>
          {isAdmin && onDeleteAll && filteredEmployeesList.length > 0 && (
            <button 
              onClick={onDeleteAll}
              className="bg-red-50 border border-red-100 text-red-600 px-3 h-7 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xs shrink-0 self-end ml-2"
            >
              DELETE ALL
            </button>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative flex-grow"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3"/></svg></span><input type="text" placeholder="Search resources..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 h-12 shadow-inner" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <input type="file" ref={resourceFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportResources} /><button onClick={() => resourceFileInputRef.current?.click()} className="h-12 px-6 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m-4-4l4 4 4-4" strokeWidth="3"/></svg><span>Import</span></button><button onClick={handleExportResources} className="h-12 px-6 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 16V4m-4 4l4-4 4 4" strokeWidth="3"/></svg><span>Export</span></button><button onClick={() => setEditingEmployee({})} className="h-12 px-8 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="4"/></svg><span>Add Resource</span></button><button onClick={captureSnapshot} className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-black transition-all shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="2.5"/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"/></svg></button>
        </div>
      </div>

      {viewMode === 'tabular' && (
        <div ref={listContainerRef} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-separate border-spacing-0 min-w-[2800px]">
              <thead className="bg-[#0f172a] text-white h-10">
                <tr className="text-[9px] font-black uppercase tracking-widest">
                  <th className="px-4 py-2 sticky left-0 bg-[#0f172a] z-[115] w-[40px] text-center">#</th>
                  <th onClick={() => handleSort('empId')} className="px-4 py-2 border-l border-white/5 sticky left-[40px] bg-[#0f172a] z-[115] w-[100px] cursor-pointer group">Emp ID <SortIndicator active={sortConfig?.key === 'empId'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('name')} className="px-4 py-2 border-l border-white/5 sticky left-[140px] bg-[#0f172a] z-[115] w-[180px] cursor-pointer group">Name <SortIndicator active={sortConfig?.key === 'name'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('email')} className="px-4 py-2 border-l border-white/5 cursor-pointer group">Email-ID <SortIndicator active={sortConfig?.key === 'email'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('status')} className="px-4 py-2 border-l border-white/5 cursor-pointer group">Active/Inactive <SortIndicator active={sortConfig?.key === 'status'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('vertical')} className="px-4 py-2 border-l border-white/5 cursor-pointer group">Vertical <SortIndicator active={sortConfig?.key === 'vertical'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('functionalTeam')} className="px-4 py-2 cursor-pointer group">Function <SortIndicator active={sortConfig?.key === 'functionalTeam'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('category')} className="px-4 py-2 border-l border-white/5 cursor-pointer group w-[120px] text-center">Category <SortIndicator active={sortConfig?.key === 'category'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('band')} className="px-4 py-2 text-center cursor-pointer group">Band <SortIndicator active={sortConfig?.key === 'band'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('location')} className="px-4 py-2 cursor-pointer group">Location <SortIndicator active={sortConfig?.key === 'location'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('skill')} className="px-4 py-2 cursor-pointer group">Skill L1 <SortIndicator active={sortConfig?.key === 'skill'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('skillLevel2')} className="px-4 py-2 cursor-pointer group">Skill L2 <SortIndicator active={sortConfig?.key === 'skillLevel2'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('prmId')} className="px-4 py-2 cursor-pointer group">PRM <SortIndicator active={sortConfig?.key === 'prmId'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('frmId')} className="px-4 py-2 cursor-pointer group">FRM <SortIndicator active={sortConfig?.key === 'frmId'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('productFamily')} className="px-4 py-2 cursor-pointer group">Family <SortIndicator active={sortConfig?.key === 'productFamily'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th className="px-4 py-2">Project</th>
                  <th onClick={() => handleSort('gender')} className="px-4 py-2 border-l border-white/5 cursor-pointer group w-[80px] text-center">Gender <SortIndicator active={sortConfig?.key === 'gender'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th onClick={() => handleSort('dateOfBirth')} className="px-4 py-2 border-l border-white/5 cursor-pointer group w-[100px] text-center">DOB <SortIndicator active={sortConfig?.key === 'dateOfBirth'} direction={sortConfig?.direction || 'asc'} /></th>
                  <th className="px-4 py-2 border-l border-white/5 w-[100px] text-center">Exp. Bracket</th>
                  <th className="px-4 py-2">% Alloc.</th>
                  <th className="px-4 py-2">Seat</th>
                  <th className="px-4 py-2">Remarks</th>
                  <th className="px-4 py-2 sticky right-0 bg-[#0f172a] z-[115] w-[80px] border-l border-white/5 text-center">Actions</th>
                </tr>
</thead><tbody className="text-[10px] font-medium uppercase text-slate-600 leading-tight">
                    {filteredEmployeesList.length > 0 ? (
                      filteredEmployeesList.map((e, idx) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors h-10 border-b border-slate-100 group">
                          <td className="px-2 py-1 sticky left-0 bg-white z-[110] group-hover:bg-slate-50 text-center text-slate-300 font-bold">{idx + 1}</td>
                          <td className="px-2 py-1 sticky left-[40px] bg-white z-[110] group-hover:bg-slate-50 font-mono text-indigo-500 font-black border-l border-slate-100">{e.empId}</td>
                          <td className="px-2 py-1 sticky left-[140px] bg-white z-[110] group-hover:bg-slate-50 font-black text-slate-900 border-l border-slate-100 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">{e.name}</td>
                          <td className="px-2 py-1">{e.email || 'N/A'}</td>
                          <td className="px-2 py-1"><span className={`px-2 py-1 rounded-full text-[8px] font-black ${e.status === 'Inactive' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{e.status || 'Active'}</span></td>
                          <td className="px-2 py-1">{e.vertical}</td>
                          <td className="px-2 py-1">{e.functionalTeam}</td>
                          <td className="px-2 py-1 text-center font-bold">{e.category || 'NA'}</td>
                          <td className="px-2 py-1 text-center font-bold">{e.band}</td>
                          <td className="px-2 py-1">{e.location}</td>
                          <td className="px-2 py-1 text-indigo-900 font-black">{e.skill}</td>
                          <td className="px-2 py-1 text-[9px]">{e.skillLevel2}</td>
                          <td className="px-2 py-1 italic">{findEmployeeNameById(e.prmId)}</td>
                          <td className="px-2 py-1 italic">{findEmployeeNameById(e.frmId)}</td>
                          <td className="px-2 py-1 text-slate-400 text-[9px]">{e.productFamily}</td>
                          <td className="px-2 py-1 text-emerald-600 font-bold">
                            {getEmployeeAllocations(e.email, e.allocatedProjectId).map(a => a.code).join(', ') || 'Unallocated'}
                          </td>
                          <td className="px-2 py-1 text-center font-bold">{e.gender || 'NA'}</td>
                          <td className="px-2 py-1 font-mono text-center">
                            {(() => {
                              if (!e.dateOfBirth) return 'NA';
                              try {
                                const d = new Date(e.dateOfBirth);
                                if (isNaN(d.getTime())) return 'NA';
                                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-').toUpperCase();
                              } catch (err) {
                                return 'NA';
                              }
                            })()}
                          </td>
                          <td className="px-2 py-1 text-center font-bold text-indigo-600">
                            {calculateExperienceBracket(e.dateOfJoining)}
                          </td>
                          <td className="px-2 py-1 text-slate-900 font-bold text-center">{calculateCurrentAllocation(e.email, e.id)}%</td>
                          <td className="px-2 py-1 text-indigo-600 font-bold text-center">
                            {
                              seatData.find(
                                s => String(s.employeeId).trim().toLowerCase() === String(e.empId).trim().toLowerCase()
                              )?.seatNumber || "Unassigned"
                            }
                          </td>
                          <td className="px-2 py-1 text-[8px] text-slate-400 truncate max-w-[200px]">{e.remarks}</td>
                          <td className="px-2 py-1 sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] z-[110]">
                            <div className="flex items-center justify-center space-x-1">
                              <button onClick={() => setEditingEmployee(e)} className="p-1 text-indigo-400 hover:text-indigo-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"/></svg></button>
                              <button onClick={() => onDeleteEmployee(e.id, e.name)} className="p-1 text-red-200 hover:text-red-500"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" strokeWidth="2.5"/></svg></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={23} className="px-4 py-12 text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50/30">
                          No resources found matching the current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
</table></div></div>
      )}

      {viewMode === 'graphical' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-inner overflow-hidden animate-fadeIn relative">
          <div 
            ref={viewportRef} 
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`overflow-auto p-12 sm:p-20 min-h-[800px] cursor-grab active:cursor-grabbing transition-opacity duration-300 ${isLayoutChanging ? 'opacity-0' : 'opacity-100'} ${isDragging ? 'select-none' : ''}`}
          >
            <div className="flex justify-start items-start min-w-full min-h-full pb-[20vh]">
              <div 
                style={{ 
                  transform: `scale(${zoom})`, 
                  transformOrigin: 'top left',
                  willChange: 'transform'
                }} 
                className="inline-block transition-transform duration-200 ease-out w-fit h-fit"
              >
                <div ref={treeContainerRef} className="flex flex-col items-center">
                  {hierarchyData.length > 0 ? (
                    hierarchyData.map(root => (
                      <OrgNode 
                        key={root.treeId} 
                        node={root} 
                        layout={layout} 
                        onToggleCollapse={handleToggleCollapse} 
                        collapsedNodes={collapsedNodes} 
                      />
                    ))
                  ) : (
                    <div className="py-48 text-center w-full">
                      <div className="text-5xl mb-6">🌳</div>
                      <p className="text-slate-400 font-black uppercase text-[12px] tracking-[0.3em]">Identity Mapping Infrastructure - No Data in Scope</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'matrix' && <div ref={matrixContainerRef} className="animate-fadeIn"><ResourceMatrixView employees={filteredEmployeesList} verticals={config?.verticals || []} config={config} /></div>}
      {viewMode === 'dashboard' && <div className="animate-fadeIn"><ResourcesDashboard employees={filteredEmployeesList} projects={projects} hrFilters={hrFilters} setHrFilters={setHrFilters} /></div>}

      {editingEmployee && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl animate-fadeIn overflow-hidden flex flex-col max-h-[95vh]">
            <div className="bg-indigo-600 p-8 text-white flex justify-between items-start shrink-0"><div><h3 className="text-2xl font-black uppercase tracking-tight">{editingEmployee.id ? 'Save Resource' : 'Add Resource'}</h3><p className="text-[10px] font-black opacity-70 uppercase mt-1 tracking-widest">Resource Management Protocol</p></div><button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg></button></div>
            <div className="p-10 space-y-8 overflow-y-auto flex-grow no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1"><ModalLabel required>Employee ID</ModalLabel><ModalInput value={editingEmployee.empId || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, empId: e.target.value})} placeholder="E.G. 100456" /></div>
                <div className="space-y-1 md:col-span-2"><ModalLabel required>Full Legal Name</ModalLabel><ModalInput value={editingEmployee.name || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, name: e.target.value})} placeholder="ENTER FULL NAME" /></div>
                <div className="space-y-1"><ModalLabel required>Vertical</ModalLabel><ModalSelect value={editingEmployee.vertical || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, vertical: e.target.value})}>{(config?.verticals || []).map(v => <option key={v} value={v}>{v}</option>)}</ModalSelect></div>
                <div className="space-y-1"><ModalLabel>Functional Team</ModalLabel><ModalSelect value={editingEmployee.functionalTeam || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, functionalTeam: e.target.value})}>{(config?.functionalTeams || []).map(t => <option key={t} value={t}>{t}</option>)}</ModalSelect></div>
                <div className="space-y-1"><ModalLabel>Band</ModalLabel><ModalSelect value={editingEmployee.band || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, band: e.target.value})}>{(config?.bands || []).map(b => <option key={b} value={b}>{b}</option>)}</ModalSelect></div>
                <div className="space-y-1"><ModalLabel>Operating Location</ModalLabel><ModalSelect value={editingEmployee.location || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, location: e.target.value})}>{(config?.locations || []).map(l => <option key={l} value={l}>{l}</option>)}</ModalSelect></div>
                <div className="space-y-1">
                  <ModalLabel>Current Assigned Seat</ModalLabel>
                  <button 
                    type="button"
                    onClick={() => setIsSeatPickerOpen(true)}
                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl px-5 py-3 text-[12px] font-black text-indigo-600 h-10 flex items-center justify-between hover:border-indigo-200 transition-all group"
                  >
                    <span>{editingEmployee.seat || seatData.find(s => String(s.employeeId).trim().toLowerCase() === String(editingEmployee.empId).trim().toLowerCase())?.seatNumber || "CLICK TO SELECT SEAT"}</span>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                <div className="space-y-1"><ModalLabel>Skill Category (L1)</ModalLabel><ModalSelect value={editingEmployee.skill || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, skill: e.target.value})}>{(RESOURCE_SKILLS || []).map(s => <option key={s} value={s}>{s}</option>)}</ModalSelect></div>
                <div className="space-y-1"><ModalLabel>Skill (L2)</ModalLabel><ModalSelect value={editingEmployee.skillLevel2 || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, skillLevel2: e.target.value})}>{(config?.skillLevelsL2 || []).map(s => <option key={s} value={s}>{s}</option>)}</ModalSelect></div>
                <div className="space-y-1"><ModalLabel>PR Manager (ID/Name)</ModalLabel><ModalInput value={editingEmployee.prmId || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, prmId: e.target.value})} placeholder="PRM ID" /></div>
                <div className="space-y-1"><ModalLabel>FR Manager (ID/Name)</ModalLabel><ModalInput value={editingEmployee.frmId || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, frmId: e.target.value})} placeholder="FRM ID" /></div>
                <div className="space-y-1"><ModalLabel>Email-ID</ModalLabel><ModalInput value={editingEmployee.email || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, email: e.target.value})} placeholder="E.G. NAME@COMPANY.COM" /></div>
                <div className="space-y-1"><ModalLabel>Status</ModalLabel><ModalSelect value={editingEmployee.status || 'Active'} onChange={(e: any) => setEditingEmployee({...editingEmployee, status: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option></ModalSelect></div>
                <div className="space-y-1"><ModalLabel>Gender</ModalLabel><ModalSelect value={editingEmployee.gender || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, gender: e.target.value})}><option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></ModalSelect></div>
                <div className="space-y-1"><ModalLabel>Date of Birth</ModalLabel><ModalInput type="date" value={editingEmployee.dateOfBirth || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, dateOfBirth: e.target.value})} /></div>
                <div className="space-y-1"><ModalLabel>Date of Joining</ModalLabel><ModalInput type="date" value={editingEmployee.dateOfJoining || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, dateOfJoining: e.target.value})} /></div>
                <div className="space-y-1"><ModalLabel>Product Family</ModalLabel><ModalSelect value={editingEmployee.productFamily || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, productFamily: e.target.value})}>{(config?.productFamilies || []).map(f => <option key={f} value={f}>{f}</option>)}</ModalSelect></div>
                <div className="md:col-span-3 space-y-1"><ModalLabel>Project Allocation</ModalLabel><ModalSelect value={editingEmployee.allocatedProjectId || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, allocatedProjectId: e.target.value})}><option value="">UNALLOCATED</option>{(projects || []).map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}</ModalSelect></div>
                <div className="md:col-span-3 space-y-1"><ModalLabel>Internal Remarks</ModalLabel><textarea className="w-full bg-[#f8fafc] border border-slate-100 rounded-xl px-5 py-4 text-[12px] font-bold outline-none h-24 uppercase" value={editingEmployee.remarks || ''} onChange={(e: any) => setEditingEmployee({...editingEmployee, remarks: e.target.value})} placeholder="..." /></div>
              </div>
            </div>
            <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              <button 
                onClick={() => setEditingEmployee(null)} 
                className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
              >
                Abort Changes
              </button>
              <button 
                onClick={handleSaveResource} 
                className="bg-indigo-600 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
              >
                {editingEmployee.id ? 'Save Resource' : 'Add Resource'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ResourceImportInspectionModal isOpen={isImportInspectionOpen} data={pendingImportData} onClose={() => setIsImportInspectionOpen(false)} onConfirm={() => { if (pendingImportData) { const cur = [...employees]; pendingImportData.resources.forEach((r: any) => { if (r.importStatus === 'error') return; if (r.importStatus === 'update' && r.id) { const idx = cur.findIndex(ex => ex.id === r.id); if (idx >= 0) { cur[idx] = { ...cur[idx], ...r }; return; } } cur.push({ ...r, id: generateUUID() }); }); onUpdateEmployees(cur); setIsImportInspectionOpen(false); setPendingImportData(null); alert("Import Success"); } }} />
      
      {isSeatPickerOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Interactive Seat Selection</h3>
                <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">Select a blue available seat to assign</p>
              </div>
              <button 
                onClick={() => setIsSeatPickerOpen(false)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Cancel Selection
              </button>
            </div>
            <div className="flex-grow bg-white relative">
              <iframe 
                src="/seat-allocation/allocation6.html?mode=select" 
                className="w-full h-full border-none bg-white"
                title="Seat Picker"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default HRManagement;