import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SlidersHorizontal, RotateCcw, Search, X, ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  compact?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange, compact = false }) => {
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

  const filteredOptions = (options || []).filter(o => o !== 'All' && String(o).toLowerCase().includes(search.toLowerCase()));
  const isAllSelected = !selected || selected.length === 0 || selected.includes('All');
  
  const displayLabel = () => {
    if (isAllSelected) return label;
    if (selected.length === 1) return `${label}: ${selected[0]}`;
    return `${label} (${selected.length})`;
  };

  return (
    <div className={`relative ${isOpen ? 'z-[100]' : 'z-[10]'} ${compact ? 'min-w-[110px]' : 'min-w-[125px] flex-1 max-w-[180px]'}`} ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-50 bg-white'
            : !isAllSelected
            ? 'border-indigo-200 bg-indigo-50/60 text-indigo-700'
            : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-600'
        } rounded-xl px-2.5 h-8 text-[9px] font-black uppercase tracking-wider flex items-center justify-between gap-1.5 transition-all truncate`}
        title={displayLabel()}
      >
        <span className={`truncate ${isAllSelected ? 'text-slate-500' : 'text-indigo-700'}`}>
          {displayLabel()}
        </span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : !isAllSelected ? 'text-indigo-500' : 'text-slate-400'}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl z-[300] overflow-hidden animate-fadeIn py-1">
          <div className="p-2 border-b border-slate-100">
            <input 
              autoFocus
              type="text" 
              placeholder={`Filter ${label.toLowerCase()}...`} 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto no-scrollbar py-1">
            <label 
              className={`flex items-center px-3 py-1.5 hover:bg-indigo-50 cursor-pointer transition-colors group ${isAllSelected ? 'bg-indigo-50/40' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleOption('All'); }}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                isAllSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'
              }`}>
                {isAllSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
              </div>
              <span className={`ml-2.5 text-[10px] font-black uppercase tracking-tight ${isAllSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                All {label}
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
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </div>
                  <span className={`ml-2.5 text-[10px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                    {opt}
                  </span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && search && (
              <div className="px-4 py-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">No matches</div>
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
  const [showMoreFilters, setShowMoreFilters] = useState(false);

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

  const isActive = (arr: string[] | undefined, defaultVal = 'All') => {
    if (!arr || arr.length === 0) return false;
    if (arr.length === 1 && arr[0] === defaultVal) return false;
    return true;
  };

  // Count how many secondary filters are active
  const secondaryActiveCount = useMemo(() => {
    let count = 0;
    if (isActive(filters.projectId)) count++;
    if (isActive(filters.bu)) count++;
    if (isActive(filters.customer)) count++;
    if (isActive(filters.projectType)) count++;
    if (isActive(filters.tbc) && !(filters.tbc.length === 1 && filters.tbc[0] === 'Yes')) count++;
    if (isActive(filters.pdh)) count++;
    if (isActive(filters.generation)) count++;
    return count;
  }, [filters]);

  const totalActiveCount = useMemo(() => {
    let count = secondaryActiveCount;
    if (filters.search?.trim()) count++;
    if (isActive(filters.vertical)) count++;
    if (isActive(filters.domain)) count++;
    if (isActive(filters.family)) count++;
    if (isActive(filters.category)) count++;
    return count;
  }, [filters, secondaryActiveCount]);

  return (
    <div className="relative z-[60] bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-xs space-y-2">
      {/* Single Clean Primary Toolbar Row */}
      <div className="relative z-[30] flex flex-wrap items-center gap-2">
        {/* Quick Search */}
        <div className="relative min-w-[200px] sm:w-60 flex-grow sm:flex-grow-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search project, code, family..." 
            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-8 pr-7 h-8 text-[10px] font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all" 
            value={filters.search || ''} 
            onChange={e => setFilters({ ...filters, search: e.target.value })} 
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* 4 Core Primary Filters */}
        <div className="flex flex-wrap items-center gap-1.5 flex-grow">
          <MultiSelect label="Vertical" selected={filters.vertical} options={authorizedVerticals} onChange={v => updateFilter('vertical', v)} />
          <MultiSelect label="Domain" selected={filters.domain} options={dynamicOptions.domain || ['All']} onChange={v => updateFilter('domain', v)} />
          <MultiSelect label="Family" selected={filters.family} options={dynamicOptions.family || ['All']} onChange={v => updateFilter('family', v)} />
          <MultiSelect label="Category" selected={filters.category} options={dynamicOptions.category || ['All']} onChange={v => updateFilter('category', v)} />

          {/* More Filters Drawer Button */}
          <button
            type="button"
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`h-8 px-3 rounded-xl border text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
              showMoreFilters || secondaryActiveCount > 0
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>More Filters</span>
            {secondaryActiveCount > 0 && (
              <span className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full leading-tight">
                {secondaryActiveCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Reset Button */}
          {totalActiveCount > 0 && (
            <button 
              type="button"
              onClick={resetFilters} 
              className="h-8 px-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 text-[9px] font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1 shrink-0"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Context Action Buttons (Only passed when in List View) */}
        {actionButtons && (
          <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2 border-l border-slate-100">
            {actionButtons}
          </div>
        )}
      </div>

      {/* Collapsible Secondary Filter Tray */}
      {showMoreFilters && (
        <div className="relative z-[20] pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1.5">Advanced:</span>
          <MultiSelect compact label="Project ID" selected={filters.projectId} options={dynamicOptions.projectId || ['All']} onChange={v => updateFilter('projectId', v)} />
          <MultiSelect compact label="BU" selected={filters.bu} options={dynamicOptions.bu || ['All']} onChange={v => updateFilter('bu', v)} />
          <MultiSelect compact label="Customer" selected={filters.customer || ['All']} options={dynamicOptions.customer || ['All']} onChange={v => updateFilter('customer', v)} />
          <MultiSelect compact label="Project Type" selected={filters.projectType} options={dynamicOptions.projectType || ['All']} onChange={v => updateFilter('projectType', v)} />
          <MultiSelect compact label="Confirmed (TBC)" selected={filters.tbc} options={dynamicOptions.tbc || ['All', 'Yes', 'No']} onChange={v => updateFilter('tbc', v)} />
          <MultiSelect compact label="PDH" selected={filters.pdh} options={dynamicOptions.pdh || ['All']} onChange={v => updateFilter('pdh', v)} />
          <MultiSelect compact label="Generation" selected={filters.generation || ['All']} options={dynamicOptions.generation || ['All', 'Current', 'Level Up + 1', 'Level Up + 2']} onChange={v => updateFilter('generation', v)} />
        </div>
      )}
    </div>
  );
};