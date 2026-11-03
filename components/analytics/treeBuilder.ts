import { FiscalMode, FiscalYear, getAbsoluteMonthIndex } from '../../types';
import { 
  RATE_PER_HOUR, 
  CONTRACTED_EMPLOYEE_RATE, 
  HOURS_PER_MONTH, 
  MAX_MONTHS, 
  SKILL_MAPPING, 
  MANPOWER_CATEGORIES, 
  EXPENSE_CATEGORIES, 
  isConfirmedProject 
} from '../../constants';
import { AnalyticsTreeNode, TreeNodeMetrics, TreeSortField, TreeSortOrder } from './types';

export const TOP_CATEGORIES = [
  'Projects',
  'Product Maintenance',
  'Project Support',
  'Organization Support'
];

export const PROJECTS_SUB = ['ECS-1', 'ECS-2', 'LAS', 'INITIA', 'SCS'];
export const MAINTENANCE_SUB = ['ECS-1', 'ECS-2', 'LAS'];
export const PROJECT_SUPPORT_SUB = [
  'Costing Cell', 'Quality', 'PMTS', 'Trainings', 'Support Services', 
  'Holiday & Leaves', 'Non Projects', 'Others'
];
export const ORG_SUPPORT_SUB = ['HR', 'Finance', 'Admin', 'Others'];

export const getProjectCategory = (p: any, selectedFY: FiscalYear) => {
  let fyStartYear = 2025;
  if (selectedFY && selectedFY !== 'All FY') {
    const parts = selectedFY.split(' ');
    if (parts.length > 1) {
      const yearPart = parts[1].split('-')[0];
      fyStartYear = parseInt(yearPart) + 2000;
    }
  }
  const fyStartDate = new Date(fyStartYear, 3, 1); // April 1st

  let v = (p.vertical || 'Unassigned').trim();
  const name = (p.name || '').trim();
  const code = (p.code || '').trim();
  const isMaintenance = name.toLowerCase().includes('maintenance');
  const ft = p.functionalTeam || '';
  const pStartDate = p.startDate ? new Date(p.startDate) : null;
  const isNew = pStartDate ? pStartDate >= fyStartDate : (p.category || '').toLowerCase().includes('new');

  let category = '';
  let parent = '';

  // Specific Project Code Overrides
  if (code === 'UMD-3189') {
    parent = 'Project Support';
    category = 'Project Support:Costing Cell';
  } else if (code === 'UMD-2740') {
    parent = 'Project Support';
    category = 'Project Support:Quality';
  } else if (code === 'UMD-1038') {
    parent = 'Organization Support';
    category = 'Organization Support:HR';
  } else if (code === 'UMD-2649') {
    parent = 'Organization Support';
    category = 'Organization Support:Finance';
  } else if (code === 'UMD-2650') {
    parent = 'Organization Support';
    category = 'Organization Support:Admin';
  } else if (PROJECTS_SUB.includes(v) && !isMaintenance) {
    parent = 'Projects';
    category = `Projects:${v}`;
  } else if (isMaintenance && MAINTENANCE_SUB.includes(v)) {
    parent = 'Product Maintenance';
    category = `Product Maintenance:${v}`;
  } else if (v.toUpperCase() === 'SUPPORT') {
    parent = 'Project Support';
    let sub = '';
    if (ft === 'Costing Cell') sub = 'Costing Cell';
    else if (ft === 'Quality') sub = 'Quality';
    else if (name.toLowerCase().includes('holiday') || name.toLowerCase().includes('leave')) sub = 'Holiday & Leaves';
    else if (name.toLowerCase().includes('training')) sub = 'Trainings';
    else if (name.toLowerCase().includes('pmts') || name.toLowerCase().includes('product planning')) sub = 'PMTS';
    else if (name.toLowerCase().includes('support services')) sub = 'Support Services';
    else sub = 'Non Projects';
    category = `Project Support:${sub}`;
  } else if (ORG_SUPPORT_SUB.includes(v) || v === 'Finance') {
    parent = 'Organization Support';
    category = `Organization Support:${v}`;
  } else {
    // If not matching specific lists, preserve vertical context
    if (isMaintenance) {
      parent = 'Product Maintenance';
      category = `Product Maintenance:${v || 'Others'}`;
    } else if (['HR', 'ADMIN', 'FINANCE'].includes(v.toUpperCase())) {
      parent = 'Organization Support';
      category = `Organization Support:${v}`;
    } else {
      parent = 'Projects';
      category = `Projects:${v || 'Others'}`;
    }
  }

  return { category, parent, subcategory: category.split(':')[1] || v, isNew };
};

