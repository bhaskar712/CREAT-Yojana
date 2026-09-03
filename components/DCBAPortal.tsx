
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Opportunity, 
  DCBAStage, 
  DCBA_STAGES, 
  MasterConfigState,
  PFS_STATUS_OPTIONS,
  generateUUID
} from '../types';
import { ALL_FISCAL_YEARS } from '../constants';
import { GreenMatrix } from './GreenMatrix';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Cell
} from 'recharts';
import { 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  Edit2,
  Trash2,
  MoreVertical,
  Calendar,
  IndianRupee,
  Users,
  Target,
  X,
  Copy,
  Check
} from 'lucide-react';

const MultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (selected: string[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (option === 'All') {
      onChange(['All']);
      return;
    }
    const newSelected = selected.filter(s => s !== 'All');
    if (newSelected.includes(option)) {
      const filtered = newSelected.filter(s => s !== option);
      onChange(filtered.length === 0 ? ['All'] : filtered);
    } else {
      onChange([...newSelected, option]);
    }
  };

  return (
    <div className="flex flex-col gap-1 relative min-w-[100px] max-w-[160px] flex-grow" ref={ref}>
      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500 text-left flex justify-between items-center h-9 transition-all hover:bg-white"
      >
        <span className="truncate text-slate-700">{selected.includes('All') ? label : selected.join(', ')}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => toggleOption('All')}>
            <input type="checkbox" checked={selected.includes('All')} readOnly className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-[10px] font-bold uppercase text-slate-600">{label}</span>
          </div>
          {options.map(opt => (
            <div key={opt} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => toggleOption(opt)}>
              <input type="checkbox" checked={selected.includes(opt)} readOnly className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-[10px] font-bold uppercase text-slate-600">{opt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatusDot = ({ status }: { status?: string }) => {
  if (!status || status === '-' || status.toLowerCase().trim() === 'none' || status.toLowerCase().trim() === 'na') {
    return <div className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-inner mx-auto opacity-40" title={status || 'No status'} />;
  }
  
  const s = status.toLowerCase().trim();
  // Improved detection for Green
  if (s === 'green' || s === 'g' || s.includes('green') || s === 'ok' || s === 'good' || s === 'complete') {
    return <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] mx-auto animate-pulse" title={status} style={{ animationDuration: '3s' }} />;
  }
  // Improved detection for Red
  if (s === 'red' || s === 'r' || s.includes('red') || s === 'nok' || s === 'critical' || s === 'bad' || s === 'issue') {
    return <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] mx-auto" title={status} />;
  }
  // Improved detection for Yellow
  if (s === 'yellow' || s === 'y' || s.includes('yellow') || s === 'amber' || s === 'warning' || s === 'pending' || s === 'wip') {
    return <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] mx-auto" title={status} />;
  }
  
  return <span className="text-[9px] font-black text-slate-500 uppercase truncate max-w-[40px] block mx-auto" title={status}>{status}</span>;
};

interface DCBAPortalProps {
  isAdmin: boolean;
  masterConfig: MasterConfigState;
  selectedFY: string;
  viewMode: 'list' | 'matrix' | 'yoy' | 'bcg' | 'dashboard';
  setViewMode: (mode: 'list' | 'matrix' | 'yoy' | 'bcg' | 'dashboard') => void;
  notify: (message: string, type?: 'success' | 'error' | 'info' | 'conflict') => void;
}

const monthToYYYYMM = (mmmYY: string | undefined) => {
  if (!mmmYY) return '';
  const parts = mmmYY.split('-');
  if (parts.length !== 2) return mmmYY;
  const monthStr = parts[0].toUpperCase();
  const yearStr = parts[1];
  const months: Record<string, string> = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };
  const month = months[monthStr];
  if (!month) return mmmYY;
  const year = parseInt(yearStr, 10);
  if (isNaN(year)) return mmmYY;
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return `${fullYear}-${month}`;
};

const yyyyMMToMMM_YY = (yyyyMM: string | undefined) => {
  if (!yyyyMM) return '';
  const parts = yyyyMM.split('-');
  if (parts.length !== 2) return yyyyMM;
  const year = parts[0].slice(-2);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[monthIndex];
  if (!month) return yyyyMM;
  return `${month}-${year}`;
};

