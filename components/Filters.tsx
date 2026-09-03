import React, { useState, useRef, useEffect } from 'react';
import { FiscalMode } from '../types';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (opt === 'All') {
      onChange(['All']);
    } else {
      let next = selected.includes('All') ? [] : [...selected];
      if (next.includes(opt)) {
        next = next.filter(i => i !== opt);
      } else {
        next.push(opt);
      }
      if (next.length === 0) next = ['All'];
      onChange(next);
    }
  };

  const filteredOptions = options.filter(o => o !== 'All' && o.toLowerCase().includes(search.toLowerCase()));
  const isAllSelected = selected.includes('All');
  
  const displayLabel = () => {
    if (isAllSelected) return label;
    if (selected.length === 1) return selected[0];
    return `${label} (${selected.length})`;
  };

  return (
    <div className="flex flex-col space-y-0.5 min-w-[80px] flex-grow relative" ref={containerRef}>
      <label className="text-[6px] font-black text-slate-400 uppercase tracking-tighter leading-none pl-1 mb-0.5">{label}</label>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-slate-200'} rounded-md px-2 py-0.5 text-[8px] font-black uppercase shadow-xs flex items-center justify-between transition-all h-6 truncate`}
      >
        <span className={isAllSelected ? 'text-slate-400' : 'text-indigo-600'}>{displayLabel()}</span>
        <svg className={`w-2.5 h-2.5 ml-2 transition-transform ${isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M19 9l-7 7-7-7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl z-[200] overflow-hidden animate-fadeIn py-1">
          <div className="p-2 border-b border-slate-50 mb-1">
            <input 
              autoFocus
              type="text" 
              placeholder="Search..." 
              className="w-full bg-slate-50 border border-slate-100 rounded-md px-2 py-1 text-[9px] font-bold outline-none focus:ring-1 focus:ring-indigo-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto no-scrollbar py-1">
            <label 
              className={`flex items-center px-3 py-1.5 hover:bg-indigo-50 cursor-pointer transition-colors group ${isAllSelected ? 'bg-indigo-50/40' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleOption('All'); }}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                isAllSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'
              }`}>
                {isAllSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className={`ml-2.5 text-[9px] font-black uppercase tracking-tight ${isAllSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                All
              </span>
            </label>
            {filteredOptions.map(opt => {
              const isSelected = selected.includes(opt);
              return (
                <label 
                  key={opt} 
                  className={`flex items-center px-3 py-1.5 hover:bg-indigo-50 cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50/40' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleOption(opt); }}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'
                  }`}>
                    {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`ml-2.5 text-[9px] font-black uppercase tracking-tight ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                    {opt}
                  </span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && search && (
              <div className="px-4 py-4 text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface FilterBarProps {
  filters: any;
  setFilters: (f: any) => void;
  dynamicOptions: any;
  authorizedVerticals: string[];
  actionButtons?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  setFilters, 
  dynamicOptions, 
  authorizedVerticals, 
  actionButtons
}) => {
  const updateFilter = (key: string, val: string[]) => setFilters({ ...filters, [key]: val });
  
  const resetFilters = () => setFilters({ 
    search: '', 
    projectId: ['All'],
    vertical: ['All'], 
    domain: ['All'], 
    bu: ['All'], 
    customer: ['All'],
    projectType: ['All'], 
    tbc: ['Yes'], 
    category: ['All'], 
    family: ['All'], 
    pdh: ['All'],
    generation: ['All']
  });

  return (
    <div className="bg-white border border-slate-200 p-2 rounded-2xl space-y-2 shadow-xs">
      <div className="flex flex-wrap items-end gap-1">
        <MultiSelect label="PROJECT ID" selected={filters.projectId} options={dynamicOptions.projectId || ['All']} onChange={v => updateFilter('projectId', v)} />
        <MultiSelect label="VERTICAL" selected={filters.vertical} options={authorizedVerticals} onChange={v => updateFilter('vertical', v)} />
        <MultiSelect label="DOMAIN" selected={filters.domain} options={dynamicOptions.domain} onChange={v => updateFilter('domain', v)} />
        <MultiSelect label="BU" selected={filters.bu} options={dynamicOptions.bu} onChange={v => updateFilter('bu', v)} />
        <MultiSelect label="CUSTOMER" selected={filters.customer || ['All']} options={dynamicOptions.customer || ['All']} onChange={v => updateFilter('customer', v)} />
        <MultiSelect label="TYPE" selected={filters.projectType} options={dynamicOptions.projectType} onChange={v => updateFilter('projectType', v)} />
        <MultiSelect label="FAMILY" selected={filters.family} options={dynamicOptions.family} onChange={v => updateFilter('family', v)} />
        <MultiSelect label="CATEGORY" selected={filters.category} options={dynamicOptions.category} onChange={v => updateFilter('category', v)} />
        <MultiSelect label="TBC" selected={filters.tbc} options={dynamicOptions.tbc} onChange={v => updateFilter('tbc', v)} />
        <MultiSelect label="PDH" selected={filters.pdh} options={dynamicOptions.pdh} onChange={v => updateFilter('pdh', v)} />
        <MultiSelect label="GENERATION" selected={filters.generation || ['All']} options={dynamicOptions.generation || ['All', 'Current', 'Level Up + 1', 'Level Up + 2']} onChange={v => updateFilter('generation', v)} />
        
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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner h-8" 
            value={filters.search} 
            onChange={e => setFilters({ ...filters, search: e.target.value })} 
          />
        </div>
        {actionButtons && <div className="flex items-center gap-1 shrink-0">{actionButtons}</div>}
      </div>
    </div>
  );
};