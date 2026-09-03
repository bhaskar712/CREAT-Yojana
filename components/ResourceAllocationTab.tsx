import React, { useState, useMemo } from 'react';
import { ProjectData, Employee, MonthIndex, MANPOWER_CATEGORIES, RESOURCE_SKILLS, DeletionTarget } from '../types';
import { SKILL_ORDER, SKILL_MAPPING } from '../constants';
import { Search, UserPlus, X, ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react';
import { DeletionConfirmationModal } from './DeletionConfirmationModal';

interface ResourceAllocationTabProps {
  project: ProjectData;
  mode?: 'Budget' | 'Forecast' | 'Actuals';
  employees: Employee[];
  months: string[];
  monthIndices: number[];
  globalUtilization?: Record<string, number[]>;
  onUpdateAllocation: (skill: string, email: string, monthlyAllocs: number[], empInfo: { name: string; email: string; skill?: string; category?: string }) => void;
  isLocked?: boolean;
}

const AllocationCell = ({ val, isLocked, onChange, className }: { val: number, isLocked: boolean, onChange: (val: string) => void, className: string }) => {
  const [localVal, setLocalVal] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalVal(null);
  }, [val]);

  const displayVal = localVal !== null ? localVal : (val ? Math.round(val * 100) : '');

  const handleBlur = () => {
    if (localVal !== null) {
      onChange(localVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input 
      type="number"
      disabled={isLocked}
      value={displayVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="0"
      className={className}
    />
  );
};

const ResourceAllocationTab: React.FC<ResourceAllocationTabProps> = ({ 
  project, 
  employees, 
  months, 
  monthIndices,
  globalUtilization = {},
  onUpdateAllocation,
  isLocked,
  mode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [newAllocations, setNewAllocations] = useState<number[]>(new Array(144).fill(1));
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string>('');
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null);

  const filteredEmployees = useMemo(() => {
    // If no search term but skill selected, show all available in that skill
    const skillToFilter = selectedSkill;
    if (!skillToFilter) return [];
    
    const term = searchTerm.toLowerCase();
    
    return employees.filter(emp => {
      const empSkill = (emp.skill || '').trim();
      const empSkill2 = (emp.skillLevel2 || '').trim();
      
      const isMatch = (s: string) => {
        if (!s) return false;
        const sLower = s.toLowerCase().trim();
        const filterLower = skillToFilter.toLowerCase().trim();
        
        if (sLower === filterLower) return true;
        
        // Normalize for comparison (remove underscores, spaces, etc)
        const normalize = (str: string) => str.replace(/[^a-z0-9]/g, '');
        if (normalize(sLower) === normalize(filterLower)) return true;

        // Check SKILL_MAPPING
        for (const [raw, mapped] of Object.entries(SKILL_MAPPING)) {
          const rawL = raw.toLowerCase();
          const mappedL = mapped.toLowerCase();
          if (rawL === sLower && mappedL === filterLower) return true;
          if (mappedL === sLower && rawL === filterLower) return true;
        }
        
        return false;
      };

      const isSkillMatch = isMatch(empSkill) || isMatch(empSkill2);
      
      if (!isSkillMatch) return false;
      
      if (!searchTerm.trim()) return true;
      
      const term = searchTerm.toLowerCase();
      return (emp.name || '').toLowerCase().includes(term) || 
             (emp.email || '').toLowerCase().includes(term) ||
             (emp.empId || '').toLowerCase().includes(term);
    }).map(emp => {
        const email = emp.email || emp.id || '';
        const utilization = globalUtilization[email] || new Array(144).fill(0);
        const fyUtilization = monthIndices.map(idx => utilization[idx] || 0);
        const avgUtil = fyUtilization.reduce((a, b) => a + b, 0) / (monthIndices.length || 1);
        return { ...emp, avgUtil };
    }).sort((a, b) => a.avgUtil - b.avgUtil).slice(0, 50);
  }, [employees, searchTerm, selectedSkill, globalUtilization, monthIndices]);

  const handleOpenAdd = (skill: string) => {
    setSelectedSkill(skill);
    setSearchTerm('');
    setSelectedEmployeeEmail('');
    setNewAllocations(new Array(144).fill(1));
    setIsAdding(true);
  };

  const handleAddResource = () => {
    if (!selectedEmployeeEmail || !selectedSkill) return;
    const emp = employees.find(e => (e.email || e.id) === selectedEmployeeEmail);
    if (!emp) return;

    const finalSkill = selectedSkill;

    onUpdateAllocation(finalSkill, selectedEmployeeEmail, [...newAllocations], {
      name: emp.name,
      email: emp.email || emp.id || '',
      skill: finalSkill,
      category: emp.category || 'Direct Employee'
    });

    setIsAdding(false);
    setSelectedEmployeeEmail('');
    setNewAllocations(new Array(144).fill(1));
    setSearchTerm('');
    setSelectedSkill('');
  };

  const empSkillsKey = mode === 'Actuals' 
    ? 'actualsEmployeeSkills' 
    : (mode === 'Forecast' 
        ? 'forecastEmployeeSkills' 
        : (mode === 'Budget' ? 'employeeSkills' : 'pmoEmployeeSkills'));

  const handleCellChange = (email: string, skill: string, monthIdx: number, val: string) => {
    const num = parseFloat(val) || 0;
    const currentEmpSkills = (project as any)[empSkillsKey] || {};
    const currentAllocs = [...(((currentEmpSkills?.[skill]?.[email] || new Array(144).fill(0))) as number[])];
    currentAllocs[monthIdx] = num / 100; // Store as 0.5 for 50%
    
    onUpdateAllocation(skill, email, currentAllocs, project.employeeInfo?.[email] || { name: 'Unknown', email });
  };

  const handleRemoveResource = (skill: string, email: string) => {
    const name = project.employeeInfo?.[email]?.name || email;
    setDeletionTarget({
      type: 'employee',
      id: email,
      name: `${name} (${skill})`
    });
    setPendingRemoval({ skill, email });
  };

  const [pendingRemoval, setPendingRemoval] = useState<{skill: string, email: string} | null>(null);

  const confirmDeletion = () => {
    if (pendingRemoval) {
      onUpdateAllocation(pendingRemoval.skill, pendingRemoval.email, new Array(144).fill(0), project.employeeInfo?.[pendingRemoval.email] || { name: 'Unknown', email: pendingRemoval.email });
      setPendingRemoval(null);
      setDeletionTarget(null);
    }
  };

  // Group current project team by skill
  const skillGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const skillsObj = (project as any)[empSkillsKey];
    if (skillsObj) {
      Object.entries(skillsObj).forEach(([skill, emailMap]) => {
        Object.entries(emailMap as any).forEach(([email, allocs]) => {
          const hasAnyAlloc = (allocs as number[]).some(v => v > 0);
          if (hasAnyAlloc) {
            if (!groups[skill]) groups[skill] = [];
            groups[skill].push(email);
          }
        });
      });
    }
    return groups;
  }, [(project as any)[empSkillsKey]]);

  return (
    <div className="p-4 bg-white min-h-[600px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tight">Resource Allocation Matrix</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Plan month-wise % allocation for project team members</p>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-5 bg-indigo-600 rounded-full"></div>
                  Add {selectedSkill} Resource
                </h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Search for employees mapped to this core skill</p>
              </div>
              <button onClick={() => setIsAdding(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Find Employee</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder={`SEARCH EMPLOYEES IN ${selectedSkill.toUpperCase()}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase placeholder:text-slate-300"
                  />
                </div>
                
                {searchTerm && filteredEmployees.length === 0 && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                      <Search className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">No matching employees found for this skill category.</p>
                  </div>
                )}

                {filteredEmployees.length > 0 && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 shadow-sm ring-1 ring-slate-100 max-h-[300px] overflow-y-auto">
                    {!searchTerm && (
                       <div className="bg-slate-50/50 px-5 py-2 border-b border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available {selectedSkill} Resources (Sorted by Workload)</span>
                       </div>
                    )}
                    {filteredEmployees.map(emp => (
                      <button
                        key={emp.id || emp.email}
                        onClick={() => {
                          const email = emp.email || emp.id || '';
                          setSelectedEmployeeEmail(email);
                          setSearchTerm(`${emp.name} (${email})`);
                        }}
                        className={`w-full px-5 py-4 text-left transition-all group flex items-center justify-between gap-4 ${
                          selectedEmployeeEmail === (emp.email || emp.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] font-black text-slate-900 uppercase truncate">{emp.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase truncate">{emp.email || emp.id}</span>
                          <div className="flex items-center gap-2 mt-1">
                             <div className="flex-grow bg-slate-100 h-1.5 rounded-full overflow-hidden w-24">
                                <div 
                                  className={`h-full transition-all ${
                                    emp.avgUtil > 0.9 ? 'bg-rose-500' : emp.avgUtil > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(emp.avgUtil * 100, 100)}%` }}
                                ></div>
                             </div>
                             <span className={`text-[9px] font-black ${
                               emp.avgUtil > 0.9 ? 'text-rose-600' : emp.avgUtil > 0.7 ? 'text-amber-600' : 'text-emerald-600'
                             }`}>
                               {Math.round(emp.avgUtil * 100)}% Used
                             </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                           <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase whitespace-nowrap">
                              {emp.skill || 'No Skill'}
                           </span>
                           {emp.category && (
                             <span className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 px-2">{emp.category}</span>
                           )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedEmployeeEmail && (
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 animate-fadeIn scale-up">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">2. Set Target Allocation %</label>
                  <div className="grid grid-cols-5 gap-3 mb-6">
                    {[25, 50, 75, 100].map(val => {
                      const newVal = val / 100;
                      const utilization = globalUtilization[selectedEmployeeEmail] || new Array(144).fill(0);
                      const currentAllocInThisProject = ((project as any)[empSkillsKey]?.[selectedSkill]?.[selectedEmployeeEmail] || new Array(144).fill(0)) as number[];
                      
                      const willExceed = monthIndices.some(idx => {
                        const totalOtherProjects = (utilization[idx] || 0) - (currentAllocInThisProject[idx] || 0);
                        return (totalOtherProjects + newVal) > 0.901; 
                      });

                      return (
                        <button 
                          key={val}
                          onClick={() => {
                            const newAllocs = [...newAllocations];
                            monthIndices.forEach(idx => newAllocs[idx] = val / 100);
                            setNewAllocations(newAllocs);
                          }}
                          className={`py-3.5 rounded-2xl text-[11px] font-black transition-all border ${
                            Math.round(newAllocations[monthIndices[0]] * 100) === val
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl shadow-indigo-200 scale-105' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                          }`}
                        >
                          {val}%
                        </button>
                      );
                    })}
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        placeholder="Custom %"
                        value={Math.round(newAllocations[monthIndices[0]] * 100)}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          const newAllocs = [...newAllocations];
                          monthIndices.forEach(idx => newAllocs[idx] = val / 100);
                          setNewAllocations(newAllocs);
                        }}
                        className="w-full h-full bg-white border border-slate-200 py-3.5 px-3 rounded-2xl text-[11px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center"
                      />
                    </div>
                  </div>
                  
                  {monthIndices.some(idx => {
                    const newVal = newAllocations[idx] || 0;
                    const utilization = globalUtilization[selectedEmployeeEmail] || new Array(144).fill(0);
                    const currentAllocInThisProject = ((project as any)[empSkillsKey]?.[selectedSkill]?.[selectedEmployeeEmail] || new Array(144).fill(0)) as number[];
                    const totalOther = (utilization[idx] || 0) - (currentAllocInThisProject[idx] || 0);
                    return (totalOther + newVal) > 0.901;
                  }) && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                       <div className="w-2 h-2 bg-rose-500 animate-pulse rounded-full"></div>
                       <p className="text-[9px] font-black text-rose-600 uppercase">Warning: Over-allocation detected (&gt;90%)</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setIsAdding(false)}
                      className="py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddResource}
                      className="py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      Add to {selectedSkill}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deletionTarget && (
        <DeletionConfirmationModal 
          target={deletionTarget} 
          onClose={() => { setDeletionTarget(null); setPendingRemoval(null); }} 
          onConfirm={confirmDeletion} 
        />
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl bg-white ring-1 ring-slate-100">
        <table className="w-full text-left border-collapse min-w-[1300px]">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="p-4 text-[10px] font-black text-white uppercase tracking-widest sticky left-0 bg-slate-900 z-10 w-[200px]">CORE SKILL</th>
              <th className="p-4 text-[10px] font-black text-white uppercase tracking-widest sticky left-[200px] bg-slate-900 z-10 w-[200px] border-l border-white/5">RESOURCE</th>
              <th className="p-4 text-[10px] font-black text-white uppercase tracking-widest w-[80px] text-center border-l border-white/5">AVG %</th>
              {months.map(m => (
                <th key={m} className="p-4 text-[10px] font-black text-white uppercase tracking-widest text-center border-l border-white/5 min-w-[70px]">
                  {m}
                </th>
              ))}
              <th className="p-4 text-[10px] font-black text-white uppercase tracking-widest w-[50px] text-center border-l border-white/5"></th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {RESOURCE_SKILLS.map(category => {
              const resources = skillGroups[category] || [];
              const rowCount = Math.max(resources.length, 0);
              
              return (
                <React.Fragment key={category}>
                  {resources.length > 0 ? (
                    resources.map((email, idx) => {
                      const empInfo = project.employeeInfo?.[email];
                      const allocs = ((project as any)[empSkillsKey]?.[category]?.[email] || new Array(144).fill(0)) as number[];
                      const fyAllocs = monthIndices.map(idx => allocs[idx] || 0);
                      const avgAlloc = fyAllocs.reduce((a, b) => a + b, 0) / (monthIndices.length || 1);

                      return (
                        <tr key={`${category}-${email}`} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                          {idx === 0 && (
                            <td 
                              rowSpan={resources.length}
                              className="p-3 sticky left-0 z-10 bg-slate-50 font-black text-slate-800 text-[10px] uppercase tracking-widest border-r border-slate-200 align-top"
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                   <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                                   {category}
                                </div>
                                {!isLocked && mode !== 'Actuals' && (
                                  <button 
                                    onClick={() => handleOpenAdd(category as string)}
                                    className="w-fit p-1.5 text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm active:scale-90 border border-indigo-100"
                                    title={`Add Resource to ${category}`}
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="p-3 sticky left-[200px] z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 shadow-[4px_0_10px_rgba(0,0,0,0.01)]">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-900 uppercase truncate">{empInfo?.name || 'Unknown'}</span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase truncate">{email}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center border-l border-slate-50">
                            <div className={`text-[9px] font-black px-2 py-1 rounded-xl ${
                              avgAlloc > 1 ? 'bg-rose-100 text-rose-700' : 
                              avgAlloc >= 0.8 ? 'bg-amber-100 text-amber-700' : 
                              avgAlloc > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {Math.round(avgAlloc * 100)}%
                            </div>
                          </td>
                          {monthIndices.map((monthIdx) => (
                            <td key={`${category}-${email}-${monthIdx}`} className="p-1.5 border-l border-slate-50">
                              <AllocationCell 
                                isLocked={!!isLocked}
                                val={allocs[monthIdx] || 0}
                                onChange={(newVal) => handleCellChange(email, category, monthIdx, newVal)}
                                className={`w-full h-8 text-center text-[10px] font-black rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${
                                  isLocked ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'hover:bg-indigo-50/50 focus:bg-white'
                                } ${
                                  allocs[monthIdx] > 1 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 
                                  allocs[monthIdx] >= 0.8 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                                  allocs[monthIdx] > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-400 bg-transparent'
                                }`}
                              />
                            </td>
                          ))}
                          <td className="p-2 text-center border-l border-slate-50">
                             {!isLocked && mode !== 'Actuals' && (
                               <button 
                                 onClick={() => handleRemoveResource(category, email)}
                                 className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-b border-slate-100/50">
                      <td className="p-3 sticky left-0 z-10 bg-slate-50/50 font-black text-slate-400 text-[10px] uppercase tracking-widest border-r border-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                             <div className="w-1 h-3 bg-slate-200 rounded-full"></div>
                             {category}
                          </div>
                          {!isLocked && mode !== 'Actuals' && (
                            <button 
                              onClick={() => handleOpenAdd(category as string)}
                              className="p-1 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all active:scale-90"
                              title={`Add Resource to ${category}`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td colSpan={months.length + 3} className="px-6 py-2 text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">
                        No resources allocated
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex justify-end">
        {/* Placeholder for future actions or summary if needed */}
      </div>
    </div>
  );
};

export default ResourceAllocationTab;
