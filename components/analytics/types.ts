import { FiscalMode, FiscalYear } from '../../types';

export interface TreeNodeMetrics {
  manpowerMM: number;
  directMM: number;
  contractedMM: number;
  manpowerCr: number;
  expenseCr: number;
  totalCr: number;
  budgetCr: number;
  newMM: number;
  carryOverMM: number;
  monthlyData: number[]; // e.g. 12 months for selected FY
  monthlyManpowerMM?: number[];
  monthlyExpenseCr?: number[];
}

export type TreeNodeType = 'category' | 'subcategory' | 'project' | 'detail_group' | 'detail_item';

export interface AnalyticsTreeNode {
  id: string; // unique key, e.g. "cat:Projects", "sub:Projects:ECS-1", "proj:UMD-1024"
  key: string;
  name: string;
  code?: string;
  type: TreeNodeType;
  level: number; // 1 = Category, 2 = Subcategory, 3 = Project, 4 = Detail Group, 5 = Detail Item
  categoryKey?: string;
  subcategoryKey?: string;
  parentKey?: string;
  projectObj?: any;
  isNew?: boolean;
  status?: string;
  vertical?: string;
  manager?: string;
  customer?: string;
  metrics: Record<FiscalMode, TreeNodeMetrics>;
  children: AnalyticsTreeNode[];
  itemCount: number; // total projects count under this branch
  // Map of skills and expenses for project detail levels
  skills?: Record<string, { mm: number; cr: number; monthly: number[] }>;
  expenses?: Record<string, { cr: number; monthly: number[] }>;
}

export type TreeSortField = 'name' | 'manpowerMM' | 'totalCr' | 'variance';
export type TreeSortOrder = 'asc' | 'desc';
