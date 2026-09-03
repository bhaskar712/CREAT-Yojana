import React, { useMemo, useState } from 'react';
import { ProjectData, FiscalYear, FiscalMode } from '../types';
import { getAuthoritativeRowUI } from './PMO';
import { 
  Search, ChevronDown, ChevronRight, Receipt, Maximize2, Minimize2, 
  Eye, EyeOff, Info, Folder, FileText, Sparkles, User, Tag, Layers
} from 'lucide-react';

export const OPERATIONAL_EXPENSE_CATEGORIES = [
  'Travel',
  'Material',
  'Labs',
  'License',
  'Consultant',
  'HR',
  'Admin',
  'Others'
] as const;

interface ExpenseListProps {
  projects: ProjectData[];
  months: string[];
  mode?: FiscalMode | FiscalMode[];
  selectedFY: FiscalYear | string;
  isSingleProject?: boolean;
}

export type UnitDisplayMode = 'smart' | 'inr' | 'k' | 'l' | 'cr';
export type ConsolidationMode = 'smart' | 'person' | 'purpose' | 'raw';

export const formatExpenseVal = (valInCr: number, unitMode: UnitDisplayMode = 'smart'): string => {
  if (!valInCr || Math.abs(valInCr) < 0.00000001) return '-';
  const inr = valInCr * 10000000;
  const absInr = Math.abs(inr);

  if (unitMode === 'inr') {
    return `₹${Math.round(inr).toLocaleString('en-IN')}`;
  }
  if (unitMode === 'k') {
    const k = inr / 1000;
    return `₹${k < 10 && k > -10 ? k.toFixed(1) : Math.round(k).toLocaleString('en-IN')} K`;
  }
  if (unitMode === 'l') {
    const l = inr / 100000;
    return `₹${l.toFixed(2)} L`;
  }
  if (unitMode === 'cr') {
    return `₹${valInCr.toFixed(2)} Cr`;
  }

  // 'smart' mode: Auto-adapt unit based on magnitude
  if (absInr >= 10000000) {
    const cr = inr / 10000000;
    return `₹${cr.toFixed(2)} Cr`;
  } else if (absInr >= 100000) {
    const l = inr / 100000;
    return `₹${l.toFixed(2)} L`;
  } else if (absInr >= 1000) {
    const k = inr / 1000;
    return `₹${k < 10 && k > -10 ? k.toFixed(1) : Math.round(k).toLocaleString('en-IN')} K`;
  } else {
    return `₹${Math.round(inr).toLocaleString('en-IN')}`;
  }
};