export const DCBAPortal: React.FC<DCBAPortalProps> = ({ isAdmin, masterConfig, selectedFY, viewMode, setViewMode, notify }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yoyViewType, setYoyViewType] = useState<'graphical' | 'tabular'>('tabular');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [stageFilter, setStageFilter] = useState<string[]>(['All']);
  const [verticalFilter, setVerticalFilter] = useState<string[]>(['All']);
  const [domainFilter, setDomainFilter] = useState<string[]>(['All']);
  const [buFilter, setBuFilter] = useState<string[]>(['All']);
  const [typeFilter, setTypeFilter] = useState<string[]>(['All']);
  const [familyFilter, setFamilyFilter] = useState<string[]>(['All']);
  const [segmentFilter, setSegmentFilter] = useState<string[]>(['All']);
  const [customerFilter, setCustomerFilter] = useState<string[]>(['All']);
  const [statusFilter, setStatusFilter] = useState<string[]>(['All']);
  const [pfsStatusFilter, setPfsStatusFilter] = useState<string[]>(['All']);
  const [pmtTechSalesFilter, setPmtTechSalesFilter] = useState<string[]>(['All']);
  const [swHealthFilter, setSwHealthFilter] = useState<string[]>(['All']);
  const [hwHealthFilter, setHwHealthFilter] = useState<string[]>(['All']);
  const [meHealthFilter, setMeHealthFilter] = useState<string[]>(['All']);
  const [buHealthFilter, setBuHealthFilter] = useState<string[]>(['All']);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'updatedAt', 
    direction: 'desc' 
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modalPrice, setModalPrice] = useState<number>(0);
  const [modalVolume, setModalVolume] = useState<number>(0);
  const [modalStage, setModalStage] = useState<DCBAStage>('T');
  const [isImportInspectionOpen, setIsImportInspectionOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [showMatrixNumbers, setShowMatrixNumbers] = useState(true);
  const [yoyGrouping, setYoyGrouping] = useState<'domain' | 'vertical'>('domain');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyTableData = (id: string, title: string, headers: string[], rows: (string | number)[][], totals?: (string | number)[]) => {
    const tsvText = [
      title.toUpperCase(),
      headers.join('\t'),
      ...rows.map(row => row.join('\t')),
      ...(totals ? [totals.join('\t')] : [])
    ].join('\n');

    const html = `
      <table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
        <thead>
          <tr><th colspan="${headers.length}" style="padding: 10px; background-color: #f1f5f9; font-weight: 900; text-align: center; border: 1px solid #cbd5e1;">${title.toUpperCase()}</th></tr>
          <tr style="background-color: #f8fafc;">
            ${headers.map(h => `<th style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left; color: #64748b;">${h.toUpperCase()}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map((cell, i) => `<td style="padding: 8px; border: 1px solid #cbd5e1; ${i > 0 ? 'text-align: right;' : 'font-weight: 900;'}">${cell}</td>`).join('')}
            </tr>
          `).join('')}
          ${totals ? `
            <tr style="background-color: #0f172a; color: white; font-weight: bold;">
              ${totals.map((cell, i) => `<td style="padding: 8px; border: 1px solid #cbd5e1; ${i > 0 ? 'text-align: right;' : ''}">${cell}</td>`).join('')}
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;

    try {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([tsvText], { type: 'text/plain' });
      // @ts-ignore
      const clipboardData = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

      // @ts-ignore
      navigator.clipboard.write(clipboardData).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        notify('Table copied to clipboard', 'success');
      });
    } catch (err) {
      // Fallback to simple text if ClipboardItem fails
      navigator.clipboard.writeText(tsvText).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        notify('Table copied as plain text', 'success');
      });
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (verticalFilter.length > 0 && !verticalFilter.includes('All')) count++;
    if (domainFilter.length > 0 && !domainFilter.includes('All')) count++;
    if (buFilter.length > 0 && !buFilter.includes('All')) count++;
    if (typeFilter.length > 0 && !typeFilter.includes('All')) count++;
    if (familyFilter.length > 0 && !familyFilter.includes('All')) count++;
    if (segmentFilter.length > 0 && !segmentFilter.includes('All')) count++;
    if (customerFilter.length > 0 && !customerFilter.includes('All')) count++;
    if (stageFilter.length > 0 && !stageFilter.includes('All')) count++;
    if (statusFilter.length > 0 && !statusFilter.includes('All')) count++;
    if (pmtTechSalesFilter.length > 0 && !pmtTechSalesFilter.includes('All')) count++;
    if (search !== '') count++;
    if (swHealthFilter.length > 0 && !swHealthFilter.includes('All')) count++;
    if (hwHealthFilter.length > 0 && !hwHealthFilter.includes('All')) count++;
    if (meHealthFilter.length > 0 && !meHealthFilter.includes('All')) count++;
    if (buHealthFilter.length > 0 && !buHealthFilter.includes('All')) count++;
    return count;
  }, [verticalFilter, domainFilter, buFilter, typeFilter, familyFilter, segmentFilter, customerFilter, stageFilter, statusFilter, pmtTechSalesFilter, search, swHealthFilter, hwHealthFilter, meHealthFilter, buHealthFilter]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const res = await fetch('/api/opportunities', {
        headers: {
          'x-sync-key': syncKey
        }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setOpportunities(data);
        } else {
          const text = await res.text();
          console.error('Expected JSON but received:', text.substring(0, 100));
          throw new Error(`Invalid response format: ${text.substring(0, 50)}...`);
        }
      } else {
        const errorText = await res.text();
        console.error('Failed to fetch opportunities. Status:', res.status, errorText);
        throw new Error(`Server error (${res.status}): ${errorText.substring(0, 50)}`);
      }
    } catch (err) {
      console.error('Failed to fetch opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const getCurrentFY = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    const shortYear = year % 100;
    
    if (month >= 4) {
      return `FY ${shortYear}-${shortYear + 1}`;
    } else {
      return `FY ${shortYear - 1}-${shortYear}`;
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    
    // Calculate value: Tentative Price x Peak Year Volume (in Cr)
    const tentativePrice = parseFloat(data.tentativePrice) || 0;
    const peakYearVolume = parseInt(data.peakYearVolume) || 0;
    let calculatedValue = 0;
    if (tentativePrice > 0 && peakYearVolume > 0) {
      calculatedValue = (tentativePrice * peakYearVolume) / 10000000; 
    }
    
    const probability = (parseFloat(data.probability) || 0) / 100;
    
    // Determine FY: use form value, or selectedFY, or current FY
    let targetFY = data.fiscalYear;
    if (!targetFY) {
      targetFY = selectedFY !== 'All FY' ? selectedFY : getCurrentFY();
    }

    const opportunity: Partial<Opportunity> = {
      ...editingOpportunity,
      id: editingOpportunity?.id || `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productFamily: data.productFamily,
      domain: data.domain,
      customerName: data.customerName,
      segment: data.segment,
      stage: modalStage,
      value: calculatedValue > 0 ? calculatedValue : (parseFloat(data.value) || 0),
      sopDate: yyyyMMToMMM_YY(data.sopDate),
      probability: probability,
      status: data.status,
      vertical: data.vertical,
      businessUnit: data.businessUnit,
      type: data.type,
      fiscalYear: targetFY,
      productDescription: data.productDescription,
      rfiRfqReceiveDate: yyyyMMToMMM_YY(data.rfiRfqReceiveDate),
      pmtTechSales: data.pmtTechSales,
      targetLoiDate: yyyyMMToMMM_YY(data.targetLoiDate),
      actualLoiDate: yyyyMMToMMM_YY(data.actualLoiDate),
      pfsStatus: data.pfsStatus,
      sw: data.sw,
      hw: data.hw,
      me: data.me,
      bu: data.bu,
      tentativePrice: tentativePrice,
      remarks: (() => {
        const newText = data.remarks;
        const currentHistory = Array.isArray(editingOpportunity?.remarks) ? [...editingOpportunity.remarks] : [];
        if (newText) {
          const lastEntry = currentHistory[currentHistory.length - 1];
          if (!lastEntry || lastEntry.text !== newText) {
            currentHistory.push({
              text: newText,
              timestamp: Date.now(),
              userId: 'unknown',
              username: 'User'
            });
          }
        }
        return currentHistory;
      })(),
      marketingContact: data.marketingContact,
      vth: data.vth,
      peakYearVolume: peakYearVolume,
      programLifeYears: parseInt(data.programLifeYears) || 0,
      updatedAt: new Date().toISOString()
    };

    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-sync-key': syncKey
        },
        body: JSON.stringify(opportunity)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingOpportunity(null);
        fetchOpportunities();
      }
    } catch (err) {
      console.error('Failed to save opportunity:', err);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<Opportunity | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const res = await fetch(`/api/opportunities/${id}`, { 
        method: 'DELETE',
        headers: {
          'x-sync-key': syncKey
        }
      });
      if (res.ok) {
        fetchOpportunities();
        setIsDeleteModalOpen(false);
        setOpportunityToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete opportunity:', err);
    }
  };

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      const matchesSearch = 
        opp.productFamily.toLowerCase().includes(search.toLowerCase()) ||
        opp.customerName.toLowerCase().includes(search.toLowerCase()) ||
        opp.domain.toLowerCase().includes(search.toLowerCase()) ||
        (opp.vertical || '').toLowerCase().includes(search.toLowerCase()) ||
        (opp.businessUnit || '').toLowerCase().includes(search.toLowerCase());
      
      const matchesStage = stageFilter.includes('All') || stageFilter.includes(opp.stage);
      const matchesFY = selectedFY === 'All FY' || opp.fiscalYear === selectedFY;
      const matchesVertical = verticalFilter.includes('All') || verticalFilter.includes(opp.vertical || '');
      const matchesDomain = domainFilter.includes('All') || domainFilter.includes(opp.domain || '');
      const matchesBU = buFilter.includes('All') || buFilter.includes(opp.businessUnit || '');
      const matchesType = typeFilter.includes('All') || typeFilter.includes(opp.type || '');
      const matchesFamily = familyFilter.includes('All') || familyFilter.includes(opp.productFamily || '');
      const matchesSegment = segmentFilter.includes('All') || segmentFilter.includes(opp.segment || '');
      const matchesCustomer = customerFilter.includes('All') || customerFilter.includes(opp.customerName || '');
      const matchesStatus = statusFilter.includes('All') || statusFilter.includes(opp.status || '');
      const matchesPFS = pfsStatusFilter.includes('All') || pfsStatusFilter.includes(opp.pfsStatus || '');
      const matchesTechSales = pmtTechSalesFilter.includes('All') || pmtTechSalesFilter.includes(opp.pmtTechSales || '');

      const getStatusType = (status: string | undefined) => {
        if (!status || status === '-' || status.toLowerCase().trim() === 'none' || status.toLowerCase().trim() === 'na') {
          return 'TBC';
        }
        const s = status.toLowerCase().trim();
        if (s === 'green' || s === 'g' || s.includes('green') || s === 'ok' || s === 'good' || s === 'complete') return 'Green';
        if (s === 'red' || s === 'r' || s.includes('red') || s === 'nok' || s === 'critical' || s === 'bad' || s === 'issue') return 'Red';
        if (s === 'yellow' || s === 'y' || s.includes('yellow') || s === 'amber' || s === 'warning' || s === 'pending' || s === 'wip') return 'Yellow';
        return 'TBC';
      };

      const matchesSW = swHealthFilter.includes('All') || swHealthFilter.includes(getStatusType(opp.sw));
      const matchesHW = hwHealthFilter.includes('All') || hwHealthFilter.includes(getStatusType(opp.hw));
      const matchesME = meHealthFilter.includes('All') || meHealthFilter.includes(getStatusType(opp.me));
      const matchesBUHealth = buHealthFilter.includes('All') || buHealthFilter.includes(getStatusType(opp.bu));

      return matchesSearch && matchesStage && matchesFY && matchesStatus &&
             matchesVertical && matchesDomain && matchesBU && 
             matchesType && matchesFamily && matchesSegment && matchesCustomer && matchesPFS && matchesTechSales &&
             matchesSW && matchesHW && matchesME && matchesBUHealth;
    });
  }, [opportunities, search, stageFilter, selectedFY, statusFilter, verticalFilter, domainFilter, buFilter, typeFilter, familyFilter, segmentFilter, customerFilter, pfsStatusFilter, pmtTechSalesFilter, swHealthFilter, hwHealthFilter, meHealthFilter, buHealthFilter]);

  const stats = useMemo(() => {
    const totalValue = filteredOpportunities.reduce((sum, opp) => sum + opp.value, 0);
    const wonValue = filteredOpportunities.filter(o => o.status === 'Won' && (o.stage === 'B' || o.stage === 'A')).reduce((sum, opp) => sum + opp.value, 0);
    const activeLeads = filteredOpportunities.length;
    const avgProb = filteredOpportunities.length > 0 
      ? (filteredOpportunities.reduce((sum, o) => sum + o.probability, 0) / filteredOpportunities.length) * 100 
      : 0;

    return { totalValue, wonValue, activeLeads, avgProb };
  }, [filteredOpportunities]);

  const sortedOpportunities = useMemo(() => {
    let result = [...filteredOpportunities];
    
    if (sortConfig.key) {
      result.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else {
          comparison = aValue - bValue;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    
    return result;
  }, [filteredOpportunities, sortConfig]);

  const yoyOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      const matchesSearch = 
        opp.productFamily.toLowerCase().includes(search.toLowerCase()) ||
        opp.customerName.toLowerCase().includes(search.toLowerCase()) ||
        opp.domain.toLowerCase().includes(search.toLowerCase()) ||
        (opp.vertical || '').toLowerCase().includes(search.toLowerCase()) ||
        (opp.businessUnit || '').toLowerCase().includes(search.toLowerCase());
      
      const matchesStage = stageFilter.includes('All') || stageFilter.includes(opp.stage);
      const matchesVertical = verticalFilter.includes('All') || verticalFilter.includes(opp.vertical || '');
      const matchesDomain = domainFilter.includes('All') || domainFilter.includes(opp.domain || '');
      const matchesBU = buFilter.includes('All') || buFilter.includes(opp.businessUnit || '');
      const matchesType = typeFilter.includes('All') || typeFilter.includes(opp.type || '');
      const matchesFamily = familyFilter.includes('All') || familyFilter.includes(opp.productFamily || '');
      const matchesSegment = segmentFilter.includes('All') || segmentFilter.includes(opp.segment || '');
      const matchesCustomer = customerFilter.includes('All') || customerFilter.includes(opp.customerName || '');
      const matchesStatus = statusFilter.includes('All') || statusFilter.includes(opp.status || '');
      const matchesPFS = pfsStatusFilter.includes('All') || pfsStatusFilter.includes(opp.pfsStatus || '');
      const matchesTechSales = pmtTechSalesFilter.includes('All') || pmtTechSalesFilter.includes(opp.pmtTechSales || '');

      return matchesSearch && matchesStage && matchesStatus &&
             matchesVertical && matchesDomain && matchesBU && 
             matchesType && matchesFamily && matchesSegment && matchesCustomer && matchesPFS && matchesTechSales;
    });
  }, [opportunities, search, stageFilter, statusFilter, verticalFilter, domainFilter, buFilter, typeFilter, familyFilter, segmentFilter, customerFilter, pfsStatusFilter, pmtTechSalesFilter]);

  const yoyData = useMemo(() => {
    const fyList = ALL_FISCAL_YEARS.filter(fy => fy !== 'All FY');
    return fyList.map(fy => {
      const fyOpps = yoyOpportunities.filter(o => o.fiscalYear === fy);
      const totalValue = fyOpps.reduce((sum, o) => sum + o.value, 0);
      const wonValue = fyOpps.filter(o => o.status === 'Won').reduce((sum, o) => sum + o.value, 0);
      const count = fyOpps.length;
      return { fy, totalValue, wonValue, count };
    });
  }, [yoyOpportunities]);

  const yoyTabularData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed, 3 is April
    
    // FY starts in April.
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const currentFYString = `FY ${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;
    
    const currentFYIdx = ALL_FISCAL_YEARS.indexOf(currentFYString as any);
    const fyList = ALL_FISCAL_YEARS.filter((fy, idx) => {
      if (fy === 'All FY') return false;
      return idx <= currentFYIdx;
    });

    const groups = Array.from(new Set(yoyOpportunities.map(o => yoyGrouping === 'domain' ? o.domain : o.vertical))).sort();
    
    const data = groups.map(groupName => {
      const groupOpps = yoyOpportunities.filter(o => (yoyGrouping === 'domain' ? o.domain : o.vertical) === groupName);
      const families = Array.from(new Set(groupOpps.map(o => o.productFamily))).sort();
      
      const familyGroups = families.map(family => {
        const familyOpps = groupOpps.filter(o => o.productFamily === family);
        const descriptions = Array.from(new Set(familyOpps.map(o => o.productDescription || 'Unnamed Product'))).sort();
        
        const rows = descriptions.map(desc => {
          const descOpps = familyOpps.filter(o => (o.productDescription || 'Unnamed Product') === desc);
          const bu = descOpps[0]?.businessUnit || '-';
          const fyValues: Record<string, number> = {};
          let cumulative = 0;
          
          fyList.forEach(fy => {
            const val = descOpps.filter(o => o.fiscalYear === fy).reduce((sum, o) => sum + o.value, 0);
            fyValues[fy] = val;
            cumulative += val;
          });
          
          return { description: desc, bu, fyValues, cumulative };
        });
        
        const familyTotals: Record<string, number> = {};
        let familyCumulative = 0;
        fyList.forEach(fy => {
          const val = familyOpps.filter(o => o.fiscalYear === fy).reduce((sum, o) => sum + o.value, 0);
          familyTotals[fy] = val;
          familyCumulative += val;
        });
        
        return { family, rows, familyTotals, familyCumulative };
      });

      const groupTotals: Record<string, number> = {};
      let groupCumulative = 0;
      fyList.forEach(fy => {
        const val = groupOpps.filter(o => o.fiscalYear === fy).reduce((sum, o) => sum + o.value, 0);
        groupTotals[fy] = val;
        groupCumulative += val;
      });

      return { groupName, familyGroups, groupTotals, groupCumulative };
    });

    const grandTotals: Record<string, number> = {};
    let grandCumulative = 0;
    fyList.forEach(fy => {
      const val = yoyOpportunities.filter(o => o.fiscalYear === fy).reduce((sum, o) => sum + o.value, 0);
      grandTotals[fy] = val;
      grandCumulative += val;
    });

    let maxRowVal = 0;
    let maxFamilyVal = 0;
    let maxGroupVal = 0;

    data.forEach(group => {
      fyList.forEach(fy => {
        if (group.groupTotals[fy] > maxGroupVal) {
          maxGroupVal = group.groupTotals[fy];
        }
      });

      group.familyGroups.forEach(familyGroup => {
        fyList.forEach(fy => {
          if (familyGroup.familyTotals[fy] > maxFamilyVal) {
            maxFamilyVal = familyGroup.familyTotals[fy];
          }
        });

        familyGroup.rows.forEach(row => {
          fyList.forEach(fy => {
            if (row.fyValues[fy] > maxRowVal) {
              maxRowVal = row.fyValues[fy];
            }
          });
        });
      });
    });

    return { data, grandTotals, grandCumulative, fyList, maxRowVal, maxFamilyVal, maxGroupVal };
  }, [yoyOpportunities, yoyGrouping]);

  const bcgData = useMemo(() => {
    return filteredOpportunities.map(opp => ({
      id: opp.id,
      name: `${opp.customerName} - ${opp.productFamily}`,
      x: opp.probability * 100,
      y: opp.value,
      z: Math.max(opp.value, 1),
      stage: opp.stage,
      status: opp.status,
      opp
    }));
  }, [filteredOpportunities]);

  const [dcbaTargets, setDcbaTargets] = useState<{
    domain: Record<string, number>,
    segment: Record<string, number>,
    vertical: Record<string, number>
  }>({ domain: {}, segment: {}, vertical: {} });

  const fetchTargets = async () => {
    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const res = await fetch('/api/budgets/dcba-targets', {
        headers: { 'x-sync-key': syncKey }
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) setDcbaTargets(data);
      }
    } catch (err) {
      console.error('Failed to fetch targets:', err);
    }
  };

  const saveTargets = async (newTargets: typeof dcbaTargets) => {
    setDcbaTargets(newTargets); // Optimistic update
    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-sync-key': syncKey
        },
        body: JSON.stringify({ id: 'dcba-targets', data: newTargets })
      });
      if (!res.ok) {
        console.error('Failed to save targets to server');
      }
    } catch (err) {
      console.error('Failed to save targets:', err);
    }
  };

  useEffect(() => {
    if (viewMode === 'dashboard') {
      fetchTargets();
    }
  }, [viewMode]);

  const dashboardStats = useMemo(() => {
    const categories = ['sw', 'hw', 'me', 'bu'] as const;
    const counts: Record<typeof categories[number], { green: number, yellow: number, red: number, tbc: number }> = {
      sw: { green: 0, yellow: 0, red: 0, tbc: 0 },
      hw: { green: 0, yellow: 0, red: 0, tbc: 0 },
      me: { green: 0, yellow: 0, red: 0, tbc: 0 },
      bu: { green: 0, yellow: 0, red: 0, tbc: 0 },
    };

    const getStatusType = (status: string | undefined) => {
      if (!status || status === '-' || status.toLowerCase().trim() === 'none' || status.toLowerCase().trim() === 'na') {
        return 'tbc';
      }
      const s = status.toLowerCase().trim();
      if (s === 'green' || s === 'g' || s.includes('green') || s === 'ok' || s === 'good' || s === 'complete') return 'green';
      if (s === 'red' || s === 'r' || s.includes('red') || s === 'nok' || s === 'critical' || s === 'bad' || s === 'issue') return 'red';
      if (s === 'yellow' || s === 'y' || s.includes('yellow') || s === 'amber' || s === 'warning' || s === 'pending' || s === 'wip') return 'yellow';
      return 'tbc';
    };

    filteredOpportunities.forEach(opp => {
      categories.forEach(cat => {
        const type = getStatusType(opp[cat]);
        counts[cat][type]++;
      });
    });

    return counts;
  }, [filteredOpportunities]);

  const breakupStats = useMemo(() => {
    const domainData: Record<string, { open: number, won: number }> = {};
    const segmentData: Record<string, { open: number, won: number }> = {};
    const verticalData: Record<string, { open: number, won: number }> = {};

    // Use unique values from masterConfig or from those present in data
    const domains = Array.from(new Set([...(masterConfig.buDomains || []), ...filteredOpportunities.map(o => o.domain)].filter(Boolean)));
    
    // User requested specific segments and verticals for the dashboard
    const segments = ['PV', '2W_3W', 'CV_OR'];
    const verticals = ['ECS-1', 'ECS-2', 'LAS'];

    const normalizeLabel = (label: string | undefined) => {
      if (!label) return '';
      return label.trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''); // Remove all non-alphanumeric
    };

    const targetSegmentsLower = segments.map(s => normalizeLabel(s));
    const targetVerticalsLower = verticals.map(v => normalizeLabel(v));

    domains.forEach(d => { domainData[d] = { open: 0, won: 0 }; });
    segments.forEach(s => { segmentData[s] = { open: 0, won: 0 }; });
    verticals.forEach(v => { verticalData[v] = { open: 0, won: 0 }; });

    filteredOpportunities.forEach(opp => {
      const domain = opp.domain;
      const segment = opp.segment;
      const vertical = opp.vertical;

      if (domain && domainData[domain]) {
        if (opp.status === 'Won') domainData[domain].won += opp.value;
        else if (opp.status === 'Open') domainData[domain].open += opp.value;
      }
      
      if (segment) {
        const normSegment = normalizeLabel(segment);
        const matchIdx = targetSegmentsLower.indexOf(normSegment);
        if (matchIdx !== -1) {
          const key = segments[matchIdx];
          if (opp.status === 'Won') segmentData[key].won += opp.value;
          else if (opp.status === 'Open') segmentData[key].open += opp.value;
        }
      }

      if (vertical) {
        const normVertical = normalizeLabel(vertical);
        const matchIdx = targetVerticalsLower.indexOf(normVertical);
        if (matchIdx !== -1) {
          const key = verticals[matchIdx];
          if (opp.status === 'Won') verticalData[key].won += opp.value;
          else if (opp.status === 'Open') verticalData[key].open += opp.value;
        }
      }
    });

    return { domainData, segmentData, verticalData, domains, segments, verticals };
  }, [filteredOpportunities, masterConfig]);

  const avgValue = useMemo(() => {
    if (bcgData.length === 0) return 0;
    const total = bcgData.reduce((sum, item) => sum + item.y, 0);
    return total / bcgData.length;
  }, [bcgData]);

  const toggleItem = (key: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <Filter size={10} className="ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? 
      <ChevronDown size={10} className="ml-1 text-indigo-400 rotate-180 transition-transform" /> : 
      <ChevronDown size={10} className="ml-1 text-indigo-400 transition-transform" />;
  };

  const handleDeleteAll = async () => {
    setIsDeleteAllModalOpen(false);
    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const res = await fetch('/api/opportunities', { 
        method: 'DELETE',
        headers: {
          'x-sync-key': syncKey
        }
      });
      if (res.ok) {
        notify('All opportunities have been successfully purged.', 'success');
        fetchOpportunities();
      } else {
        notify('Failed to delete all opportunities.', 'error');
      }
    } catch (err) {
      console.error('Delete all failed:', err);
      notify('An error occurred during the purge operation.', 'error');
    }
  };

  const handleExport = () => {
    const headers = ['Stage', 'Product Family', 'FY', 'Customer', 'Domain', 'Value', 'Probability', 'SOP Date', 'Status'];
    const rows = filteredOpportunities.map(opp => [
      opp.stage,
      `"${opp.productFamily}"`,
      opp.fiscalYear,
      `"${opp.customerName}"`,
      `"${opp.domain}"`,
      opp.value,
      opp.probability,
      opp.sopDate,
      opp.status
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `DCBA_Opportunities_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportExcel = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true, cellNF: true, cellText: true });
        
        // --- SUMMARY TARGET EXTRACTION ---
        const summarySheet = wb.SheetNames.find(sn => {
          const name = sn.toLowerCase();
          return (name.includes('summary') && (name.includes('dcba') || name.includes('ctob'))) || 
                 name === 'dcba summary' ||
                 name === 'summary';
        });

        if (summarySheet) {
          console.log(`Scanning summary sheet for targets: "${summarySheet}"`);
          const ws = wb.Sheets[summarySheet];
          const summaryRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          
          const newTargets = { 
            domain: { ...dcbaTargets.domain }, 
            segment: { ...dcbaTargets.segment }, 
            vertical: { ...dcbaTargets.vertical } 
          };
          let updated = false;

          const segments = ['PV', '2W_3W', 'CV_OR'];
          const verticals = ['ECS-1', 'ECS-2', 'LAS'];
          const normalizeLabel = (label: string | undefined) => {
            if (!label) return '';
            return label.trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, ''); // Remove all non-alphanumeric
          };
          const targetSegmentsLower = segments.map(s => normalizeLabel(s));
          const targetVerticalsLower = verticals.map(v => normalizeLabel(v));

          summaryRows.forEach((row, idx) => {
            if (!row || row.length === 0) return;
            const rowText = row.map(c => String(c).trim()).join(' ').toLowerCase();
            
            // Domain Summary Marker
            if (rowText.includes('domain wise break up') || rowText.includes('domain wise breakup')) {
              console.log('Matched Domain Wise Break up marker at row', idx);
              let j = idx + 1;
              while (j < summaryRows.length) {
                const r = summaryRows[j];
                if (!r || r.length === 0) { j++; continue; }
                const label = String(r[0] || '').trim();
                if (!label || label.toLowerCase().includes('total')) break;
                if (label.toLowerCase().includes('domain wise')) { j++; continue; }
                
                const targetStr = String(r[1] || '0').replace(/[^0-9.]/g, '');
                const targetVal = parseFloat(targetStr) || 0;
                if (targetVal > 0) {
                  newTargets.domain[label] = targetVal;
                  updated = true;
                  console.log(`Extracted domain target: ${label} = ${targetVal}`);
                }
                j++;
              }
            } 
            // Segment Summary Marker
            else if (rowText.includes('segment wise break up') || rowText.includes('segment wise breakup')) {
              console.log('Matched Segment Wise Break up marker at row', idx);
              let j = idx + 1;
              while (j < summaryRows.length) {
                const r = summaryRows[j];
                if (!r || r.length === 0) { j++; continue; }
                const label = String(r[0] || '').trim();
                if (!label || label.toLowerCase().includes('total')) break;
                if (label.toLowerCase().includes('segment wise')) { j++; continue; }
                
                const targetStr = String(r[1] || '0').replace(/[^0-9.]/g, '');
                const targetVal = parseFloat(targetStr) || 0;
                if (targetVal > 0) {
                  const normLabel = normalizeLabel(label);
                  const mIdx = targetSegmentsLower.indexOf(normLabel);
                  const finalKey = mIdx !== -1 ? segments[mIdx] : label;
                  newTargets.segment[finalKey] = targetVal;
                  updated = true;
                  console.log(`Extracted segment target: ${finalKey} = ${targetVal}`);
                }
                j++;
              }
            }
            // Vertical Summary Marker
            else if (rowText.includes('vertical wise break up') || rowText.includes('vertical wise breakup')) {
              console.log('Matched Vertical Wise Break up marker at row', idx);
              let j = idx + 1;
              while (j < summaryRows.length) {
                const r = summaryRows[j];
                if (!r || r.length === 0) { j++; continue; }
                const label = String(r[0] || '').trim();
                if (!label || label.toLowerCase().includes('total')) break;
                if (label.toLowerCase().includes('vertical wise')) { j++; continue; }
                
                const targetStr = String(r[1] || '0').replace(/[^0-9.]/g, '');
                const targetVal = parseFloat(targetStr) || 0;
                if (targetVal > 0) {
                  const normLabel = normalizeLabel(label);
                  const mIdx = targetVerticalsLower.indexOf(normLabel);
                  const finalKey = mIdx !== -1 ? verticals[mIdx] : label;
                  newTargets.vertical[finalKey] = targetVal;
                  updated = true;
                  console.log(`Extracted vertical target: ${finalKey} = ${targetVal}`);
                }
                j++;
              }
            }
          });

          if (updated) {
            saveTargets(newTargets);
          }
        }
        // --- END SUMMARY TARGET EXTRACTION ---

        let allProcessedOpportunities: any[] = [];
        const keywords = ['customer', 'product', 'family', 'domain', 'sop', 'vertical', 'business unit', 'status', 'value', 'dcba', 'fy', 'fiscal year', 'id', '#'];
        
        // Scan all sheets to find relevant data
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          
          if (rawRows.length === 0) continue;

          // Attempt to find Fiscal Year in top rows or sheet name
          let sheetFY = '';
          const fyRegex = /FY\s?\d{2}-\d{2}/i;
          const sheetFYMatch = sheetName.match(fyRegex);
          if (sheetFYMatch) {
            sheetFY = sheetFYMatch[0].toUpperCase().replace(/\s/g, ' ');
            if (sheetFY.startsWith('FY') && !sheetFY.startsWith('FY ')) sheetFY = 'FY ' + sheetFY.slice(2);
          }

          if (!sheetFY) {
            for (let i = 0; i < Math.min(10, rawRows.length); i++) {
              const rowText = rawRows[i].join(' ');
              const match = rowText.match(fyRegex);
              if (match) {
                sheetFY = match[0].toUpperCase().replace(/\s/g, ' ');
                if (sheetFY.startsWith('FY') && !sheetFY.startsWith('FY ')) sheetFY = 'FY ' + sheetFY.slice(2);
                break;
              }
            }
          }

          // Find the best header row in this sheet
          let headerIndex = -1;
          let maxMatches = 0;
          let headerKeys: string[] = [];

          const searchRange = Math.min(rawRows.length, 50); // Scan top 50 rows
          for (let i = 0; i < searchRange; i++) {
            const row = rawRows[i];
            let matches = 0;
            const currentKeys: string[] = [];
            
            row.forEach(cell => {
              const cellStr = String(cell || '').toLowerCase().trim();
              currentKeys.push(String(cell || '').trim());
              if (cellStr && keywords.some(k => cellStr.includes(k))) {
                matches++;
              }
            });

            if (matches > maxMatches) {
              maxMatches = matches;
              headerIndex = i;
              headerKeys = currentKeys;
            }
          }

          // If this sheet looks like it has DCBA data (at least 2 keywords found in one row)
          if (headerIndex !== -1 && maxMatches >= 2) {
            console.log(`Found matching sheet: "${sheetName}" with header at row ${headerIndex} (${maxMatches} matches)`);
            
            // Convert remaining rows into objects using the header row
            const dataRows = rawRows.slice(headerIndex + 1);
            const sheetData = dataRows.filter(row => row.some(cell => String(cell).trim() !== '')).map(row => {
              const obj: any = {};
              headerKeys.forEach((key, idx) => {
                if (key) obj[key] = row[idx];
              });
              obj.__sheetFY = sheetFY; // Pass base FY from sheet context
              obj.__sheetName = sheetName; // Pass sheet name for identity
              return obj;
            });

            allProcessedOpportunities = [...allProcessedOpportunities, ...sheetData];
          }
        }

        if (allProcessedOpportunities.length === 0) {
          alert('Could not find any sheets containing DCBA Opportunity data (Customer, Product Family, etc.)');
          return;
        }

        console.log('Total raw data rows found across all matching sheets:', allProcessedOpportunities.length);

        const stageMap: Record<string, string> = {
          'Target': 'T', 'T': 'T',
          'PoC': 'P', 'P': 'P',
          'Discussion': 'E', 'E': 'E',
          'RFI Received': 'D', 'D': 'D', 'RFI': 'D',
          'RFQ Received': 'C', 'C': 'C', 'RFQ': 'C',
          'Awarded': 'B', 'B': 'B', 'Budgeted': 'B',
          'Production': 'A', 'A': 'A', 'Active': 'A',
          'Hold': 'H', 'H': 'H',
          'Lost': 'L', 'L': 'L',
          'Closed': 'C'
        };

        const formatDate = (val: any) => {
          if (!val) return '';
          if (val instanceof Date) {
            return val.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-').toUpperCase();
          }
          if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-').toUpperCase();
          }
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^[A-Za-z]{3}-\d{2}$/.test(trimmed)) return trimmed.toUpperCase();
            const date = new Date(trimmed);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-').toUpperCase();
            }
          }
          return String(val);
        };

        const getVal = (row: any, ...keys: string[]) => {
          for (const key of keys) {
            const lowerKey = key.toLowerCase().trim();
            // Try exact find first
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return String(row[key]).trim();
            // Try trimmed find
            const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === lowerKey);
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
              return String(row[foundKey]).trim();
            }
          }
          return '';
        };

        // Context trackers for forward-filling
        let ctx = {
          pf: '',
          dom: '',
          cust: '',
          vert: '',
          bu: '',
          fy: '',
          sheet: ''
        };

        const opportunitiesToImport = allProcessedOpportunities.map((row: any) => {
          // Reset context if we moved to a new sheet to prevent cross-contamination
          if (row.__sheetName && row.__sheetName !== ctx.sheet) {
            ctx = { pf: '', dom: '', cust: '', vert: '', bu: '', fy: '', sheet: row.__sheetName };
          }

          const pfRaw = getVal(row, 'Product Family', 'Product', 'Product Line', 'Family');
          const domRaw = getVal(row, 'Domain', 'BU Domain', 'Market Segment');
          const custRaw = getVal(row, 'Customer Name', 'Customer', 'Account');
          const vertRaw = getVal(row, 'CREAT Vertical', 'Vertical', 'Vertical Name');
          const buRaw = getVal(row, 'Business Unit', 'BU');
          const fyRaw = getVal(row, 'Fiscal Year', 'FY', 'FY Year');
          const rowIdRaw = getVal(row, '#', 'ID', 'S.No', 'Number', 'Serial No');

          // Strict Row Check: If the row is a "phantom" (all data fields empty) and it's not the start of a new group (#), skip it
          const productDescription = getVal(row, 'Product Description', 'Description', 'Item Description', 'Detail');
          const stageVal = getVal(row, 'DCBA', 'Stage', 'Master Stage', 'DCBA Stage');
          const valRaw = getVal(row, 'Value (Rs. Cr)', 'Value', 'CtoB Value', 'Potential Value', 'Kit Value', 'Value (Rs in Lacs)', 'Potential Value (Rs. Cr)', 'Potential Sales Value');
          const rfiRaw = getVal(row, 'RFI/Q Receive Date', 'RFI Date', 'RFQ Date');
          
          const isBasicallyEmpty = !pfRaw && !custRaw && !productDescription && !stageVal && !valRaw && !rfiRaw;
          const isGroupStart = !!rowIdRaw;

          // If it's a phantom row with no ID, we will eventually filter it out, but we should also not let it update the context
          if (isBasicallyEmpty && !isGroupStart) {
             // Just pass through, will be filtered out
          } else {
            // Update context if values are present (Forward Filling)
            if (pfRaw) ctx.pf = pfRaw;
            if (domRaw) ctx.dom = domRaw;
            if (custRaw) ctx.cust = custRaw;
            if (vertRaw) ctx.vert = vertRaw;
            if (buRaw) ctx.bu = buRaw;
            if (fyRaw) ctx.fy = fyRaw;
          }

          const productFamily = pfRaw || ctx.pf || 'Unknown';
          const domain = domRaw || ctx.dom || 'Unknown';
          const customerName = custRaw || ctx.cust || 'Unknown';
          const vertical = vertRaw || ctx.vert;
          const businessUnit = buRaw || ctx.bu;
          const fiscalYear = fyRaw || ctx.fy || row.__sheetFY || selectedFY || '';

          const segment = getVal(row, 'Segment', 'Sector') || 'Unknown';
          const stage = stageMap[stageVal] || (stageVal && stageVal.length === 1 ? stageVal : 'T');
          
          // Value extraction with unit detection (Cr vs Lacs)
          
          // Improved unit detection: check if the SPECIFIC column used contains 'lac'
          const valColKey = Object.keys(row).find(k => row[k] === valRaw)?.toLowerCase() || '';
          const isLacs = valColKey.includes('lacs') || valColKey.includes('lac');
          
          const parseNum = (v: any) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const cleaned = v.toString().replace(/[^0-9.-]/g, '');
            return parseFloat(cleaned) || 0;
          };
          
          let value = parseNum(valRaw);
          // Only convert if it's explicitly a Lacs column and the number is high (heuristic for unit conversion)
          if (isLacs && value > 1) {
            value = value / 100;
          }

          const status = getVal(row, 'Status', 'Opportunity Status', 'Current Status', 'Won/Lost') || 'Open';
          
          const errors: string[] = [];
          if (customerName === 'Unknown' && !productDescription) {
            errors.push("Empty or invalid row identity");
          }

          // Stable ID generation using the '#' column + sheet name to prevent cross-sheet collisions
          const stableId = rowIdRaw ? `excel-${row.__sheetName}-${rowIdRaw}` : (row['#'] ? `excel-${row.__sheetName}-${row['#']}` : null);
          
          // If the row was basically empty and no ID, mark as invalid for filtering
          if (isBasicallyEmpty && !isGroupStart) {
            errors.push("Trailing or blank row detected");
          }

          // Check for existing: Stable ID priority, then metadata match
          const exists = opportunities.find(o => {
            if (stableId && o.id === stableId) return true;
            return o.customerName.toLowerCase().trim() === customerName.toLowerCase().trim() && 
                   o.productFamily.toLowerCase().trim() === productFamily.toLowerCase().trim() &&
                   (o.productDescription || '').toLowerCase().trim() === (productDescription || '').toLowerCase().trim() &&
                   (o.fiscalYear || '').toLowerCase().trim() === (fiscalYear || '').toLowerCase().trim();
          });

          const opportunityId = exists?.id || stableId || generateUUID();

          return {
            id: opportunityId,
            productFamily,
            domain,
            customerName,
            segment,
            stage,
            value,
            sopDate: formatDate(getVal(row, 'Planned SOP Date', 'SOP Date', 'SOP')),
            probability: parseFloat(getVal(row, 'Probability', 'Win Probability %', 'Prob %').replace(/[^0-9.]/g, '')) / 100 || 0.5,
            status,
            vertical,
            businessUnit,
            type: getVal(row, 'Type', 'Proj Type'),
            fiscalYear,
            remarks: (() => {
              const newRemark = getVal(row, 'Status Report', 'Remarks', 'Latest Update', 'Reason', 'Comments');
              const currentHistory = Array.isArray(exists?.remarks) ? [...exists.remarks] : [];
              if (newRemark) {
                const lastEntry = currentHistory[currentHistory.length - 1];
                if (!lastEntry || lastEntry.text !== newRemark) {
                  currentHistory.push({
                    text: newRemark,
                    timestamp: Date.now(),
                    userId: 'import',
                    username: 'Import'
                  });
                }
              }
              return currentHistory;
            })(),
            marketingContact: getVal(row, 'Head Marketing', 'Marketing Contact', 'Marketing'),
            vth: getVal(row, 'VTH'),
            peakYearVolume: parseInt(getVal(row, 'Peak Year Volume', 'Peak Volume', 'Peak Year').replace(/[^0-9]/g, '')) || 0,
            programLifeYears: parseInt(getVal(row, 'Program Life Years', 'Program Life').replace(/[^0-9]/g, '')) || 0,
            productDescription,
            rfiRfqReceiveDate: formatDate(getVal(row, 'RFI/Q Receive Date', 'RFI Date', 'RFQ Date')),
            pmtTechSales: getVal(row, 'PMT Tech Sales', 'Tech Sales', 'PMT'),
            targetLoiDate: formatDate(getVal(row, 'Target LOI Date', 'LOI Target')),
            actualLoiDate: formatDate(getVal(row, 'Actual LOI date', 'Actual LOI Date', 'LOI Actual')),
            pfsStatus: getVal(row, 'PFS State', 'PFS Status', 'PFS'),
            sw: getVal(row, 'SW', 'Software', 'SW Status', 'SW State', 'Software Status', 'SW Health', 'SW Status '),
            hw: getVal(row, 'HW', 'Hardware', 'HW Status', 'HW State', 'Hardware Status', 'HW Health', 'HW Status '),
            me: getVal(row, 'ME', 'Mechanical', 'ME Status', 'ME State', 'Mechanical Status', 'ME Health', 'ME Status '),
            bu: getVal(row, 'BU', 'BU Status', 'BU State', 'Business Unit Status', 'BU Status State', 'Business Status', 'BU Health', 'BU Status '),
            tentativePrice: parseFloat(getVal(row, 'Potential Kit Value', 'Tentative Price', 'Kit Value', 'Potential Kit Value ').replace(/[^0-9.]/g, '')) || 0,
            importStatus: errors.length > 0 ? 'error' : (exists ? 'update' : 'valid'),
            errors
          };
        }).filter(item => {
          // Filter out rows that are likely header fragments or dividers with no meaningful project info
          if (item.errors.includes("Trailing or blank row detected")) return false;
          return item.customerName !== 'Unknown' || (item.productDescription && item.productDescription !== '');
        });

        setPendingImportData({
          opportunities: opportunitiesToImport,
          summary: {
            total: opportunitiesToImport.length,
            valid: opportunitiesToImport.filter(o => o.importStatus === 'valid').length,
            updates: opportunitiesToImport.filter(o => o.importStatus === 'update').length,
            errors: opportunitiesToImport.filter(o => o.importStatus === 'error').length
          }
        });
        setIsImportInspectionOpen(true);
      } catch (err) {
        console.error('Import error:', err);
        alert('Error parsing Excel file');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const finalizeImport = async () => {
    if (!pendingImportData) return;
    
    try {
      const syncKey = import.meta.env.VITE_SYNC_KEY || '';
      const validOps = pendingImportData.opportunities.filter((o: any) => o.importStatus !== 'error');
      
      const res = await fetch('/api/opportunities/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-key': syncKey
        },
        body: JSON.stringify(validOps)
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Successfully imported ${result.count} opportunities`);
        setIsImportInspectionOpen(false);
        setPendingImportData(null);
        fetchOpportunities();
      } else {
        const error = await res.json();
        alert(`Import failed: ${error.error}`);
      }
    } catch (err) {
      console.error('Finalize import error:', err);
      alert('Error committing import');
    }
  };

  if (loading && opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2 w-full space-y-2 font-sans mx-auto">
      {/* DCBA Hub - Compact Stats */}
      <div className="bg-white border border-slate-200 p-2 rounded-full flex flex-col md:flex-row items-center shadow-sm overflow-hidden w-full shrink-0 gap-2 md:gap-0 min-h-[60px]">
        <div className="px-4 flex flex-col shrink-0 text-center md:text-left border-r border-slate-100">
          <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-tighter leading-none tracking-widest">DCBA HUB</h2>
          <span className="text-[7px] font-black text-indigo-600 uppercase tracking-widest mt-0.5 leading-none">Portfolio Metrics</span>
        </div>

        <div className="flex-1 flex items-center justify-around px-2 gap-4 overflow-x-auto no-scrollbar">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total Pipeline</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-slate-900 tracking-tighter">₹ {Math.round(stats.totalValue)}</span>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Won Value</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-emerald-600 tracking-tighter">₹ {Math.round(stats.wonValue)}</span>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Active Leads</span>
            <span className="text-sm font-black text-slate-900 tracking-tighter">{stats.activeLeads}</span>
          </div>

          <div className="flex flex-col min-w-[100px]">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Win Prob.</span>
              <span className="text-[9px] font-black text-purple-600 leading-none">
                {stats.avgProb.toFixed(0)}%
              </span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: `${stats.avgProb}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Exhaustive Filters */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex flex-wrap items-end gap-1.5">
          <MultiSelect label="Vertical" options={masterConfig.verticals || []} selected={verticalFilter} onChange={setVerticalFilter} />
          <MultiSelect label="Domain" options={masterConfig.buDomains || []} selected={domainFilter} onChange={setDomainFilter} />
          <MultiSelect label="BU" options={masterConfig.businessUnits || []} selected={buFilter} onChange={setBuFilter} />
          <MultiSelect label="Type" options={masterConfig.projectTypes || []} selected={typeFilter} onChange={setTypeFilter} />
          <MultiSelect label="Family" options={masterConfig.productFamilies || []} selected={familyFilter} onChange={setFamilyFilter} />
          <MultiSelect label="Segment" options={masterConfig.segments || []} selected={segmentFilter} onChange={setSegmentFilter} />
          <MultiSelect label="Customer" options={masterConfig.customers || []} selected={customerFilter} onChange={setCustomerFilter} />
          <MultiSelect label="Stage" options={DCBA_STAGES.map(s => s.value)} selected={stageFilter} onChange={setStageFilter} />
          <MultiSelect label="Status" options={['Open', 'Won', 'Lost', 'On Hold', 'Past']} selected={statusFilter} onChange={status => { setStatusFilter(status); setPfsStatusFilter(['All']); }} />
          <MultiSelect label="Tech Sales" options={masterConfig.pmtTechSalesOptions || []} selected={pmtTechSalesFilter} onChange={setPmtTechSalesFilter} />
          <MultiSelect label="SW Health" options={['Green', 'Yellow', 'Red', 'TBC']} selected={swHealthFilter} onChange={setSwHealthFilter} />
          <MultiSelect label="HW Health" options={['Green', 'Yellow', 'Red', 'TBC']} selected={hwHealthFilter} onChange={setHwHealthFilter} />
          <MultiSelect label="ME Health" options={['Green', 'Yellow', 'Red', 'TBC']} selected={meHealthFilter} onChange={setMeHealthFilter} />
          <MultiSelect label="BU Health" options={['Green', 'Yellow', 'Red', 'TBC']} selected={buHealthFilter} onChange={setBuHealthFilter} />
          
          <button 
            onClick={() => {
              setVerticalFilter(['All']);
              setDomainFilter(['All']);
              setBuFilter(['All']);
              setTypeFilter(['All']);
              setFamilyFilter(['All']);
              setSegmentFilter(['All']);
              setCustomerFilter(['All']);
              setStageFilter(['All']);
              setStatusFilter(['All']);
              setPfsStatusFilter(['All']);
              setPmtTechSalesFilter(['All']);
              setSwHealthFilter(['All']);
              setHwHealthFilter(['All']);
              setMeHealthFilter(['All']);
              setBuHealthFilter(['All']);
              setSearch('');
            }}
            className="px-4 h-8 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm shrink-0 self-end"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-grow w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="QUICK SEARCH OPPORTUNITIES..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 h-10 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner placeholder:text-slate-300"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {viewMode === 'matrix' && (
              <button 
                onClick={() => setShowMatrixNumbers(!showMatrixNumbers)}
                className={`flex items-center gap-2 h-10 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all border ${showMatrixNumbers ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {showMatrixNumbers ? 'Hide Numbers' : 'Show Numbers'}
              </button>
            )}
            
            {viewMode === 'yoy' && (
              <div className="flex bg-slate-100 p-1 rounded-xl h-10">
                <button 
                  onClick={() => setYoyGrouping('domain')}
                  className={`px-4 rounded-lg text-[10px] font-black uppercase transition-all ${yoyGrouping === 'domain' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Domain
                </button>
                <button 
                  onClick={() => setYoyGrouping('vertical')}
                  className={`px-4 rounded-lg text-[10px] font-black uppercase transition-all ${yoyGrouping === 'vertical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Vertical
                </button>
              </div>
            )}

            <button 
              onClick={() => { 
                setEditingOpportunity(null); 
                setModalPrice(0);
                setModalVolume(0);
                setModalStage('T');
                setIsModalOpen(true); 
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              <Plus size={16} />
              New
            </button>

            {isAdmin && (
              <button 
                onClick={handleImportExcel}
                className="h-10 px-4 flex items-center gap-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"
              >
                <TableIcon size={16} />
                Import
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} />

            {isAdmin && (
              <button 
                onClick={() => setIsDeleteAllModalOpen(true)}
                className="h-10 px-4 flex items-center gap-2 bg-white border border-red-100 text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"
              >
                <Trash2 size={16} />
                Delete All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[2000px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[8px] uppercase tracking-[0.1em]">
                  <th className="px-1 py-1.5 font-bold text-center w-8 sticky left-0 bg-slate-900 z-30">#</th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors sticky left-8 bg-slate-900 z-30 w-12" onClick={() => requestSort('stage')}>
                    <div className="flex items-center">Stage <SortIcon columnKey="stage" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors sticky left-20 bg-slate-900 z-30 w-24" onClick={() => requestSort('rfiRfqReceiveDate')}>
                    <div className="flex items-center">RFI/Q Date <SortIcon columnKey="rfiRfqReceiveDate" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors sticky left-44 bg-slate-900 z-30 w-20" onClick={() => requestSort('vertical')}>
                    <div className="flex items-center">Vertical <SortIcon columnKey="vertical" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors sticky left-64 bg-slate-900 z-30 w-20" onClick={() => requestSort('domain')}>
                    <div className="flex items-center">Domain <SortIcon columnKey="domain" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors sticky left-[21rem] bg-slate-900 z-30 w-40" onClick={() => requestSort('productFamily')}>
                    <div className="flex items-center">Product Family <SortIcon columnKey="productFamily" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold sticky left-[31rem] bg-slate-900 z-30 w-60">Product Description</th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors sticky left-[46rem] bg-slate-900 z-30 w-40 border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.3)]" onClick={() => requestSort('customerName')}>
                    <div className="flex items-center">Customer <SortIcon columnKey="customerName" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('value')}>
                    <div className="flex items-center justify-center">Value <SortIcon columnKey="value" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('status')}>
                    <div className="flex items-center">Status <SortIcon columnKey="status" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('probability')}>
                    <div className="flex items-center justify-center">Prob. <SortIcon columnKey="probability" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('pfsStatus')}>
                    <div className="flex items-center">PFS Status <SortIcon columnKey="pfsStatus" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('pmtTechSales')}>
                    <div className="flex items-center">PMT Tech Sales <SortIcon columnKey="pmtTechSales" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => requestSort('marketingContact')}>
                    <div className="flex items-center">Marketing <SortIcon columnKey="marketingContact" /></div>
                  </th>
                  <th className="px-1 py-1.5 font-bold text-center w-10">SW</th>
                  <th className="px-1 py-1.5 font-bold text-center w-10">HW</th>
                  <th className="px-1 py-1.5 font-bold text-center w-10">ME</th>
                  <th className="px-1 py-1.5 font-bold text-center w-10">BU</th>
                  <th className="pl-8 pr-1 py-1.5 font-bold">Status Report / Remarks</th>
                  <th className="px-1 py-1.5 font-bold text-right sticky right-0 bg-slate-900 shadow-[-10px_0_15px_rgba(0,0,0,0.2)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedOpportunities.map((opp, idx) => {
                  const stageInfo = DCBA_STAGES.find(s => s.value === opp.stage);
                  return (
                    <tr key={opp.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-1 py-1.5 text-center text-[8px] font-bold text-slate-300 sticky left-0 bg-white group-hover:bg-slate-50 z-20">
                        {idx + 1}
                      </td>
                      <td className="px-1 py-1.5 sticky left-8 bg-white group-hover:bg-slate-50 z-20">
                        <div className={`w-5 h-5 rounded ${stageInfo?.color} flex items-center justify-center text-white font-black text-[8px] shadow-sm`}>
                          {opp.stage}
                        </div>
                      </td>
                      <td className="px-1 py-1.5 sticky left-20 bg-white group-hover:bg-slate-50 z-20 w-24">
                        <span className="text-[8px] font-bold text-slate-500">{opp.rfiRfqReceiveDate || '-'}</span>
                      </td>
                      <td className="px-1 py-1.5 sticky left-44 bg-white group-hover:bg-slate-50 z-20 w-20">
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-wider">{opp.vertical || '-'}</span>
                      </td>
                      <td className="px-1 py-1.5 sticky left-64 bg-white group-hover:bg-slate-50 z-20 w-20">
                        <span className="text-[8px] font-bold text-slate-600">{opp.domain}</span>
                      </td>
                      <td className="px-1 py-1.5 sticky left-[21rem] bg-white group-hover:bg-slate-50 z-20 w-40">
                        <p className="font-black text-slate-900 text-[9px] tracking-tight leading-tight">{opp.productFamily}</p>
                      </td>
                      <td className="px-1 py-1.5 sticky left-[31rem] bg-white group-hover:bg-slate-50 z-20 w-60">
                        <p className="text-[8px] text-slate-500 font-medium line-clamp-2 leading-tight">{opp.productDescription || '-'}</p>
                      </td>
                      <td className="px-1 py-1.5 sticky left-[46rem] bg-white group-hover:bg-slate-50 z-20 w-40 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        <span className="px-1 py-0.5 bg-slate-100 text-slate-700 rounded text-[7px] font-black uppercase tracking-widest">
                          {opp.customerName}
                        </span>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <span className="font-mono font-black text-indigo-600 text-[9px]">₹ {Math.round(opp.value)}</span>
                      </td>
                      <td className="px-1 py-1.5">
                        <span className={`px-1 py-0.5 rounded-full text-[6px] font-black uppercase tracking-widest ${
                          opp.status === 'Won' ? 'bg-emerald-100 text-emerald-700' :
                          opp.status === 'Lost' ? 'bg-red-100 text-red-700' :
                          opp.status === 'On Hold' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {opp.status}
                        </span>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[8px] font-black text-slate-700">{(opp.probability * 100).toFixed(0)}%</span>
                          <div className="w-6 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${opp.probability * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-1 py-1.5">
                        <span className="text-[8px] font-bold text-slate-500">{opp.pfsStatus || '-'}</span>
                      </td>
                      <td className="px-1 py-1.5">
                        <span className="text-[8px] font-bold text-slate-600">{opp.pmtTechSales || '-'}</span>
                      </td>
                      <td className="px-1 py-1.5">
                        <span className="text-[8px] font-bold text-slate-600">{opp.marketingContact || '-'}</span>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <StatusDot status={opp.sw} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <StatusDot status={opp.hw} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <StatusDot status={opp.me} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <StatusDot status={opp.bu} />
                      </td>
                      <td className="pl-8 pr-1 py-1.5 max-w-[150px]">
                        <p className="text-[8px] text-slate-400 font-medium truncate">
                          {Array.isArray(opp.remarks) && opp.remarks.length > 0 
                            ? opp.remarks[opp.remarks.length - 1].text 
                            : (typeof opp.remarks === 'string' ? opp.remarks : '-')}
                        </p>
                      </td>
                      <td className="px-1 py-1.5 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-10px_0_15px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-end gap-0.5">
                          <button 
                            onClick={() => { 
                              setEditingOpportunity(opp); 
                              setModalPrice(opp.tentativePrice || 0);
                              setModalVolume(opp.peakYearVolume || 0);
                              setModalStage(opp.stage || 'T');
                              setIsModalOpen(true); 
                            }}
                            className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                          >
                            <Edit2 size={10} />
                          </button>
                          <button 
                            onClick={() => { setOpportunityToDelete(opp); setIsDeleteModalOpen(true); }}
                            className="p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'matrix' ? (
        <GreenMatrix 
          masterConfig={masterConfig} 
          opportunities={filteredOpportunities} 
          onEdit={(opp) => {
            setEditingOpportunity(opp);
            setModalPrice(opp.tentativePrice || 0);
            setModalVolume(opp.peakYearVolume || 0);
            setModalStage(opp.stage || 'T');
            setIsModalOpen(true);
          }}
        />
      ) : viewMode === 'bcg' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">BCG Matrix</h3>
            <div className="text-sm font-bold text-slate-500">
              Probability vs Value
            </div>
          </div>
          <div className="h-[600px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Probability" 
                  unit="%" 
                  domain={[0, 100]} 
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Value" 
                  unit="" 
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                <ZAxis type="number" dataKey="z" range={[50, 1000]} name="Value" />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 z-50">
                          <p className="font-black text-sm mb-2">{data.name}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-slate-400">Probability:</span>
                            <span className="font-mono font-bold text-right">{data.x.toFixed(0)}%</span>
                            <span className="text-slate-400">Value:</span>
                            <span className="font-mono font-bold text-right text-emerald-400">₹ {data.y.toFixed(2)}</span>
                            <span className="text-slate-400">Stage:</span>
                            <span className="font-bold text-right">{data.stage}</span>
                            <span className="text-slate-400">SW/HW/ME/BU:</span>
                            <div className="flex justify-end gap-1 mt-0.5">
                              <StatusDot status={data.opp.sw} />
                              <StatusDot status={data.opp.hw} />
                              <StatusDot status={data.opp.me} />
                              <StatusDot status={data.opp.bu} />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  name="Opportunities" 
                  data={bcgData} 
                  fill="#8b5cf6"
                  onClick={(data) => {
                    if (data && data.opp) {
                      setEditingOpportunity(data.opp);
                      setModalPrice(data.opp.tentativePrice || 0);
                      setModalVolume(data.opp.peakYearVolume || 0);
                      setModalStage(data.opp.stage || 'T');
                      setIsModalOpen(true);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {bcgData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.status === 'Won' ? '#10b981' : entry.status === 'Lost' ? '#ef4444' : '#8b5cf6'} fillOpacity={0.7} />
                  ))}
                </Scatter>
                <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: '50%', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <ReferenceLine y={avgValue} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'Avg Value', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Stars</div>
              <div className="text-sm font-bold text-slate-700">High Prob, High Value</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Question Marks</div>
              <div className="text-sm font-bold text-slate-700">High Prob, Low Value</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Cash Cows</div>
              <div className="text-sm font-bold text-slate-700">Low Prob, High Value</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Dogs</div>
              <div className="text-sm font-bold text-slate-700">Low Prob, Low Value</div>
            </div>
          </div>
        </div>
      ) : viewMode === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch mb-12">
            {/* Domain Wise Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Domain Wise Break Up</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const rows = breakupStats.domains.map(d => {
                        const stats = breakupStats.domainData[d];
                        const target = dcbaTargets.domain[d] || 0;
                        const ach = target > 0 ? (stats.won / target) * 100 : 0;
                        return [d, Math.round(target), Math.round(stats.open), Math.round(stats.won), `${Math.round(ach)}%`];
                      });
                      const tTarget = Object.values(dcbaTargets.domain).reduce((a, b) => a + b, 0);
                      const tOpen = Object.values(breakupStats.domainData).reduce((a, b) => a + b.open, 0);
                      const tWon = Object.values(breakupStats.domainData).reduce((a, b) => a + b.won, 0);
                      const tAch = tTarget > 0 ? (tWon / tTarget) * 100 : 0;
                      const totals = ['TOTAL', Math.round(tTarget), Math.round(tOpen), Math.round(tWon), `${Math.round(tAch)}%`];
                      copyTableData('domain-breakup', 'Domain Wise Break Up', ['Domain', 'Target', 'Open', 'Won', '% Ach.'], rows, totals);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-md transition-all group flex items-center gap-1"
                    title="Copy Table"
                  >
                    {copiedId === 'domain-breakup' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400 group-hover:text-indigo-500" />}
                  </button>
                  <TrendingUp size={14} className="text-emerald-500" />
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-wider">
                      <th className="px-4 py-2.5 border-b border-slate-100">Domain</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Target</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Open</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Won</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">% Ach.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {breakupStats.domains.map(d => {
                      const stats = breakupStats.domainData[d];
                      const target = dcbaTargets.domain[d] || 0;
                      const ach = target > 0 ? (stats.won / target) * 100 : 0;
                      return (
                        <tr key={d} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-black text-slate-800 uppercase">{d}</td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {isAdmin ? (
                              <input 
                                type="number" 
                                value={target || ''} 
                                onChange={(e) => saveTargets({ ...dcbaTargets, domain: { ...dcbaTargets.domain, [d]: parseFloat(e.target.value) || 0 } })}
                                className="w-20 text-right bg-indigo-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded px-1.5 py-0.5 outline-none transition-all selection:bg-indigo-200 text-indigo-700 font-bold"
                                placeholder="0"
                              />
                            ) : (
                              <span className="text-slate-600">₹{Math.round(target)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500">₹{Math.round(stats.open)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-bold">₹{Math.round(stats.won)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`px-1.5 py-0.5 rounded font-black ${ach >= 100 ? 'bg-emerald-100 text-emerald-700' : ach > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                              {Math.round(ach)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Padding Rows for Symmetry */}
                    {Array.from({ length: Math.max(0, 5 - breakupStats.domains.length) }).map((_, i) => (
                      <tr key={`filler-dom-${i}`} className="border-none">
                        <td className="px-4 py-2.5" colSpan={5}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 bg-slate-900">
                <table className="w-full text-[10px] text-white font-black border-collapse">
                  <tbody>
                    {(() => {
                      const tTarget = Object.values(dcbaTargets.domain).reduce((a, b) => a + b, 0);
                      const tOpen = Object.values(breakupStats.domainData).reduce((a, b) => a + b.open, 0);
                      const tWon = Object.values(breakupStats.domainData).reduce((a, b) => a + b.won, 0);
                      const tAch = tTarget > 0 ? (tWon / tTarget) * 100 : 0;
                      return (
                        <tr>
                          <td className="px-4 py-3 uppercase tracking-widest text-[9px] w-[20%]">TOTAL</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tTarget)}</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tOpen)}</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tWon)}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-300 w-[20%]">
                            {Math.round(tAch)}%
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Segment Wise Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Segment Wise Break Up</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const rows = breakupStats.segments.map(s => {
                        const stats = breakupStats.segmentData[s];
                        const target = dcbaTargets.segment[s] || 0;
                        const ach = target > 0 ? (stats.won / target) * 100 : 0;
                        return [s, Math.round(target), Math.round(stats.open), Math.round(stats.won), `${Math.round(ach)}%`];
                      });
                      const tTarget = Object.values(dcbaTargets.segment).reduce((a, b) => a + b, 0);
                      const tOpen = Object.values(breakupStats.segmentData).reduce((a, b) => a + b.open, 0);
                      const tWon = Object.values(breakupStats.segmentData).reduce((a, b) => a + b.won, 0);
                      const tAch = tTarget > 0 ? (tWon / tTarget) * 100 : 0;
                      const totals = ['TOTAL', Math.round(tTarget), Math.round(tOpen), Math.round(tWon), `${Math.round(tAch)}%`];
                      copyTableData('segment-breakup', 'Segment Wise Break Up', ['Segment', 'Target', 'Open', 'Won', '% Ach.'], rows, totals);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-md transition-all group flex items-center gap-1"
                    title="Copy Table"
                  >
                    {copiedId === 'segment-breakup' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400 group-hover:text-indigo-500" />}
                  </button>
                  <Target size={14} className="text-indigo-500" />
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-wider">
                      <th className="px-4 py-2.5 border-b border-slate-100">Segment</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Target</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Open</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Won</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">% Ach.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {breakupStats.segments.map(s => {
                      const stats = breakupStats.segmentData[s];
                      const target = dcbaTargets.segment[s] || 0;
                      const ach = target > 0 ? (stats.won / target) * 100 : 0;
                      return (
                        <tr key={s} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-black text-slate-800 uppercase">{s}</td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {isAdmin ? (
                              <input 
                                type="number" 
                                value={target || ''} 
                                onChange={(e) => saveTargets({ ...dcbaTargets, segment: { ...dcbaTargets.segment, [s]: parseFloat(e.target.value) || 0 } })}
                                className="w-20 text-right bg-indigo-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded px-1.5 py-0.5 outline-none transition-all selection:bg-indigo-200 text-indigo-700 font-bold"
                                placeholder="0"
                              />
                            ) : (
                              <span className="text-slate-600">₹{Math.round(target)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500">₹{Math.round(stats.open)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-bold">₹{Math.round(stats.won)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`px-1.5 py-0.5 rounded font-black ${ach >= 100 ? 'bg-emerald-100 text-emerald-700' : ach > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                              {Math.round(ach)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Padding Rows for Symmetry */}
                    {Array.from({ length: Math.max(0, 5 - breakupStats.segments.length) }).map((_, i) => (
                      <tr key={`filler-seg-${i}`} className="border-none">
                        <td className="px-4 py-2.5" colSpan={5}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 bg-slate-900">
                <table className="w-full text-[10px] text-white font-black border-collapse">
                  <tbody>
                    {(() => {
                      const tTarget = Object.values(dcbaTargets.segment).reduce((a, b) => a + b, 0);
                      const tOpen = Object.values(breakupStats.segmentData).reduce((a, b) => a + b.open, 0);
                      const tWon = Object.values(breakupStats.segmentData).reduce((a, b) => a + b.won, 0);
                      const tAch = tTarget > 0 ? (tWon / tTarget) * 100 : 0;
                      return (
                        <tr>
                          <td className="px-4 py-3 uppercase tracking-widest text-[9px] w-[20%]">TOTAL</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tTarget)}</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tOpen)}</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tWon)}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-300 w-[20%]">
                            {Math.round(tAch)}%
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vertical Wise Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Vertical Wise Break Up</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const rows = breakupStats.verticals.map(v => {
                        const stats = breakupStats.verticalData[v];
                        const target = dcbaTargets.vertical[v] || 0;
                        const ach = target > 0 ? (stats.won / target) * 100 : 0;
                        return [v, Math.round(target), Math.round(stats.open), Math.round(stats.won), `${Math.round(ach)}%`];
                      });
                      const tTarget = Object.values(dcbaTargets.vertical).reduce((a, b) => a + b, 0);
                      const tOpen = Object.values(breakupStats.verticalData).reduce((a, b) => a + b.open, 0);
                      const tWon = Object.values(breakupStats.verticalData).reduce((a, b) => a + b.won, 0);
                      const tAch = tTarget > 0 ? (tWon / tTarget) * 100 : 0;
                      const totals = ['TOTAL', Math.round(tTarget), Math.round(tOpen), Math.round(tWon), `${Math.round(tAch)}%`];
                      copyTableData('vertical-breakup', 'Vertical Wise Break Up', ['Vertical', 'Target', 'Open', 'Won', '% Ach.'], rows, totals);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-md transition-all group flex items-center gap-1"
                    title="Copy Table"
                  >
                    {copiedId === 'vertical-breakup' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400 group-hover:text-indigo-500" />}
                  </button>
                  <Users size={14} className="text-purple-500" />
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-wider">
                      <th className="px-4 py-2.5 border-b border-slate-100">Vertical</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Target</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Open</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">Won</th>
                      <th className="px-4 py-2.5 border-b border-slate-100 text-right">% Ach.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {breakupStats.verticals.map(v => {
                      const stats = breakupStats.verticalData[v];
                      const target = dcbaTargets.vertical[v] || 0;
                      const ach = target > 0 ? (stats.won / target) * 100 : 0;
                      return (
                        <tr key={v} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-black text-slate-800 uppercase">{v}</td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {isAdmin ? (
                              <input 
                                type="number" 
                                value={target || ''} 
                                onChange={(e) => saveTargets({ ...dcbaTargets, vertical: { ...dcbaTargets.vertical, [v]: parseFloat(e.target.value) || 0 } })}
                                className="w-20 text-right bg-indigo-50 border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 rounded px-1.5 py-0.5 outline-none transition-all selection:bg-indigo-200 text-indigo-700 font-bold"
                                placeholder="0"
                              />
                            ) : (
                              <span className="text-slate-600">₹{Math.round(target)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500">₹{Math.round(stats.open)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-bold">₹{Math.round(stats.won)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`px-1.5 py-0.5 rounded font-black ${ach >= 100 ? 'bg-emerald-100 text-emerald-700' : ach > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                              {Math.round(ach)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Padding Rows for Symmetry */}
                    {Array.from({ length: Math.max(0, 5 - breakupStats.verticals.length) }).map((_, i) => (
                      <tr key={`filler-vert-${i}`} className="border-none">
                        <td className="px-4 py-2.5" colSpan={5}>&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 bg-slate-900">
                <table className="w-full text-[10px] text-white font-black border-collapse">
                  <tbody>
                    {(() => {
                      const tTarget = Object.values(dcbaTargets.vertical).reduce((a, b) => a + b, 0);
                      const tOpen = Object.values(breakupStats.verticalData).reduce((a, b) => a + b.open, 0);
                      const tWon = Object.values(breakupStats.verticalData).reduce((a, b) => a + b.won, 0);
                      const tAch = tTarget > 0 ? (tWon / tTarget) * 100 : 0;
                      return (
                        <tr>
                          <td className="px-4 py-3 uppercase tracking-widest text-[9px] w-[20%]">TOTAL</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tTarget)}</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tOpen)}</td>
                          <td className="px-4 py-3 text-right font-mono w-[20%]">₹{Math.round(tWon)}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-300 w-[20%]">
                            {Math.round(tAch)}%
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Status Summary</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const statuses = ['green', 'yellow', 'red', 'tbc'] as const;
                    const cats = ['sw', 'hw', 'me', 'bu'] as const;
                    const rows = statuses.map(s => {
                      const rowTotal = cats.reduce((sum, cat) => sum + dashboardStats[cat][s], 0);
                      return [s.toUpperCase(), ...cats.map(cat => dashboardStats[cat][s]), rowTotal];
                    });
                    const grandTotal = cats.map(cat => statuses.reduce((sum, st) => sum + dashboardStats[cat][st], 0));
                    const totals = ['TOTAL', ...grandTotal, filteredOpportunities.length];
                    copyTableData('status-summary', 'Status Summary', ['Status', 'SW', 'HW', 'ME', 'BU', 'Total'], rows, totals);
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-md transition-all group flex items-center gap-1"
                  title="Copy Table"
                >
                  {copiedId === 'status-summary' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400 group-hover:text-indigo-500" />}
                </button>
                <LayoutGrid size={14} className="text-indigo-500" />
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-wider">
                    <th className="px-4 py-2.5 border-b border-slate-100">Status</th>
                    {(['sw', 'hw', 'me', 'bu'] as const).map(cat => (
                      <th key={cat} className="px-4 py-2.5 border-b border-slate-100 text-center uppercase">{cat}</th>
                    ))}
                    <th className="px-4 py-2.5 border-b border-slate-100 text-center bg-slate-50/50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(['green', 'yellow', 'red', 'tbc'] as const).map((status) => {
                    const rowTotal = (['sw', 'hw', 'me', 'bu'] as const).reduce((sum, cat) => sum + dashboardStats[cat][status], 0);
                    const statusConfig = {
                      green: { label: 'Green', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                      yellow: { label: 'Yellow', color: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
                      red: { label: 'Red', color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' },
                      tbc: { label: 'TBC', color: 'bg-slate-300', text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' }
                    }[status];

                    return (
                      <tr key={status} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-black text-slate-800 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
                            <span>{statusConfig.label}</span>
                          </div>
                        </td>
                        {(['sw', 'hw', 'me', 'bu'] as const).map(cat => (
                          <td key={cat} className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[24px] h-5 rounded px-1.5 ${statusConfig.bg} ${statusConfig.text} font-mono font-black text-[9px] border ${statusConfig.border}`}>
                              {dashboardStats[cat][status]}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center bg-slate-50/30 border-l border-slate-100">
                          <span className="font-mono font-black text-slate-900">
                            {rowTotal}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 bg-slate-900">
              <table className="w-full text-[10px] text-white font-black border-collapse">
                <tbody>
                  <tr>
                    <td className="px-4 py-3 uppercase tracking-widest text-[9px]">TOTAL</td>
                    {(['sw', 'hw', 'me', 'bu'] as const).map(cat => {
                      const catTotal = (['green', 'yellow', 'red', 'tbc'] as const).reduce((sum, status) => sum + dashboardStats[cat][status], 0);
                      return (
                        <td key={cat} className="px-4 py-3 text-center font-mono">
                          {catTotal}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-mono text-emerald-300">
                      {filteredOpportunities.length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Year-over-Year Analysis</h3>
            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setYoyGrouping('domain')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${yoyGrouping === 'domain' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Domain
                </button>
                <button 
                  onClick={() => setYoyGrouping('vertical')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${yoyGrouping === 'vertical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Vertical
                </button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setYoyViewType('tabular')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${yoyViewType === 'tabular' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Tabular
                </button>
                <button 
                  onClick={() => setYoyViewType('graphical')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${yoyViewType === 'graphical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Graphical
                </button>
              </div>
            </div>
          </div>

          {yoyViewType === 'graphical' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-[400px]">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Pipeline Value</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yoyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fy" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [`₹${val.toFixed(0)}`, '']}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar dataKey="totalValue" name="Total Pipeline" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="wonValue" name="Won Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[400px]">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Opportunity Count</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yoyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fy" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar dataKey="count" name="Opportunities" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.2em]">
                    <th className="px-6 py-4 font-black sticky left-0 bg-slate-900 z-10">Product Family</th>
                    <th className="px-6 py-4 font-black">BU</th>
                    {yoyTabularData.fyList.map(fy => (
                      <th key={fy} className="px-6 py-4 text-right font-black">{fy}</th>
                    ))}
                    <th className="px-6 py-4 text-right font-black bg-slate-800">Cumulative</th>
                  </tr>
                  <tr className="bg-slate-100 text-slate-900 text-[10px] font-black uppercase">
                    <td className="px-6 py-3 sticky left-0 bg-slate-100 z-10">Total Actual</td>
                    <td className="px-6 py-3"></td>
                    {yoyTabularData.fyList.map(fy => (
                      <td key={fy} className="px-6 py-3 text-right font-mono">₹ {yoyTabularData.grandTotals[fy].toFixed(0)}</td>
                    ))}
                    <td className="px-6 py-3 text-right font-mono bg-slate-200">₹ {yoyTabularData.grandCumulative.toFixed(0)}</td>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-slate-600">
                  {yoyTabularData.data.map((group) => (
                    <React.Fragment key={group.groupName}>
                      {/* Group Level */}
                      <tr 
                        className="bg-slate-200 font-black text-slate-900 uppercase text-[10px] cursor-pointer hover:bg-slate-300 transition-colors"
                        onClick={() => toggleItem(`group:${group.groupName}`)}
                      >
                        <td className="px-6 py-1.5 sticky left-0 bg-slate-200 z-10" colSpan={2}>
                          <div className="flex items-center gap-2">
                            {expandedItems[`group:${group.groupName}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {group.groupName}
                          </div>
                        </td>
                        {yoyTabularData.fyList.map(fy => {
                          const val = group.groupTotals[fy];
                          const opacity = yoyTabularData.maxGroupVal > 0 ? (val / yoyTabularData.maxGroupVal) * 0.4 : 0;
                          return (
                            <td 
                              key={fy} 
                              className="px-6 py-1.5 text-right font-mono"
                              style={val > 0 ? { backgroundColor: `rgba(99, 102, 241, ${opacity})` } : {}}
                            >
                              ₹ {val.toFixed(0)}
                            </td>
                          );
                        })}
                        <td className="px-6 py-1.5 text-right font-mono bg-slate-300">₹ {group.groupCumulative.toFixed(0)}</td>
                      </tr>

                      {/* Family Level */}
                      {expandedItems[`group:${group.groupName}`] && group.familyGroups.map((familyGroup) => (
                        <React.Fragment key={familyGroup.family}>
                          <tr 
                            className="bg-slate-50/50 font-black text-slate-900 uppercase text-[10px] cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => toggleItem(`family:${group.groupName}:${familyGroup.family}`)}
                          >
                            <td className="px-6 py-1.5 pl-10 sticky left-0 bg-slate-50 z-10" colSpan={2}>
                              <div className="flex items-center gap-2">
                                {expandedItems[`family:${group.groupName}:${familyGroup.family}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {familyGroup.family}
                              </div>
                            </td>
                            {yoyTabularData.fyList.map(fy => {
                              const val = familyGroup.familyTotals[fy];
                              const opacity = yoyTabularData.maxFamilyVal > 0 ? (val / yoyTabularData.maxFamilyVal) * 0.4 : 0;
                              return (
                                <td 
                                  key={fy} 
                                  className="px-6 py-1.5 text-right font-mono"
                                  style={val > 0 ? { backgroundColor: `rgba(99, 102, 241, ${opacity})` } : {}}
                                >
                                  ₹ {val.toFixed(0)}
                                </td>
                              );
                            })}
                            <td className="px-6 py-1.5 text-right font-mono bg-slate-100">₹ {familyGroup.familyCumulative.toFixed(0)}</td>
                          </tr>

                          {/* Product Description Level */}
                          {expandedItems[`family:${group.groupName}:${familyGroup.family}`] && familyGroup.rows.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-2 pl-16 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-bold text-slate-700">{row.description}</td>
                              <td className="px-6 py-2 text-[9px] font-black text-slate-400 uppercase">{row.bu}</td>
                              {yoyTabularData.fyList.map(fy => {
                                const val = row.fyValues[fy];
                                const opacity = yoyTabularData.maxRowVal > 0 ? (val / yoyTabularData.maxRowVal) * 0.5 : 0;
                                const isHeatmap = val > 0;
                                return (
                                  <td 
                                    key={fy} 
                                    className={`px-6 py-2 text-right font-mono transition-colors ${isHeatmap ? 'text-slate-900 font-bold' : 'text-slate-400'}`}
                                    style={isHeatmap ? { backgroundColor: `rgba(99, 102, 241, ${opacity})` } : {}}
                                  >
                                    {val > 0 ? `₹ ${val.toFixed(0)}` : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-2 text-right font-mono font-black text-indigo-600 bg-slate-50/30">₹ {row.cumulative.toFixed(0)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden animate-scaleIn">
            <div className="bg-slate-900 px-10 py-8 text-white flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                  {editingOpportunity ? 'Edit Opportunity' : 'New Opportunity'}
                </h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  Opportunity Master Record
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-10 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Basic Information</h3>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vertical</label>
                    <select name="vertical" defaultValue={editingOpportunity?.vertical} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select Vertical</option>
                      {(masterConfig.verticals || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Domain</label>
                    <select name="domain" defaultValue={editingOpportunity?.domain} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select Domain</option>
                      {(masterConfig.buDomains || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Unit</label>
                    <select name="businessUnit" defaultValue={editingOpportunity?.businessUnit} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select BU</option>
                      {(masterConfig.businessUnits || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product Family</label>
                    <select name="productFamily" defaultValue={editingOpportunity?.productFamily} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select Product Family</option>
                      {(masterConfig.productFamilies || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product Description</label>
                    <textarea name="productDescription" rows={2} defaultValue={editingOpportunity?.productDescription} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm resize-none" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</label>
                    <select name="customerName" defaultValue={editingOpportunity?.customerName} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select Customer</option>
                      {(masterConfig.customers || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Segment</label>
                    <select name="segment" defaultValue={editingOpportunity?.segment} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select Segment</option>
                      {(masterConfig.segments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
                    <select name="type" defaultValue={editingOpportunity?.type || 'Anchor'} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="Anchor">Anchor</option>
                      <option value="HD">HD</option>
                      <option value="Transferred">Transferred</option>
                      <option value="R&D PFS">R&D PFS</option>
                      <option value="PoC">PoC</option>
                      <option value="Engineering Service">Engineering Service</option>
                      <option value="Potential C2B">Potential C2B</option>
                      <option value="NA">NA</option>
                    </select>
                  </div>
                </div>

                {/* DCBA Stage & Financials */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Stage & Financials</h3>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DCBA Stage</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DCBA_STAGES.map(s => (
                        <label 
                          key={s.value} 
                          className={`
                            relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all
                            ${modalStage === s.value ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}
                          `}
                        >
                          <input 
                            type="radio" 
                            name="stage" 
                            value={s.value} 
                            checked={modalStage === s.value}
                            className="sr-only" 
                            onChange={(e) => setModalStage(e.target.value as any)}
                          />
                          <span className="text-lg font-black leading-none">{s.value}</span>
                          <span className="text-[8px] font-bold uppercase mt-1 text-center">{s.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tentative Price (Potential Kit Value)</label>
                      <input 
                        name="tentativePrice" 
                        type="number" 
                        step="0.01" 
                        value={modalPrice || ''} 
                        onChange={(e) => setModalPrice(parseFloat(e.target.value) || 0)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peak Yr Vol</label>
                      <input 
                        name="peakYearVolume" 
                        type="number" 
                        value={modalVolume || ''} 
                        onChange={(e) => setModalVolume(parseInt(e.target.value) || 0)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Potential Value</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input 
                        name="value" 
                        type="number" 
                        step="0.01" 
                        value={((modalPrice * modalVolume) / 10000000).toFixed(0)} 
                        readOnly
                        className="w-full pl-8 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none font-black text-sm text-indigo-600" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Win Probability (%)</label>
                    <input 
                      name="probability" 
                      type="number" 
                      min="0" 
                      max="100" 
                      defaultValue={editingOpportunity ? (editingOpportunity.probability * 100) : 50} 
                      required 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                    <select name="status" defaultValue={editingOpportunity?.status || 'Open'} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="Open">Open</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Past">Past</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PFS Status</label>
                    <select name="pfsStatus" defaultValue={editingOpportunity?.pfsStatus} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                      <option value="">Select PFS Status</option>
                      {(masterConfig.pfsStatuses || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                {/* Timeline & Others */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Timeline & Details</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fiscal Year</label>
                      <select name="fiscalYear" defaultValue={editingOpportunity?.fiscalYear || (selectedFY !== 'All FY' ? selectedFY : '')} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                        <option value="">Select FY</option>
                        {ALL_FISCAL_YEARS.filter(fy => fy !== 'All FY').map(fy => <option key={fy} value={fy}>{fy}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SOP Date (Planned Date)</label>
                      <input name="sopDate" type="month" defaultValue={monthToYYYYMM(editingOpportunity?.sopDate)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RFI/Q Receive Date</label>
                      <input name="rfiRfqReceiveDate" type="month" defaultValue={monthToYYYYMM(editingOpportunity?.rfiRfqReceiveDate)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target LOI Date</label>
                      <input name="targetLoiDate" type="month" defaultValue={monthToYYYYMM(editingOpportunity?.targetLoiDate)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Actual LOI Date</label>
                      <input name="actualLoiDate" type="month" defaultValue={monthToYYYYMM(editingOpportunity?.actualLoiDate)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PMT Tech Sales</label>
                      <select name="pmtTechSales" defaultValue={editingOpportunity?.pmtTechSales} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                        <option value="">Select Tech Sales</option>
                        {(masterConfig.pmtTechSalesOptions || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Marketing Contact (Head Marketing)</label>
                    <input name="marketingContact" type="text" defaultValue={editingOpportunity?.marketingContact} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SW</label>
                      <select name="sw" defaultValue={editingOpportunity?.sw} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs">
                        <option value="">Status</option>
                        <option value="Green">Green</option>
                        <option value="Yellow">Yellow</option>
                        <option value="Red">Red</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HW</label>
                      <select name="hw" defaultValue={editingOpportunity?.hw} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs">
                        <option value="">Status</option>
                        <option value="Green">Green</option>
                        <option value="Yellow">Yellow</option>
                        <option value="Red">Red</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ME</label>
                      <select name="me" defaultValue={editingOpportunity?.me} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs">
                        <option value="">Status</option>
                        <option value="Green">Green</option>
                        <option value="Yellow">Yellow</option>
                        <option value="Red">Red</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BU</label>
                      <select name="bu" defaultValue={editingOpportunity?.bu} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs">
                        <option value="">Status</option>
                        <option value="Green">Green</option>
                        <option value="Yellow">Yellow</option>
                        <option value="Red">Red</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Latest Status / Remarks</label>
                    <textarea 
                      name="remarks" 
                      rows={3} 
                      defaultValue={Array.isArray(editingOpportunity?.remarks) && editingOpportunity.remarks.length > 0 
                        ? editingOpportunity.remarks[editingOpportunity.remarks.length - 1].text 
                        : (typeof editingOpportunity?.remarks === 'string' ? editingOpportunity.remarks : '')} 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm resize-none" 
                    />
                    
                    {Array.isArray(editingOpportunity?.remarks) && editingOpportunity.remarks.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-[150px] overflow-y-auto pr-2 no-scrollbar">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">History</span>
                        {editingOpportunity.remarks.slice().reverse().map((r, i) => (
                          <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[7px] font-black text-indigo-600 uppercase tracking-widest">{r.username}</span>
                              <span className="text-[7px] font-bold text-slate-400">{new Date(r.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[9px] font-bold text-slate-600 leading-tight">{r.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-end gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button type="submit" className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 transition-all active:scale-95">
                  {editingOpportunity ? 'Update Opportunity' : 'Create Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DCBAImportInspectionModal 
        isOpen={isImportInspectionOpen} 
        data={pendingImportData} 
        onClose={() => { setIsImportInspectionOpen(false); setPendingImportData(null); }} 
        onConfirm={finalizeImport} 
      />

      {isDeleteModalOpen && opportunityToDelete && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
            <div className="bg-[#e31e24] px-8 py-5 text-white shrink-0">
              <h3 className="text-lg font-black uppercase tracking-tight leading-none">Confirm Deletion</h3>
              <p className="text-[9px] font-black opacity-80 uppercase mt-1.5 tracking-[0.2em]">Permanent Opportunity Removal</p>
            </div>
            <div className="px-8 py-10 bg-white">
              <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight">
                Are you sure you want to delete the opportunity <span className="text-[#e31e24] font-black">"{opportunityToDelete.customerName}"</span>? This action is irreversible.
              </p>
            </div>
            <div className="px-8 py-5 bg-[#f8fafc] border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors order-2 sm:order-1">Abort</button>
              <button 
                onClick={() => handleDelete(opportunityToDelete.id)} 
                className="w-full sm:w-auto bg-[#e31e24] text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all order-1 sm:order-2"
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
            <div className="bg-[#e31e24] px-8 py-5 text-white shrink-0">
              <h3 className="text-lg font-black uppercase tracking-tight leading-none">Confirm Purge</h3>
              <p className="text-[9px] font-black opacity-80 uppercase mt-1.5 tracking-[0.2em]">Permanent System Purge</p>
            </div>
            <div className="px-8 py-10 bg-white">
              <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight">
                Are you sure you want to <span className="text-[#e31e24] font-black">PURGE ALL OPPORTUNITIES</span> from the registry? This action is irreversible and will wipe all data.
              </p>
            </div>
            <div className="px-8 py-5 bg-[#f8fafc] border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <button onClick={() => setIsDeleteAllModalOpen(false)} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors order-2 sm:order-1">Abort</button>
              <button 
                onClick={handleDeleteAll} 
                className="w-full sm:w-auto bg-[#e31e24] text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all order-1 sm:order-2"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DCBAImportInspectionModal = ({ isOpen, data, onClose, onConfirm }: { 
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
              <h3 className="text-2xl font-black uppercase tracking-tight">Importing Opportunities</h3>
              <p className="text-[10px] font-black opacity-70 uppercase mt-1 tracking-widest">Validating External Data Payload for DCBA Portal</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          <div className="flex wrap gap-4 mt-6">
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
              <span className="text-[8px] font-black uppercase opacity-60 block">Total Entries</span>
              <span className="text-xl font-black none">{data.summary.total}</span>
            </div>
            <div className="bg-emerald-50/20 px-4 py-2 rounded-xl border border-emerald-500/20">
              <span className="text-[8px] font-black uppercase opacity-60 block">Valid New</span>
              <span className="text-xl font-black none">{data.summary.valid}</span>
            </div>
            <div className="bg-blue-50/20 px-4 py-2 rounded-xl border border-blue-500/20">
              <span className="text-[8px] font-black uppercase opacity-60 block">Updates</span>
              <span className="text-xl font-black none">{data.summary.updates}</span>
            </div>
            <div className="bg-red-50/20 px-4 py-2 rounded-xl border border-red-500/20">
              <span className="text-[8px] font-black uppercase opacity-60 block">Errors</span>
              <span className="text-xl font-black none">{data.summary.errors}</span>
            </div>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-6 no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product Family</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status Report</th>
                <th className="px-4 py-3">Validation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.opportunities.map((p: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors h-12">
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-[7px] font-black uppercase ${
                      p.importStatus === 'valid' ? 'bg-emerald-50 text-emerald-600' :
                      p.importStatus === 'update' ? 'bg-blue-50 text-blue-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {p.importStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase truncate max-w-[150px]">{p.customerName}</td>
                  <td className="px-4 py-2 text-[10px] font-bold text-slate-500">{p.productFamily}</td>
                  <td className="px-4 py-2 text-[10px] font-black text-slate-900">₹ {p.value.toFixed(2)}</td>
                  <td className="px-4 py-2 text-[8px] font-bold text-slate-500 truncate max-w-[150px]">
                    {p.remarks && p.remarks.length > 0 ? p.remarks[p.remarks.length - 1].text : 'No update'}
                  </td>
                  <td className="px-4 py-2">
                    {p.errors?.length > 0 ? (
                      <div className="text-[8px] text-red-500 font-bold uppercase depth-tight">
                        {p.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                      </div>
                    ) : (
                      <span className="text-[8px] text-slate-300 font-black uppercase">Protocol Compliant</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <button onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700">Abort Import</button>
          <button 
            onClick={onConfirm} 
            disabled={data.summary.valid === 0 && data.summary.updates === 0}
            className="bg-indigo-600 text-white px-12 py-4 rounded-2xl w-full sm:w-auto text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Finalize & Commit Opportunities
          </button>
        </div>
      </div>
    </div>
  );
};