const createEmptyMetrics = (numMonths: number): TreeNodeMetrics => ({
  manpowerMM: 0,
  directMM: 0,
  contractedMM: 0,
  manpowerCr: 0,
  expenseCr: 0,
  totalCr: 0,
  budgetCr: 0,
  newMM: 0,
  carryOverMM: 0,
  monthlyData: new Array(numMonths).fill(0),
  monthlyManpowerMM: new Array(numMonths).fill(0),
  monthlyExpenseCr: new Array(numMonths).fill(0),
});

interface BuildTreeParams {
  projects: any[];
  months: string[];
  selectedFY: FiscalYear;
  selectedFYs: FiscalYear[];
  config: any;
  totalsLookup?: Record<string, any>;
  calculateProjectCost: (p: any, mode: FiscalMode) => {
    mm: number;
    directMM: number;
    contractedMM: number;
    manpowerCr: number;
    expenseCr: number;
    totalCr: number;
  };
  getActiveProjectData: (p: any, mode: FiscalMode) => Record<string, number[]>;
}

export function buildAnalyticsTree({
  projects,
  months,
  selectedFY,
  selectedFYs,
  config,
  totalsLookup,
  calculateProjectCost,
  getActiveProjectData
}: BuildTreeParams): AnalyticsTreeNode[] {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeMonths = Array.isArray(months) ? months : [];
  const numMonths = safeMonths.length;
  const monthIndices = safeMonths.map(m => getAbsoluteMonthIndex(m));
  const MODES: FiscalMode[] = ['Budget', 'Actuals', 'Forecast'];

  // Rates cache
  const safeConfig = config || {};
  const ratesCache: Record<number, { hRate: number; cRate: number }> = {};
  for (let i = 0; i < MAX_MONTHS; i++) {
    const fyStartYear = 19 + Math.floor(i / 12);
    const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
    const fyConfig = safeConfig.fyFinancials?.[fyStr];
    ratesCache[i] = {
      hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (safeConfig.hourlyRate || RATE_PER_HOUR),
      cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (safeConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
    };
  }

  // Map of categories -> subcategories -> projects
  const categoryMap: Record<string, Record<string, any[]>> = {};

  TOP_CATEGORIES.forEach(cat => {
    categoryMap[cat] = {};
  });

  const confirmedProjects = safeProjects.filter(p => isConfirmedProject(p));

  // Step 1: Assign each project to its Category & Subcategory
  confirmedProjects.forEach(p => {
    const { parent, subcategory } = getProjectCategory(p, selectedFY);
    const safeParent = categoryMap[parent] ? parent : 'Projects';
    if (!categoryMap[safeParent][subcategory]) {
      categoryMap[safeParent][subcategory] = [];
    }
    categoryMap[safeParent][subcategory].push(p);
  });

  // Helper to compute metrics for a single project
  const computeProjectMetrics = (p: any) => {
    const metrics: Record<FiscalMode, TreeNodeMetrics> = {
      Budget: createEmptyMetrics(numMonths),
      Actuals: createEmptyMetrics(numMonths),
      Forecast: createEmptyMetrics(numMonths),
      Variance: createEmptyMetrics(numMonths),
      PMO_Budget: createEmptyMetrics(numMonths)
    };

    const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');
    const { isNew } = getProjectCategory(p, selectedFY);

    MODES.forEach(mode => {
      const costs = calculateProjectCost(p, mode);
      const budgetCosts = calculateProjectCost(p, 'Budget');
      const activeSource = getActiveProjectData(p, mode);

      const m = metrics[mode];
      m.manpowerMM = costs.mm;
      m.directMM = costs.directMM;
      m.contractedMM = costs.contractedMM;
      m.manpowerCr = costs.manpowerCr;
      m.expenseCr = costs.expenseCr;
      m.totalCr = costs.totalCr;
      m.budgetCr = budgetCosts.totalCr;

      if (isNew) {
        m.newMM = costs.mm;
      } else {
        m.carryOverMM = costs.mm;
      }

      // Calculate monthly burn
      for (let i = 0; i < numMonths; i++) {
        const globalIdx = monthIndices[i];
        if (globalIdx === undefined || globalIdx < 0) continue;
        const { hRate, cRate } = ratesCache[globalIdx] || { hRate: RATE_PER_HOUR, cRate: CONTRACTED_EMPLOYEE_RATE };

        let monthDirectMM = 0;
        let monthContractedMM = 0;
        let monthExpCr = 0;

        Object.entries(activeSource || {}).forEach(([rawCat, dataArray]) => {
          const cat = SKILL_MAPPING[rawCat] || rawCat;
          const val = Number(dataArray?.[globalIdx] || 0);
          if (val === 0) return;

          const isContracted = cat.toLowerCase().includes('contracted');
          const isContractedExp = cat === 'Contracted Employee Expense';
          const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || cat.includes('_CoC') || cat.includes('_Vertical') || cat === 'NPC';
          const isExpense = EXPENSE_CATEGORIES.includes(cat as any) || isContractedExp;

          if (isContracted) {
            monthContractedMM += val;
          } else if (isManpower) {
            monthDirectMM += val;
          }

          if (isExpense) {
            const expVal = val / 10000000;
            monthExpCr += expVal;
          }
        });

        const monthDirectCr = !isHolidayLeave ? (monthDirectMM * hRate * HOURS_PER_MONTH) / 10000000 : 0;
        const monthContractedCr = (monthContractedMM * cRate * HOURS_PER_MONTH) / 10000000;
        const monthTotalCr = monthDirectCr + monthContractedCr + monthExpCr;

        m.monthlyData[i] = monthTotalCr;
        m.monthlyManpowerMM![i] = monthDirectMM + monthContractedMM;
        m.monthlyExpenseCr![i] = monthExpCr;
      }
    });

    return metrics;
  };

  // Helper to extract skill and expense breakdown for project Level 4/5
  const extractProjectDetails = (p: any) => {
    const skills: Record<string, { mm: number; cr: number; monthly: number[] }> = {};
    const expenses: Record<string, { cr: number; monthly: number[] }> = {};

    const activeSource = getActiveProjectData(p, 'Budget');
    Object.entries(activeSource || {}).forEach(([rawCat, dataArray]) => {
      const cat = SKILL_MAPPING[rawCat] || rawCat;
      const isContracted = cat.toLowerCase().includes('contracted');
      const isContractedExp = cat === 'Contracted Employee Expense';
      const isManpower = MANPOWER_CATEGORIES.includes(cat as any) || cat.includes('_CoC') || cat.includes('_Vertical') || cat === 'NPC';
      const isExpense = EXPENSE_CATEGORIES.includes(cat as any) || isContractedExp;

      const monthly = monthIndices.map(idx => Number(dataArray?.[idx] || 0));
      const totalUnits = monthly.reduce((a, b) => a + b, 0);

      if (isManpower || isContracted) {
        skills[cat] = {
          mm: totalUnits,
          cr: (totalUnits * (isContracted ? CONTRACTED_EMPLOYEE_RATE : RATE_PER_HOUR) * HOURS_PER_MONTH) / 10000000,
          monthly
        };
      } else if (isExpense) {
        expenses[cat] = {
          cr: totalUnits / 10000000,
          monthly: monthly.map(v => v / 10000000)
        };
      }
    });

    return { skills, expenses };
  };

  // Build the hierarchical tree
  const tree: AnalyticsTreeNode[] = [];

  TOP_CATEGORIES.forEach(catName => {
    const subcats = categoryMap[catName] || {};
    const subcatNodes: AnalyticsTreeNode[] = [];

    const catMetrics: Record<FiscalMode, TreeNodeMetrics> = {
      Budget: createEmptyMetrics(numMonths),
      Actuals: createEmptyMetrics(numMonths),
      Forecast: createEmptyMetrics(numMonths),
      Variance: createEmptyMetrics(numMonths),
      PMO_Budget: createEmptyMetrics(numMonths)
    };

    let catProjectCount = 0;

    Object.entries(subcats).forEach(([subName, projectList]) => {
      if (projectList.length === 0) return;

      const subcatMetrics: Record<FiscalMode, TreeNodeMetrics> = {
        Budget: createEmptyMetrics(numMonths),
        Actuals: createEmptyMetrics(numMonths),
        Forecast: createEmptyMetrics(numMonths),
        Variance: createEmptyMetrics(numMonths),
        PMO_Budget: createEmptyMetrics(numMonths)
      };

      const projectNodes: AnalyticsTreeNode[] = [];

      projectList.forEach(p => {
        const pMetrics = computeProjectMetrics(p);
        const { skills, expenses } = extractProjectDetails(p);

        // Build Level 4 detail groups for this project
        const detailChildren: AnalyticsTreeNode[] = [];

        // Direct Manpower detail group
        const directSkills = Object.entries(skills).filter(([k]) => !k.toLowerCase().includes('contracted'));
        if (directSkills.length > 0) {
          const directMM = directSkills.reduce((acc, [, s]) => acc + s.mm, 0);
          const directCr = directSkills.reduce((acc, [, s]) => acc + s.cr, 0);
          const directMonthly = new Array(numMonths).fill(0);
          for (let m = 0; m < numMonths; m++) {
            directMonthly[m] = directSkills.reduce((acc, [, s]) => acc + (s.monthly[m] || 0), 0);
          }

          const skillItems: AnalyticsTreeNode[] = directSkills.map(([skillName, s]) => {
            const itemMetrics: Record<FiscalMode, TreeNodeMetrics> = {
              Budget: { ...createEmptyMetrics(numMonths), manpowerMM: s.mm, manpowerCr: s.cr, totalCr: s.cr, monthlyData: s.monthly },
              Actuals: { ...createEmptyMetrics(numMonths), manpowerMM: s.mm, manpowerCr: s.cr, totalCr: s.cr, monthlyData: s.monthly },
              Forecast: { ...createEmptyMetrics(numMonths), manpowerMM: s.mm, manpowerCr: s.cr, totalCr: s.cr, monthlyData: s.monthly },
              Variance: createEmptyMetrics(numMonths),
              PMO_Budget: createEmptyMetrics(numMonths)
            };
            return {
              id: `item:${p.id}:${skillName}`,
              key: `item:${p.id}:${skillName}`,
              name: skillName,
              type: 'detail_item',
              level: 5,
              parentKey: `group:${p.id}:direct`,
              metrics: itemMetrics,
              children: [],
              itemCount: 0
            };
          });

          const groupMetrics: Record<FiscalMode, TreeNodeMetrics> = {
            Budget: { ...createEmptyMetrics(numMonths), manpowerMM: directMM, manpowerCr: directCr, totalCr: directCr, monthlyData: directMonthly },
            Actuals: { ...createEmptyMetrics(numMonths), manpowerMM: directMM, manpowerCr: directCr, totalCr: directCr, monthlyData: directMonthly },
            Forecast: { ...createEmptyMetrics(numMonths), manpowerMM: directMM, manpowerCr: directCr, totalCr: directCr, monthlyData: directMonthly },
            Variance: createEmptyMetrics(numMonths),
            PMO_Budget: createEmptyMetrics(numMonths)
          };

          detailChildren.push({
            id: `group:${p.id}:direct`,
            key: `group:${p.id}:direct`,
            name: 'Direct Manpower',
            type: 'detail_group',
            level: 4,
            parentKey: `proj:${p.id}`,
            metrics: groupMetrics,
            children: skillItems,
            itemCount: directSkills.length
          });
        }

        // Contracted Manpower detail group
        const contractedSkills = Object.entries(skills).filter(([k]) => k.toLowerCase().includes('contracted'));
        if (contractedSkills.length > 0) {
          const cMM = contractedSkills.reduce((acc, [, s]) => acc + s.mm, 0);
          const cCr = contractedSkills.reduce((acc, [, s]) => acc + s.cr, 0);
          const cMonthly = new Array(numMonths).fill(0);
          for (let m = 0; m < numMonths; m++) {
            cMonthly[m] = contractedSkills.reduce((acc, [, s]) => acc + (s.monthly[m] || 0), 0);
          }

          const groupMetrics: Record<FiscalMode, TreeNodeMetrics> = {
            Budget: { ...createEmptyMetrics(numMonths), manpowerMM: cMM, manpowerCr: cCr, totalCr: cCr, monthlyData: cMonthly },
            Actuals: { ...createEmptyMetrics(numMonths), manpowerMM: cMM, manpowerCr: cCr, totalCr: cCr, monthlyData: cMonthly },
            Forecast: { ...createEmptyMetrics(numMonths), manpowerMM: cMM, manpowerCr: cCr, totalCr: cCr, monthlyData: cMonthly },
            Variance: createEmptyMetrics(numMonths),
            PMO_Budget: createEmptyMetrics(numMonths)
          };

          detailChildren.push({
            id: `group:${p.id}:contracted`,
            key: `group:${p.id}:contracted`,
            name: 'Contracted Manpower',
            type: 'detail_group',
            level: 4,
            parentKey: `proj:${p.id}`,
            metrics: groupMetrics,
            children: [],
            itemCount: 1
          });
        }

        // Operational Expenses detail group
        const expenseItemsList = Object.entries(expenses);
        if (expenseItemsList.length > 0) {
          const totalExpCr = expenseItemsList.reduce((acc, [, e]) => acc + e.cr, 0);
          const expMonthly = new Array(numMonths).fill(0);
          for (let m = 0; m < numMonths; m++) {
            expMonthly[m] = expenseItemsList.reduce((acc, [, e]) => acc + (e.monthly[m] || 0), 0);
          }

          const expenseDetailItems: AnalyticsTreeNode[] = expenseItemsList.map(([expName, e]) => {
            const itemMetrics: Record<FiscalMode, TreeNodeMetrics> = {
              Budget: { ...createEmptyMetrics(numMonths), expenseCr: e.cr, totalCr: e.cr, monthlyData: e.monthly },
              Actuals: { ...createEmptyMetrics(numMonths), expenseCr: e.cr, totalCr: e.cr, monthlyData: e.monthly },
              Forecast: { ...createEmptyMetrics(numMonths), expenseCr: e.cr, totalCr: e.cr, monthlyData: e.monthly },
              Variance: createEmptyMetrics(numMonths),
              PMO_Budget: createEmptyMetrics(numMonths)
            };
            return {
              id: `item:${p.id}:${expName}`,
              key: `item:${p.id}:${expName}`,
              name: expName,
              type: 'detail_item',
              level: 5,
              parentKey: `group:${p.id}:expenses`,
              metrics: itemMetrics,
              children: [],
              itemCount: 0
            };
          });

          const groupMetrics: Record<FiscalMode, TreeNodeMetrics> = {
            Budget: { ...createEmptyMetrics(numMonths), expenseCr: totalExpCr, totalCr: totalExpCr, monthlyData: expMonthly },
            Actuals: { ...createEmptyMetrics(numMonths), expenseCr: totalExpCr, totalCr: totalExpCr, monthlyData: expMonthly },
            Forecast: { ...createEmptyMetrics(numMonths), expenseCr: totalExpCr, totalCr: totalExpCr, monthlyData: expMonthly },
            Variance: createEmptyMetrics(numMonths),
            PMO_Budget: createEmptyMetrics(numMonths)
          };

          detailChildren.push({
            id: `group:${p.id}:expenses`,
            key: `group:${p.id}:expenses`,
            name: 'Operational Expenses',
            type: 'detail_group',
            level: 4,
            parentKey: `proj:${p.id}`,
            metrics: groupMetrics,
            children: expenseDetailItems,
            itemCount: expenseItemsList.length
          });
        }

        const projNode: AnalyticsTreeNode = {
          id: `proj:${p.id}`,
          key: `proj:${p.id}`,
          name: p.name || 'Unnamed Project',
          code: p.code || '',
          type: 'project',
          level: 3,
          categoryKey: catName,
          subcategoryKey: subName,
          parentKey: `sub:${catName}:${subName}`,
          projectObj: p,
          status: p.status || 'Active',
          vertical: p.vertical,
          manager: p.manager || p.pdh || '',
          customer: p.customer || '',
          isNew: getProjectCategory(p, selectedFY).isNew,
          metrics: pMetrics,
          children: detailChildren,
          itemCount: 1,
          skills,
          expenses
        };

        projectNodes.push(projNode);

        // Roll up to Subcategory metrics
        MODES.forEach(m => {
          const sm = subcatMetrics[m];
          const pm = pMetrics[m];
          sm.manpowerMM += pm.manpowerMM;
          sm.directMM += pm.directMM;
          sm.contractedMM += pm.contractedMM;
          sm.manpowerCr += pm.manpowerCr;
          sm.expenseCr += pm.expenseCr;
          sm.totalCr += pm.totalCr;
          sm.budgetCr += pm.budgetCr;
          sm.newMM += pm.newMM;
          sm.carryOverMM += pm.carryOverMM;
          for (let i = 0; i < numMonths; i++) {
            sm.monthlyData[i] += pm.monthlyData[i] || 0;
            sm.monthlyManpowerMM![i] += pm.monthlyManpowerMM?.[i] || 0;
            sm.monthlyExpenseCr![i] += pm.monthlyExpenseCr?.[i] || 0;
          }
        });
      });

      const subNode: AnalyticsTreeNode = {
        id: `sub:${catName}:${subName}`,
        key: `sub:${catName}:${subName}`,
        name: subName,
        type: 'subcategory',
        level: 2,
        categoryKey: catName,
        parentKey: `cat:${catName}`,
        metrics: subcatMetrics,
        children: projectNodes,
        itemCount: projectList.length
      };

      subcatNodes.push(subNode);
      catProjectCount += projectList.length;

      // Roll up to Category metrics
      MODES.forEach(m => {
        const cm = catMetrics[m];
        const sm = subcatMetrics[m];
        cm.manpowerMM += sm.manpowerMM;
        cm.directMM += sm.directMM;
        cm.contractedMM += sm.contractedMM;
        cm.manpowerCr += sm.manpowerCr;
        cm.expenseCr += sm.expenseCr;
        cm.totalCr += sm.totalCr;
        cm.budgetCr += sm.budgetCr;
        cm.newMM += sm.newMM;
        cm.carryOverMM += sm.carryOverMM;
        for (let i = 0; i < numMonths; i++) {
          cm.monthlyData[i] += sm.monthlyData[i] || 0;
          cm.monthlyManpowerMM![i] += sm.monthlyManpowerMM?.[i] || 0;
          cm.monthlyExpenseCr![i] += sm.monthlyExpenseCr?.[i] || 0;
        }
      });
    });

    const catNode: AnalyticsTreeNode = {
      id: `cat:${catName}`,
      key: `cat:${catName}`,
      name: catName,
      type: 'category',
      level: 1,
      categoryKey: catName,
      metrics: catMetrics,
      children: subcatNodes,
      itemCount: catProjectCount
    };

    tree.push(catNode);
  });

  return tree;
}

// Filter tree based on search text (searches name, code, vertical, manager, skill)
export function filterAnalyticsTree(
  tree: AnalyticsTreeNode[], 
  query: string
): { filteredTree: AnalyticsTreeNode[]; matchedIds: Set<string> } {
  const cleanQ = query.toLowerCase().trim();
  if (!cleanQ) {
    return { filteredTree: tree, matchedIds: new Set<string>() };
  }

  const matchedIds = new Set<string>();

  function filterNode(node: AnalyticsTreeNode): AnalyticsTreeNode | null {
    const isSelfMatch = 
      node.name.toLowerCase().includes(cleanQ) ||
      (node.code && node.code.toLowerCase().includes(cleanQ)) ||
      (node.vertical && node.vertical.toLowerCase().includes(cleanQ)) ||
      (node.manager && node.manager.toLowerCase().includes(cleanQ)) ||
      (node.customer && node.customer.toLowerCase().includes(cleanQ));

    const filteredChildren: AnalyticsTreeNode[] = [];
    node.children.forEach(child => {
      const filteredChild = filterNode(child);
      if (filteredChild) filteredChildren.push(filteredChild);
    });

    if (isSelfMatch || filteredChildren.length > 0) {
      matchedIds.add(node.id);
      return {
        ...node,
        children: filteredChildren
      };
    }

    return null;
  }

  const filteredTree: AnalyticsTreeNode[] = [];
  tree.forEach(node => {
    const filtered = filterNode(node);
    if (filtered) filteredTree.push(filtered);
  });

  return { filteredTree, matchedIds };
}

// Sort nodes at each level of the tree
export function sortAnalyticsTree(
  tree: AnalyticsTreeNode[],
  field: TreeSortField,
  order: TreeSortOrder,
  primaryMode: FiscalMode = 'Budget'
): AnalyticsTreeNode[] {
  function sortNodes(nodes: AnalyticsTreeNode[]): AnalyticsTreeNode[] {
    const copy = [...nodes];
    copy.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (field === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (field === 'manpowerMM') {
        valA = a.metrics[primaryMode]?.manpowerMM || 0;
        valB = b.metrics[primaryMode]?.manpowerMM || 0;
      } else if (field === 'totalCr') {
        valA = a.metrics[primaryMode]?.totalCr || 0;
        valB = b.metrics[primaryMode]?.totalCr || 0;
      } else if (field === 'variance') {
        const actualA = a.metrics['Actuals']?.totalCr || 0;
        const budgetA = a.metrics['Budget']?.totalCr || 0;
        const actualB = b.metrics['Actuals']?.totalCr || 0;
        const budgetB = b.metrics['Budget']?.totalCr || 0;
        valA = actualA - budgetA;
        valB = actualB - budgetB;
      }

      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return copy.map(n => ({
      ...n,
      children: sortNodes(n.children)
    }));
  }

  return sortNodes(tree);
}