const formatExactINR = (valInCr: number): string => {
  if (!valInCr || Math.abs(valInCr) < 0.00000001) return '₹0';
  const inr = valInCr * 10000000;
  return `₹ ${inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export function clubExpenseDetail(rawDetail: string, projectCode?: string, category?: string): string {
  if (!rawDetail || rawDetail.trim() === '') {
    return category ? `${category} General Expense@${projectCode || ''}` : `General Expense@${projectCode || ''}`;
  }

  let str = rawDetail.trim();
  let pCode = projectCode || '';

  if (str.includes('@')) {
    const parts = str.split('@');
    str = parts[0].trim();
    if (!pCode && parts[1]) pCode = parts[1].trim();
  }

  const cleanStr = str.replace(/\s+/g, ' ').trim();
  return pCode ? `${cleanStr}@${pCode}` : cleanStr;
}

export interface SmartDetailAnalysis {
  person: string;
  purpose: string;
  smartClean: string;
}

const NAME_NORMALIZATIONS = [
  { match: /\b(gaurav\s*soni)\b/i, name: "Gaurav Soni" },
  { match: /\b(akshay\s*bhagwatkar)\b/i, name: "Akshay Bhagwatkar" },
  { match: /\b(jyoti\s*m(?:ule)?|j\.?\s*mule)\b/i, name: "Jyoti Mule" },
  { match: /\b(s\.?\s*zeenat|zeenat)\b/i, name: "S. Zeenat" },
  { match: /\b(nooney\s*venkat|v\.?\s*nooney)\b/i, name: "Venkat Nooney" },
  { match: /\b(v\.?\s*vispute|vispute)\b/i, name: "V. Vispute" },
  { match: /\b(v\.?\s*rane|rane)\b/i, name: "V. Rane" },
  { match: /\b(nishchint\s*g(?:avate)?|n\.?\s*gavate|nishchint)\b/i, name: "Nishchint Gavate" },
  { match: /\b(adwait\s*d(?:eshpande)?|adwait)\b/i, name: "Adwait Deshpande" },
  { match: /\b(swapnil\s*g(?:awade)?|s\.?\s*gawade)\b/i, name: "Swapnil Gawade" },
  { match: /\b(b\.?\s*patil)\b/i, name: "B. Patil" },
  { match: /\b(k\.?\s*patil)\b/i, name: "K. Patil" },
  { match: /\b(v\.?\s*saminathan|saminathan)\b/i, name: "V. Saminathan" }
];

export function smartCategorizeExpense(rawDetail: string, category?: string): SmartDetailAnalysis {
  if (!rawDetail) {
    return {
      person: 'General Project Expense',
      purpose: category || 'General Expense',
      smartClean: category ? `${category} General Expense` : 'General Expense'
    };
  }

  let str = rawDetail.trim();
  if (str.includes('@')) str = str.split('@')[0].trim();

  // Check for Person from known normalization list first
  let detectedPerson = '';
  for (const item of NAME_NORMALIZATIONS) {
    if (item.match.test(str)) {
      detectedPerson = item.name;
      break;
    }
  }

  // Remove project codes UMD-XXXX
  str = str.replace(/[-_:]?\s*UMD-[A-Z0-9]{4}\b/gi, '');

  // Remove parenthetical notes like (Apr-26: 71.42 L) or (Apr-26) or (Apr-2026) or (Credit Note...)
  str = str.replace(/\([^)]*\)/g, '');

  // Remove date ranges & dates e.g. 23.04.2026-30.04.2026, 25.05-26.05, 16-18.04, 29.4.26, 28.03.26-26.04.26, 07-8.5.BNG, 1-7.4
  str = str.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?:\s*[-to]+\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4})?\b/gi, '');
  str = str.replace(/\b\d{1,2}[./-]\d{1,2}(?:\s*[-to]+\s*\d{1,2}(?:[./-]\d{1,2})?)?\b/gi, '');

  // Remove month references like "For Apr-2026 Trans.", "April-26 month", "For May-2026 Trans.", "Apr-26", "April-26", "May-2026"
  str = str.replace(/\b(for\s+)?(jan|feb|mar|apr|april|may|jun|june|jul|july|aug|sep|sept|oct|nov|dec)[a-z]*[-_\s]*\d{2,4}\b(\s*trans\.?)?/gi, '');
  str = str.replace(/\bmonth\s+prepaid\b/gi, 'prepaid');

  // Remove amounts like ": 71.42 L", "71.42 L", "12.5 L", "71.42L"
  str = str.replace(/:\s*\d+(?:\.\d+)?\s*[LKCr]?/gi, '');
  str = str.replace(/\b\d+(?:\.\d+)?\s*[LKCr]\b/gi, '');

  // Purpose detection
  let purpose = '';
  const lower = str.toLowerCase();

  if (lower.includes('hotel') || lower.includes('room') || lower.includes('stay')) purpose = 'Hotel Booking';
  else if (lower.includes('air') || lower.includes('tkt') || lower.includes('ticket') || lower.includes('flight')) purpose = 'Air Ticket';
  else if (lower.includes('train') || lower.includes('rail')) purpose = 'Train Ticket';
  else if (lower.includes('credit note')) purpose = 'Credit Note';
  else if (lower.includes('tour exp') || lower.includes('tour')) purpose = 'Tour Expense';
  else if (lower.includes('prepaid')) purpose = 'Prepaid Expense';
  else if (lower.includes('l trvl') || lower.includes('local trv') || lower.includes('travel')) purpose = 'Local Travel';
  else if (lower.includes('freight') || lower.includes('shipment') || lower.includes('transp')) purpose = 'Freight & Shipping';
  else if (lower.includes('food') || lower.includes('dinner') || lower.includes('welf')) purpose = 'Food & Welfare';
  else if (lower.includes('license') || lower.includes('liscence') || lower.includes('licence')) purpose = 'License';
  else purpose = category || 'General Expense';

  // Extract Person if not detected via normalization list
  if (!detectedPerson) {
    let cleanRemaining = str
      .replace(/HOTEL ROOM BOOKING & REGISTRATION/gi, '')
      .replace(/HOTEL ROOM BOOKING/gi, '')
      .replace(/Hotel Room Bookig/gi, '')
      .replace(/Air Tkt\.?/gi, '')
      .replace(/Credit note Agan [A-Z0-9-]+/gi, '')
      .replace(/Credit note/gi, '')
      .replace(/Tour Exp/gi, '')
      .replace(/L Trvl/gi, '')
      .replace(/L Trvel exp/gi, '')
      .replace(/Prepaid Exp\.?/gi, '')
      .replace(/Rect\. Entry Ag\./gi, '')
      .replace(/Trans\./gi, '')
      .replace(/\b(BLR|PNQ|DEL|CHE|MAA|BNG|MNS|MICD|EOL|SGS|4W|LGT|CRT)\b/gi, '')
      .replace(/[-_:,./]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanRemaining.length > 2 && !/^\d+$/.test(cleanRemaining) && cleanRemaining.toLowerCase() !== purpose.toLowerCase()) {
      detectedPerson = cleanRemaining;
    }
  }

  let smartClean = '';
  if (detectedPerson && detectedPerson.toLowerCase() !== purpose.toLowerCase()) {
    smartClean = `${detectedPerson} (${purpose})`;
  } else if (detectedPerson) {
    smartClean = detectedPerson;
  } else {
    smartClean = purpose;
  }

  return {
    person: detectedPerson || 'General Project Expense',
    purpose,
    smartClean
  };
}

export interface ExpenseDetailItem {
  id: string;
  category: string;
  detail: string;
  personName?: string;
  purposeType?: string;
  rawDetails?: string[];
  projectCode: string;
  projectName: string;
  monthly: number[];
  total: number;
}

export interface PersonExpenseGroup {
  personName: string;
  monthly: number[];
  total: number;
  activities: ExpenseDetailItem[];
}

export interface ProjectExpenseGroup {
  projectCode: string;
  projectName: string;
  items: ExpenseDetailItem[];
  personGroups: PersonExpenseGroup[];
  monthly: number[];
  total: number;
  hasLineItems: boolean;
}

export interface CategoryExpenseGroup {
  category: string;
  projects: ProjectExpenseGroup[];
  monthly: number[];
  total: number;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  projects,
  months,
  mode = 'Actuals',
  selectedFY,
  isSingleProject = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedPersons, setExpandedPersons] = useState<Record<string, boolean>>({});
  const [hideZeroRows, setHideZeroRows] = useState<boolean>(true);
  const [unitMode, setUnitMode] = useState<UnitDisplayMode>('smart');
  const [consolidationMode, setConsolidationMode] = useState<ConsolidationMode>('smart');

  const isSingle = isSingleProject || projects.length === 1;

  // Determine source key for project rows
  const activeMode: FiscalMode = Array.isArray(mode) ? (mode[0] || 'Actuals') : mode;
  const sourceKey: 'pmoRows' | 'actuals' | 'forecast' = 
    activeMode === 'Actuals' ? 'actuals' : (activeMode === 'Forecast' ? 'forecast' : 'pmoRows');

  // Month indices calculation
  const monthIndices = useMemo(() => {
    return months.map(m => {
      const parts = m.split('-');
      const monthName = parts[0];
      const yearVal = parseInt(parts[1]);
      const year = yearVal < 100 ? 2000 + yearVal : yearVal;
      const monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(monthName);
      return (year - 2019) * 12 + monthIdx - 3;
    });
  }, [months]);

  // Build hierarchical structure: Category -> Projects -> Person Groups -> Items/Activities
  const categoryGroups = useMemo(() => {
    const result: Record<string, CategoryExpenseGroup> = {};

    OPERATIONAL_EXPENSE_CATEGORIES.forEach(cat => {
      result[cat] = {
        category: cat,
        projects: [],
        monthly: new Array(months.length).fill(0),
        total: 0
      };
    });

    projects.forEach(p => {
      OPERATIONAL_EXPENSE_CATEGORIES.forEach(cat => {
        const targetDetailsMap = sourceKey === 'actuals' 
          ? (p.actualsExpenseDetails || p.expenseDetails)
          : (sourceKey === 'forecast' ? (p.forecastExpenseDetails || p.expenseDetails) : (p.pmoExpenseDetails || p.expenseDetails));

        const catDetails = targetDetailsMap ? targetDetailsMap[cat] : null;
        const detailKeys = catDetails ? Object.keys(catDetails) : [];
        const hasRealDetails = detailKeys.length > 0;

        const projectItems: ExpenseDetailItem[] = [];
        const projectMonthly = new Array(months.length).fill(0);
        let projectTotal = 0;

        if (hasRealDetails && catDetails) {
          const clubbedGroupMap: Record<string, { 
            monthly: number[]; 
            detailDesc: string;
            personName: string;
            purposeType: string;
            rawDetails: Set<string>;
          }> = {};

          Object.entries(catDetails).forEach(([detailKey, allocArray]) => {
            const smart = smartCategorizeExpense(detailKey, cat);
            const rawClubbed = clubExpenseDetail(detailKey, p.code, cat);

            let groupKey = smart.smartClean;
            let displayDesc = smart.smartClean;

            if (consolidationMode === 'person') {
              groupKey = smart.person;
              displayDesc = smart.person;
            } else if (consolidationMode === 'purpose') {
              groupKey = smart.purpose;
              displayDesc = smart.purpose;
            } else if (consolidationMode === 'raw') {
              groupKey = rawClubbed;
              displayDesc = rawClubbed;
            }

            if (!clubbedGroupMap[groupKey]) {
              clubbedGroupMap[groupKey] = {
                monthly: new Array(months.length).fill(0),
                detailDesc: displayDesc,
                personName: smart.person,
                purposeType: smart.purpose,
                rawDetails: new Set()
              };
            }

            const rawClean = detailKey.split('@')[0].trim();
            clubbedGroupMap[groupKey].rawDetails.add(rawClean);

            months.forEach((_, i) => {
              const globalIdx = monthIndices[i];
              let rawVal = 0;
              if (Array.isArray(allocArray)) {
                if (globalIdx !== undefined && globalIdx >= 0 && globalIdx < allocArray.length && allocArray.length > months.length) {
                  rawVal = allocArray[globalIdx] ?? 0;
                } else if (i >= 0 && i < allocArray.length) {
                  rawVal = allocArray[i] ?? 0;
                }
              } else if (allocArray && typeof allocArray === 'object') {
                const obj = allocArray as any;
                rawVal = obj[globalIdx] ?? obj[i] ?? obj[months[i]] ?? 0;
              }

              const valCr = typeof rawVal === 'number' ? (Math.abs(rawVal) > 10 ? rawVal / 10000000 : rawVal) : 0;
              clubbedGroupMap[groupKey].monthly[i] += valCr;
            });
          });

          Object.values(clubbedGroupMap).forEach((group, dIdx) => {
            const itemMonthly = group.monthly;
            const itemTotal = itemMonthly.reduce((a, b) => a + b, 0);

            if (Math.abs(itemTotal) > 0.00000001 || !hideZeroRows) {
              projectItems.push({
                id: `${p.code}-${cat}-${dIdx}`,
                category: cat,
                detail: group.detailDesc,
                personName: group.personName,
                purposeType: group.purposeType,
                rawDetails: Array.from(group.rawDetails),
                projectCode: p.code,
                projectName: p.name,
                monthly: itemMonthly,
                total: itemTotal
              });

              itemMonthly.forEach((v, idx) => {
                projectMonthly[idx] += v;
              });
              projectTotal += itemTotal;
            }
          });
        }

        // Fallback: If no granular detail items for this project/category, look at authoritative row UI
        if (projectItems.length === 0) {
          const rawRow = getAuthoritativeRowUI(p, cat, sourceKey);
          const monthlyCatTotal = months.map((_, i) => {
            const globalIdx = monthIndices[i];
            let rawVal = 0;
            if (Array.isArray(rawRow)) {
              if (globalIdx !== undefined && globalIdx >= 0 && globalIdx < rawRow.length && rawRow.length > months.length) {
                rawVal = rawRow[globalIdx] ?? 0;
              } else if (i >= 0 && i < rawRow.length) {
                rawVal = rawRow[i] ?? 0;
              }
            } else if (rawRow && typeof rawRow === 'object') {
              const obj = rawRow as any;
              rawVal = obj[globalIdx] ?? obj[i] ?? obj[months[i]] ?? 0;
            }
            return typeof rawVal === 'number' ? (Math.abs(rawVal) > 10 ? rawVal / 10000000 : rawVal) : 0;
          });

          const totalCatCr = monthlyCatTotal.reduce((a, b) => a + b, 0);

          if (Math.abs(totalCatCr) > 0.00000001 || !hideZeroRows) {
            monthlyCatTotal.forEach((v, idx) => {
              projectMonthly[idx] += v;
            });
            projectTotal += totalCatCr;
          }
        }

        // Group project items into Person groups for the 4-level drilldown structure
        const personGroupMap: Record<string, PersonExpenseGroup> = {};

        projectItems.forEach(item => {
          const pName = (item.personName && item.personName !== 'General Project Expense') ? item.personName : '';
          
          if (pName) {
            if (!personGroupMap[pName]) {
              personGroupMap[pName] = {
                personName: pName,
                monthly: new Array(months.length).fill(0),
                total: 0,
                activities: []
              };
            }
            personGroupMap[pName].activities.push(item);
            item.monthly.forEach((v, idx) => {
              personGroupMap[pName].monthly[idx] += v;
            });
            personGroupMap[pName].total += item.total;
          } else {
            // General / Unassigned item key
            const key = `_general_${item.id}`;
            personGroupMap[key] = {
              personName: '',
              monthly: [...item.monthly],
              total: item.total,
              activities: [item]
            };
          }
        });

        const personGroups = Object.values(personGroupMap);

        // Add to project group if non-zero or not hiding zero rows
        if (projectTotal > 0.00000001 || !hideZeroRows) {
          result[cat].projects.push({
            projectCode: p.code,
            projectName: p.name,
            items: projectItems,
            personGroups: personGroups,
            monthly: projectMonthly,
            total: projectTotal,
            hasLineItems: projectItems.length > 0
          });

          projectMonthly.forEach((v, idx) => {
            result[cat].monthly[idx] += v;
          });
          result[cat].total += projectTotal;
        }
      });
    });

    return result;
  }, [projects, months, monthIndices, sourceKey, hideZeroRows, consolidationMode]);

  // Overall Grand Total across all operational categories
  const overallSummary = useMemo(() => {
    const monthly = new Array(months.length).fill(0);
    let total = 0;

    OPERATIONAL_EXPENSE_CATEGORIES.forEach(cat => {
      const group = categoryGroups[cat];
      if (group) {
        group.monthly.forEach((v, i) => {
          monthly[i] += v;
        });
        total += group.total;
      }
    });

    return { monthly, total };
  }, [categoryGroups, months.length]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleProject = (projectKey: string) => {
    setExpandedProjects(prev => ({ ...prev, [projectKey]: !prev[projectKey] }));
  };

  const togglePerson = (personKey: string) => {
    setExpandedPersons(prev => ({ ...prev, [personKey]: !(prev[personKey] ?? true) }));
  };

  const expandAll = () => {
    const allCat: Record<string, boolean> = {};
    const allProj: Record<string, boolean> = {};
    const allPers: Record<string, boolean> = {};

    OPERATIONAL_EXPENSE_CATEGORIES.forEach(cat => {
      allCat[cat] = true;
      const grp = categoryGroups[cat];
      if (grp) {
        grp.projects.forEach(p => {
          allProj[`${cat}-${p.projectCode}`] = true;
          p.personGroups.forEach(pg => {
            if (pg.personName) {
              allPers[`${cat}-${p.projectCode}-${pg.personName}`] = true;
            }
          });
        });
      }
    });

    setExpandedCategories(allCat);
    setExpandedProjects(allProj);
    setExpandedPersons(allPers);
  };

  const collapseAll = () => {
    setExpandedCategories({});
    setExpandedProjects({});
    setExpandedPersons({});
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return OPERATIONAL_EXPENSE_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return OPERATIONAL_EXPENSE_CATEGORIES.filter(cat => {
      if (cat.toLowerCase().includes(q)) return true;
      const group = categoryGroups[cat];
      if (!group) return false;
      return group.projects.some(p => 
        p.projectCode.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.items.some(item => 
          item.detail.toLowerCase().includes(q) ||
          (item.personName && item.personName.toLowerCase().includes(q)) ||
          (item.purposeType && item.purposeType.toLowerCase().includes(q))
        )
      );
    });
  }, [searchQuery, categoryGroups]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4 animate-fadeIn">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-2xs">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Operational Expense Split</h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase tracking-wider border border-indigo-200 flex items-center space-x-1">
                <Sparkles className="w-2.5 h-2.5 text-indigo-600 animate-pulse" />
                <span>AI Intelligence Mode</span>
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {isSingle ? projects[0]?.name : `Smart consolidated expense breakdown across ${projects.length} projects`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Grouping / Consolidation Mode Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[8.5px] font-black text-slate-500 px-2 uppercase tracking-wider flex items-center space-x-1">
              <Layers className="w-2.5 h-2.5 text-slate-400" />
              <span>Group By:</span>
            </span>
            <button
              onClick={() => setConsolidationMode('smart')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                consolidationMode === 'smart'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Smart AI Consolidation: Combines person & activity while removing duplicate month tags and transaction dates to aggregate values horizontally"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>AI Smart</span>
            </button>
            <button
              onClick={() => setConsolidationMode('person')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                consolidationMode === 'person'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Group strictly by Person / Traveler Name across all months"
            >
              <User className="w-2.5 h-2.5" />
              <span>Person</span>
            </button>
            <button
              onClick={() => setConsolidationMode('purpose')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                consolidationMode === 'purpose'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Group strictly by Expense Purpose / Activity Type"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>Activity</span>
            </button>
            <button
              onClick={() => setConsolidationMode('raw')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                consolidationMode === 'raw'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show raw unconsolidated transaction descriptions"
            >
              <span>Raw</span>
            </button>
          </div>

          {/* Unit Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <span className="text-[8.5px] font-black text-slate-400 px-2 uppercase tracking-wider">Unit:</span>
            {(['smart', 'inr', 'k', 'l', 'cr'] as UnitDisplayMode[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnitMode(u)}
                className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg transition-all ${
                  unitMode === u
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Display expenses in ${u === 'smart' ? 'Auto Smart Units (K, L, Cr)' : u === 'inr' ? 'Exact Rupees (₹)' : u === 'k' ? 'Thousands (₹K)' : u === 'l' ? 'Lakhs (₹L)' : 'Crores (₹Cr)'}`}
              >
                {u === 'smart' ? 'Auto' : u === 'inr' ? '₹' : u === 'k' ? '₹K' : u === 'l' ? '₹L' : '₹Cr'}
              </button>
            ))}
          </div>

          {/* Hide Zero Entries Toggle */}
          <button
            onClick={() => setHideZeroRows(!hideZeroRows)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-[9px] font-black uppercase transition-all border ${
              hideZeroRows
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title={hideZeroRows ? "Showing non-zero expense items only. Click to show all." : "Showing all items including zero expense entries. Click to hide zeros."}
          >
            {hideZeroRows ? <EyeOff className="w-3 h-3 text-emerald-600" /> : <Eye className="w-3 h-3 text-slate-500" />}
            <span>{hideZeroRows ? "Non-Zero Only" : "Show All Rows"}</span>
          </button>

          <button
            onClick={expandAll}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase transition-colors"
            title="Expand all categories & projects"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Expand All</span>
          </button>

          <button
            onClick={collapseAll}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase transition-colors"
            title="Collapse all categories & projects"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Collapse All</span>
          </button>

          <div className="relative ml-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search person, activity, project..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-700 uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Main Table with 3-Level Pivot Hierarchy: Category -> Project -> Item */}
      <div className="overflow-x-auto no-scrollbar border border-slate-200/80 rounded-xl">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-wider">
              <th className="px-3 py-2.5 w-10 text-center border-r border-slate-200">#</th>
              <th className="px-4 py-2.5 min-w-[320px] max-w-[420px] border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
                Category / Project / Expense Detail
              </th>
              {months.map(m => (
                <th key={m} className="px-3 py-2.5 text-right min-w-[70px] font-mono">{m}</th>
              ))}
              <th className="px-4 py-2.5 text-right min-w-[95px] font-mono bg-slate-200/50">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
            {filteredCategories.map((cat, catIdx) => {
              const group = categoryGroups[cat] || { category: cat, projects: [], monthly: [], total: 0 };
              const isCategoryExpanded = expandedCategories[cat] ?? false;
              const projectCount = group.projects.length;

              return (
                <React.Fragment key={cat}>
                  {/* LEVEL 1: Category Summary Row */}
                  <tr 
                    onClick={() => toggleCategory(cat)}
                    className="bg-slate-100/90 hover:bg-slate-200/80 cursor-pointer transition-colors border-t border-slate-300"
                  >
                    <td className="px-3 py-2.5 text-center text-slate-600 font-mono font-black border-r border-slate-200">
                      {catIdx + 1}
                    </td>
                    <td className="px-4 py-2.5 font-black text-slate-900 uppercase border-r border-slate-200 sticky left-0 bg-slate-100/90 z-10">
                      <div className="flex items-center space-x-2">
                        <div className="p-1 rounded bg-indigo-100 text-indigo-700">
                          {isCategoryExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </div>
                        <span className="tracking-wide text-xs text-slate-900">{cat}</span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[8.5px] font-black uppercase ml-2">
                          {projectCount} {projectCount === 1 ? 'Project' : 'Projects'}
                        </span>
                      </div>
                    </td>
                    {group.monthly.map((v, mIdx) => (
                      <td 
                        key={mIdx} 
                        title={`${months[mIdx]} Total: ${formatExactINR(v)} (${v.toFixed(6)} Cr)`}
                        className={`px-3 py-2.5 text-right font-mono cursor-help ${v > 0.00000001 ? 'text-slate-900 font-black' : 'text-slate-300'}`}
                      >
                        {formatExpenseVal(v, unitMode)}
                      </td>
                    ))}
                    <td 
                      title={`Category Total: ${formatExactINR(group.total)} (${group.total.toFixed(6)} Cr)`}
                      className="px-4 py-2.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/40 cursor-help"
                    >
                      {formatExpenseVal(group.total, unitMode)}
                    </td>
                  </tr>

                  {/* LEVEL 2: Projects under Category */}
                  {isCategoryExpanded && group.projects.map((proj, projIdx) => {
                    const projectKey = `${cat}-${proj.projectCode}`;
                    const isProjectExpanded = expandedProjects[projectKey] ?? false;

                    return (
                      <React.Fragment key={projectKey}>
                        {/* Project Sub-row */}
                        <tr 
                          onClick={() => proj.hasLineItems && toggleProject(projectKey)}
                          className={`bg-slate-50/80 hover:bg-indigo-50/40 transition-colors border-t border-slate-100 ${proj.hasLineItems ? 'cursor-pointer' : ''}`}
                        >
                          <td className="px-3 py-2 text-center text-slate-400 font-mono text-[9px] border-r border-slate-200">
                            {catIdx + 1}.{projIdx + 1}
                          </td>
                          <td className="px-4 py-2 pl-8 font-extrabold text-slate-800 border-r border-slate-200 sticky left-0 bg-slate-50/80 z-10">
                            <div className="flex items-center space-x-2">
                              {proj.hasLineItems ? (
                                <div className="p-0.5 rounded text-indigo-600 bg-indigo-50 hover:bg-indigo-100">
                                  {isProjectExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </div>
                              ) : (
                                <Folder className="w-3 h-3 text-slate-400 shrink-0" />
                              )}
                              <span className="bg-[#001e3c] text-white px-1.5 py-0.5 rounded text-[8px] font-black shrink-0">
                                {proj.projectCode}
                              </span>
                              <span className="truncate max-w-[220px] sm:max-w-[280px] text-[10px] text-slate-700" title={proj.projectName}>
                                {proj.projectName}
                              </span>
                              {proj.hasLineItems && (
                                <span className="text-[8px] text-indigo-600 font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                                  {proj.items.length} {proj.items.length === 1 ? 'Item' : 'Items'}
                                </span>
                              )}
                            </div>
                          </td>
                          {proj.monthly.map((v, mIdx) => (
                            <td 
                              key={mIdx} 
                              title={`${proj.projectCode} (${months[mIdx]}): ${formatExactINR(v)}`}
                              className={`px-3 py-2 text-right font-mono text-[9.5px] ${v > 0.00000001 ? 'text-slate-900 font-black' : 'text-slate-300'}`}
                            >
                              {formatExpenseVal(v, unitMode)}
                            </td>
                          ))}
                          <td 
                            title={`${proj.projectCode} Total: ${formatExactINR(proj.total)}`}
                            className="px-4 py-2 text-right font-mono font-black text-slate-900 bg-slate-100/50 text-[9.5px]"
                          >
                            {formatExpenseVal(proj.total, unitMode)}
                          </td>
                        </tr>

                        {/* LEVEL 3 & 4: Person Groups and Nested Activities under Project */}
                        {isProjectExpanded && proj.personGroups.map((pGroup, pIdx) => {
                          if (pGroup.personName) {
                            const personKey = `${cat}-${proj.projectCode}-${pGroup.personName}`;
                            const isPersonExpanded = expandedPersons[personKey] ?? true;

                            return (
                              <React.Fragment key={personKey}>
                                {/* Person Row (Level 3) */}
                                <tr 
                                  onClick={() => togglePerson(personKey)}
                                  className="bg-slate-50/60 hover:bg-indigo-50/20 cursor-pointer font-bold border-t border-slate-100"
                                >
                                  <td className="px-3 py-1.5 text-center text-slate-400 font-mono text-[8.5px] border-r border-slate-200">
                                    {catIdx + 1}.{projIdx + 1}.{pIdx + 1}
                                  </td>
                                  <td className="px-4 py-1.5 pl-12 font-bold text-slate-800 border-r border-slate-200 sticky left-0 bg-slate-50/60 z-10">
                                    <div className="flex items-center space-x-2">
                                      <div className="p-0.5 rounded text-indigo-600 bg-indigo-50 hover:bg-indigo-100">
                                        {isPersonExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      </div>
                                      <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">
                                        {pGroup.personName}
                                      </span>
                                      <span className="text-[8px] text-blue-600 font-extrabold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                        {pGroup.activities.length} {pGroup.activities.length === 1 ? 'Activity' : 'Activities'}
                                      </span>
                                    </div>
                                  </td>
                                  {pGroup.monthly.map((v, mIdx) => (
                                    <td 
                                      key={mIdx} 
                                      title={`${pGroup.personName} (${months[mIdx]}): ${formatExactINR(v)}`}
                                      className={`px-3 py-1.5 text-right font-mono text-[9.5px] ${v > 0.00000001 ? 'text-slate-900 font-black' : 'text-slate-300'}`}
                                    >
                                      {formatExpenseVal(v, unitMode)}
                                    </td>
                                  ))}
                                  <td 
                                    title={`${pGroup.personName} Total: ${formatExactINR(pGroup.total)}`}
                                    className="px-4 py-1.5 text-right font-mono font-black text-slate-900 bg-slate-100/40 text-[9.5px]"
                                  >
                                    {formatExpenseVal(pGroup.total, unitMode)}
                                  </td>
                                </tr>

                                {/* Activities under Person (Level 4) */}
                                {isPersonExpanded && pGroup.activities.map((item, itemIdx) => (
                                  <tr key={item.id} className="bg-white hover:bg-indigo-50/30 transition-colors text-[9px] group relative border-t border-slate-50">
                                    <td className="px-3 py-1.5 text-center text-slate-300 font-mono border-r border-slate-100">
                                      {catIdx + 1}.{projIdx + 1}.{pIdx + 1}.{itemIdx + 1}
                                    </td>
                                    <td className="px-4 py-1.5 pl-16 font-semibold text-slate-700 border-r border-slate-100 sticky left-0 bg-white z-10">
                                      <div className="flex items-center space-x-2 flex-wrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                        
                                        <span 
                                          className="font-mono text-slate-800 group-hover:text-indigo-700 truncate max-w-[240px] sm:max-w-[300px] block cursor-help font-bold"
                                          title={item.detail}
                                        >
                                          {item.purposeType || item.detail}
                                        </span>

                                        {item.purposeType && item.detail !== item.purposeType && (
                                          <span className="text-[8px] text-slate-400 font-mono truncate max-w-[160px]">
                                            ({item.detail})
                                          </span>
                                        )}
                                      </div>

                                      {/* Tooltip for raw details */}
                                      <div className="absolute left-10 bottom-full mb-1.5 hidden group-hover:block z-[250] w-80 sm:w-96 p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 text-[10px] pointer-events-none animate-fadeIn">
                                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                                          <span className="text-[9px] font-black uppercase text-indigo-400 flex items-center space-x-1">
                                            <Sparkles className="w-3 h-3 text-indigo-400" />
                                            <span>{item.category} • {item.personName || item.projectCode}</span>
                                          </span>
                                          <span className="text-[9px] font-mono font-bold text-emerald-400">
                                            Total: {formatExactINR(item.total)}
                                          </span>
                                        </div>
                                        <div className="font-mono text-[10px] font-bold text-white break-words leading-relaxed mb-2">
                                          {item.detail}
                                        </div>

                                        {item.rawDetails && item.rawDetails.length > 0 && (
                                          <div className="mt-1 pt-1.5 border-t border-slate-800">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                              Consolidated Raw Transactions ({item.rawDetails.length}):
                                            </span>
                                            <div className="space-y-1 max-h-32 overflow-y-auto pr-1 no-scrollbar text-[8.5px] font-mono text-slate-300">
                                              {item.rawDetails.map((rd, rdIdx) => (
                                                <div key={rdIdx} className="bg-slate-800/80 p-1.5 rounded border border-slate-700/60 leading-tight">
                                                  {rd}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    {item.monthly.map((v, mIdx) => (
                                      <td 
                                        key={mIdx} 
                                        title={`${months[mIdx]}: ${formatExactINR(v)}`}
                                        className={`px-3 py-1.5 text-right font-mono ${v > 0.00000001 ? 'text-slate-800 font-bold' : 'text-slate-300'}`}
                                      >
                                        {formatExpenseVal(v, unitMode)}
                                      </td>
                                    ))}
                                    <td 
                                      title={`Item Total: ${formatExactINR(item.total)}`}
                                      className="px-4 py-1.5 text-right font-mono font-bold text-slate-800 bg-slate-50/30"
                                    >
                                      {formatExpenseVal(item.total, unitMode)}
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          } else {
                            // General / Unassigned Expense Items directly under Project Code
                            return pGroup.activities.map((item, itemIdx) => (
                              <tr key={item.id} className="bg-white hover:bg-indigo-50/30 transition-colors text-[9px] group relative border-t border-slate-50">
                                <td className="px-3 py-1.5 text-center text-slate-300 font-mono border-r border-slate-100">
                                  {catIdx + 1}.{projIdx + 1}.{pIdx + 1}.{itemIdx + 1}
                                </td>
                                <td className="px-4 py-1.5 pl-12 font-semibold text-slate-700 border-r border-slate-100 sticky left-0 bg-white z-10">
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                    
                                    <span 
                                      className="font-mono text-slate-800 group-hover:text-indigo-700 truncate max-w-[260px] sm:max-w-[320px] block cursor-help font-bold"
                                      title={item.detail}
                                    >
                                      {item.detail}
                                    </span>

                                    {item.purposeType && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[7.5px] font-black uppercase flex items-center space-x-0.5">
                                        <Tag className="w-2 h-2 text-slate-400" />
                                        <span>{item.purposeType}</span>
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {item.monthly.map((v, mIdx) => (
                                  <td 
                                    key={mIdx} 
                                    title={`${months[mIdx]}: ${formatExactINR(v)}`}
                                    className={`px-3 py-1.5 text-right font-mono ${v > 0.00000001 ? 'text-slate-800 font-bold' : 'text-slate-300'}`}
                                  >
                                    {formatExpenseVal(v, unitMode)}
                                  </td>
                                ))}
                                <td 
                                  title={`Item Total: ${formatExactINR(item.total)}`}
                                  className="px-4 py-1.5 text-right font-mono font-bold text-slate-800 bg-slate-50/30"
                                >
                                  {formatExpenseVal(item.total, unitMode)}
                                </td>
                              </tr>
                            ));
                          }
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Empty state message when category expanded but zero projects */}
                  {isCategoryExpanded && group.projects.length === 0 && (
                    <tr className="bg-slate-50/40 text-[9px] text-slate-400 italic">
                      <td className="px-3 py-2 text-center">-</td>
                      <td className="px-4 py-2 pl-8 uppercase sticky left-0 bg-slate-50/40">{cat}</td>
                      <td className="px-4 py-2 flex items-center space-x-1 text-slate-400" colSpan={months.length + 2}>
                        <Info className="w-3 h-3 text-slate-400" />
                        <span>No expense entries recorded in this category. (Click "Show All Rows" in toolbar to view empty entries)</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Total Row */}
            <tr className="bg-slate-900 text-white font-black text-[10px] uppercase border-t-2 border-slate-800">
              <td className="px-3 py-3 text-center border-r border-slate-800">Σ</td>
              <td className="px-4 py-3 border-r border-slate-800 tracking-wider sticky left-0 bg-slate-900 z-10">
                TOTAL EXPENSES
              </td>
              {overallSummary.monthly.map((v, mIdx) => (
                <td key={mIdx} className="px-3 py-3 text-right font-mono text-emerald-400 font-black">
                  {formatExpenseVal(v, unitMode)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-mono text-emerald-400 font-black bg-slate-800">
                {formatExpenseVal(overallSummary.total, unitMode)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseList;
