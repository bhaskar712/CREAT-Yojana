
export type Project = ProjectData;
export type MasterConfig = MasterConfigState;

export interface SyncConfig {
  url: string;
  key: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'unconfigured' | 'pending';

export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type TbcStatus = 'tbc' | 'not tbc';
export type ProjectStatus = '-' | 'Active' | 'Bookshelve' | 'Closed' | 'On Hold' | 'Planned' | 'SOP' | 'Transfer';

export type FiscalYear = 'All FY' | 'FY 19-20' | 'FY 20-21' | 'FY 21-22' | 'FY 22-23' | 'FY 23-24' | 'FY 24-25' | 'FY 25-26' | 'FY 26-27' | 'FY 27-28' | 'FY 28-29' | 'FY 29-30' | 'FY 30-31';

export type FiscalMode = 'Budget' | 'Actuals' | 'Variance' | 'Forecast' | 'PMO_Budget';

export interface RemarkEntry {
  text: string;
  userId: string;
  username: string;
  timestamp: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  username: string;
  action: string;
  details: string;
  type: 'create' | 'update' | 'delete' | 'system';
}

export interface Employee {
  id: string;
  empId: string;
  name: string;
  band: string;
  vertical: string;
  functionalTeam?: string; 
  frmId?: string; 
  prmId?: string; 
  category: string; 
  location: string;
  skill: string; 
  skillLevel2: string; 
  productFamily: string;
  allocatedProjectId?: string;
  remarks?: string; 
  email?: string;
  status?: 'Active' | 'Inactive';
  seat?: string;
  seatIndex?: number;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  dateOfJoining?: string;
}

export interface TaskInfo {
  name: string;
  percentage: number;
  hours: number;
  monthlyAllocations?: number[];
  monthlyHours?: number[];
}

export interface ProjectData {
  id: string;
  vertical: string; 
  code: string;
  name: string;
  category: string;
  status: ProjectStatus;
  buDomain: string;
  businessUnit: string;
  projectType: string;
  productFamily: string;
  generation?: 'Current' | 'Level Up + 1' | 'Level Up + 2';
  pace: string;
  segment: string;
  tbc?: string;
  customer?: string;
  pdh?: string;
  rdPfs?: string;
  buPfs?: string;
  sopMonth?: string;
  sopFyYear?: string;
  timelineOffset: number; 
  igGates: string[]; 
  currentGate?: string; 
  isLocked?: boolean; 
  remarks?: RemarkEntry[]; 
  rowRemarks?: { [category: string]: RemarkEntry[] }; 
  rows: {
    [category: string]: number[]; 
  };
  pmoRows: {
    [category: string]: number[]; 
  };
  actuals: {
    [category: string]: number[]; 
  };
  forecast: {
    [category: string]: number[]; 
  };
  forecastMonths?: number;
  prevYearBudget?: number;
  budgetMode?: 'fixed' | 'detailed';
  expenseTillMar26?: number;
  mappedSummary?: {
    skills: string[];
    expenses: string[];
  };
  budgetFYs?: string[]; 
  actualsFYs?: string[];
  forecastFYs?: string[];
  fiscalYear?: string;
  pmoEmployeeSkills?: { [skill: string]: { [email: string]: number[] } };
  actualsEmployeeSkills?: { [skill: string]: { [email: string]: number[] } };
  forecastEmployeeSkills?: { [skill: string]: { [email: string]: number[] } };
  employeeSkills?: { [skill: string]: { [email: string]: number[] } };
  pmoExpenseDetails?: { [category: string]: { [detail: string]: number[] } };
  actualsExpenseDetails?: { [category: string]: { [detail: string]: number[] } };
  forecastExpenseDetails?: { [category: string]: { [detail: string]: number[] } };
  expenseDetails?: { [category: string]: { [detail: string]: number[] } };
  pmoSkills?: { [category: string]: number[] };
  skills?: { [category: string]: number[] };
  actualsSkills?: { [category: string]: number[] };
  forecastSkills?: { [category: string]: number[] };
  expenses?: { [category: string]: number[] };
  manpowerSpent?: number;
  manpowerSpentCr?: number;
  expenseSpent?: number;
  expenseSpentCr?: number;
  actualSpent?: number;
  portfolioBudgetCr?: number;
  actualSpentCr?: number;
  monthlyFTEs?: number[];
  monthlyExpenses?: number[];
  employeeBillableHours?: { [email: string]: number[] };
  employeeNonBillableHours?: { [email: string]: number[] };
  employeeIdleHours?: { [email: string]: number[] };
  projectTasks?: { [taskList: string]: TaskInfo[] };
  employeeTasks?: { [email: string]: { [taskList: string]: TaskInfo[] } };
  employeeInfo?: { [email: string]: { 
    name: string, 
    email: string, 
    empId?: string, 
    band?: string, 
    vertical?: string, 
    category?: string, 
    location?: string, 
    skill?: string, 
    skillLevel2?: string, 
    productFamily?: string 
  } };
}

export interface MasterProject {
  id: string;
  vertical: string; 
  code: string;
  productFamily: string;
  name: string;
  category: string;
  buDomain: string; 
  businessUnit: string; 
  customer?: string;
  pdh?: string;
  projectType: string; 
  pace?: string; 
  segment?: string; 
  tbc?: string;
  generation?: string;
  rdPfs?: string;
  buPfs?: string;
  sopMonth?: string;
  sopFyYear?: string;
  status?: ProjectStatus;
  timelineOffset?: number;
  igGates?: string[];
  currentGate?: string;
  forecastMonths?: number;
  createdAt?: number;
  
  // New Fields
  startDate?: string;
  applicableFYs: FiscalYear[];
}

export interface DomainAggregation {
  domain: string;
  manpowerMM: number[];
  manpowerINR: number[]; 
  expensesB: number[];   
  totalC: number[];      
  categoryBreakdown: {
    [category: string]: number[];
  };
}

export enum AppTab {
  HOME = 'home',
  ENTRY = 'entry',
  DASHBOARD = 'dashboard',
  PMO = 'pmo',
  SETTINGS = 'settings',
  USERS = 'users',
  ABOUT = 'about',
  CONFIG = 'config',
  HR_RESOURCES = 'hr_resources',
  DCBA_PORTAL = 'dcba_portal',
  MASTER_PROJECTS = 'master_projects',
  SEAT_ALLOCATION = 'seat_allocation',
  PMO_ANALYTICS = 'pmo_analytics'
}

export type UserRole = 'Super Admin' | 'Admin' | 'NA';
export type AccessLevel = 'Editor' | 'Viewer' | 'None';

export interface User {
  id: string;
  username: string;
  password?: string; 
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  assignedVerticals: string[]; 
  verticalPermissions?: Record<string, AccessLevel>; 
  unrestrictedViewer?: boolean; 
  lastLogin: string;
  lastActiveAt?: string; 
  hasResourceAccess?: boolean; 
}

export interface DeletionTarget {
  type: 'master' | 'user' | 'project' | 'employee' | 'projects' | 'employees';
  id: string;
  name: string;
}

export interface FYFinancialConfig {
  hourlyRate: number;
  hoursPerMonth: number;
  contractedEmployeeRate: number;
}

export interface BenchmarkSet {
  manpower: Record<string, number>; 
  expenses: Record<string, number>;  
}

export interface MasterConfigState {
  verticals: string[];
  functionalTeams: string[]; 
  buDomains: string[];
  businessUnits: string[];
  projectTypes: string[];
  productFamilies: string[];
  segments: string[];
  paces: string[];
  customers: string[];
  projectCategories: string[];
  bands: string[];
  employeeCategories: string[];
  locations: string[];
  skillLevelsL2: string[];
  pfsStatuses?: string[];
  pmtTechSalesOptions?: string[];
  
  // Per-FY Financial Settings
  fyFinancials: Record<string, FYFinancialConfig>;
  
  // Per-FY Benchmarks (LY Actuals)
  fyBenchmarks: Record<string, Record<string, BenchmarkSet>>;
  
  // Legacy fields
  hourlyRate: number;
  hoursPerMonth: number;
  contractedEmployeeRate: number;
  benchmarks?: Record<string, BenchmarkSet>; // Keep for migration
  
  isFiscalLocked?: boolean;
  fiscalLocks?: Record<string, boolean>; // Key formats: "budget_page_FY 25-26", "pmo_page_FY 25-26_master", "pmo_page_FY 25-26_Budget"
  forecastMonthLocks?: Record<string, boolean[]>; // Key: "FY 25-26", Value: boolean[12]
  defaultBudgetMonths?: number;
  defaultForecastMonths?: number;
  currentMonthIndex?: MonthIndex;
  forecastEligibleMonths?: MonthIndex[];
}

export const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const VERTICALS = ['ECS-1', 'ECS-2', 'LAS', 'CoC', 'INITIA', 'ATG', 'Support', 'SCS'];
export const BU_DOMAINS = ['ACS', 'ECS', 'LAS', 'SCS'];
export const PACE_OPTIONS = ['Personalization', 'Autonomous', 'Connected', 'Electrified', 'NA'];
export const SEGMENT_OPTIONS = ['PV', 'CV_OR', '2W_3W', 'NA'];
export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ['-', 'Active', 'Bookshelve', 'Closed', 'On Hold', 'Planned', 'SOP', 'Transfer'];
export const PROJECT_CATEGORY_OPTIONS = ['CarryOver', 'New'];

export const BUSINESS_UNIT_OPTIONS = [
  'Controller', 'MTNI', '2W Switch', 'ADAS & Sensor', 'UMRPL', 'Acoustic', '2W Lighting', 'UMEVS', 'NA'
];

export const PROJECT_TYPE_OPTIONS = [
  'Anchor', 'HD', 'Transferred', 'R&D PFS', 'PoC', 'Engineering Service', 'Potential C2B', 'NA'
];

export const PRODUCT_FAMILY_OPTIONS = [
  'Ambient Lighting System',
  'ARAS Solution',
  'Automotive Camera',
  'Automotive Wireless Chargers',
  'AVAS',
  'Body Control Module',
  'Digital Key System',
  'EV AC Chargers (Portable)',
  'EV AC-DC Chargers',
  'EV DC-DC Converter',
  'Hand Control Module',
  'Head Lamp',
  'HVAC Controller',
  'IMU Sensor',
  'Interior Lamp',
  'IVI',
  'NA',
  'Ornamental Lamp',
  'Over Head Console',
  'SBDT',
  'Seating ECU',
  'Seats with Mechanisms',
  'Smart Switches',
  'Tail Lamp',
  'Telematics Control Unit',
  'TPMS',
  'Ultrasonic Sensor System',
  'USB and Data Port Chargers',
  'Auto Expo'
];

export const MANPOWER_CATEGORIES = [
  "Product Manager",
  "PDTL",
  "Systems",
  "Product Planning",
  "Tech Sales",
  "Costing Cell",
  "NPC",
  "Hardware_CoC",
  "Hardware_Vertical",
  "ECAD",
  "Component Engineer",
  "Lab Engineer",
  "Mechanical_CoC",
  "Mechanical_Vertical",
  "Material Science",
  "CAE",
  "Optics",
  "Software_CoC",
  "Software CS & FuSA",
  "Software_Vertical",
  "INITIA",
  "Proto Engineer",
  "Application Engg",
  "Validation_CoC",
  "Validation_Vertical",
  "Manufacturing Engineering",
  "Quality",
  "Unspecified Skill",
  "Contracted Employee"
];

export const RESOURCE_SKILLS = [
  ...MANPOWER_CATEGORIES,
  "Human Resource",
  "Finance",
  "Purchase",
  "Management",
  "Admin"
];

export const EXPENSE_CATEGORIES = [
  "Travel", "Material", "Labs", "License", "Consultant", "HR", "Admin", "Others", "Contracted Employee", "Contracted Employee Expense"
];

export const getAbsoluteMonthIndex = (monthLabel: string): number => {
  const parts = monthLabel.split('-');
  if (parts.length < 2) return -1;
  const monthName = parts[0];
  const yearVal = parseInt(parts[1]);
  const year = yearVal < 100 ? 2000 + yearVal : yearVal;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthIdx = months.indexOf(monthName);
  if (monthIdx === -1) return -1;
  
  if (monthIdx >= 3) {
    // Apr to Dec
    return (year - 2019) * 12 + (monthIdx - 3);
  } else {
    // Jan to Mar
    return (year - 2020) * 12 + (monthIdx + 9);
  }
};

export const getMonthsForFY = (fy: FiscalYear | null | undefined): string[] => {
  if (!fy || fy === 'All FY') return [];
  const parts = fy.replace('FY ', '').split('-');
  const startYY = parts[0];
  const endYY = parts[1];
  return [
    `Apr-${startYY}`, `May-${startYY}`, `Jun-${startYY}`, 
    `Jul-${startYY}`, `Aug-${startYY}`, `Sep-${startYY}`, 
    `Oct-${startYY}`, `Nov-${startYY}`, `Dec-${startYY}`, 
    `Jan-${endYY}`, `Feb-${endYY}`, `Mar-${endYY}`
  ];
};

export const getMultiYearMonths = (): string[] => {
  return [
    ...getMonthsForFY('FY 19-20'),
    ...getMonthsForFY('FY 20-21'),
    ...getMonthsForFY('FY 21-22'),
    ...getMonthsForFY('FY 22-23'),
    ...getMonthsForFY('FY 23-24'),
    ...getMonthsForFY('FY 24-25'),
    ...getMonthsForFY('FY 25-26'),
    ...getMonthsForFY('FY 26-27'),
    ...getMonthsForFY('FY 27-28'),
    ...getMonthsForFY('FY 28-29'),
    ...getMonthsForFY('FY 29-30'),
    ...getMonthsForFY('FY 30-31')
  ];
};

export const getMonthsForMultiFY = (fys: (FiscalYear | string)[]): string[] => {
  if (fys.includes('All FY')) return getMultiYearMonths();
  
  // Sort FYs to ensure chronological order in the month list
  const sortedFys = [...fys].sort((a, b) => {
    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    const yearA = matchA ? parseInt(matchA[0]) : 0;
    const yearB = matchB ? parseInt(matchB[0]) : 0;
    return yearA - yearB;
  });
  
  const allMonths: string[] = [];
  sortedFys.forEach(fy => {
    allMonths.push(...getMonthsForFY(fy as FiscalYear));
  });
  return allMonths;
};

export const getPreviousFY = (fy: FiscalYear): FiscalYear | null => {
  if (fy === 'FY 30-31') return 'FY 29-30';
  if (fy === 'FY 29-30') return 'FY 28-29';
  if (fy === 'FY 28-29') return 'FY 27-28';
  if (fy === 'FY 27-28') return 'FY 26-27';
  if (fy === 'FY 26-27') return 'FY 25-26';
  if (fy === 'FY 25-26') return 'FY 24-25';
  if (fy === 'FY 24-25') return 'FY 23-24';
  if (fy === 'FY 23-24') return 'FY 22-23';
  if (fy === 'FY 22-23') return 'FY 21-22';
  return null;
};

export const getNextFY = (fy: FiscalYear): FiscalYear | null => {
  if (fy === 'FY 21-22') return 'FY 22-23';
  if (fy === 'FY 22-23') return 'FY 23-24';
  if (fy === 'FY 23-24') return 'FY 24-25';
  if (fy === 'FY 24-25') return 'FY 25-26';
  if (fy === 'FY 25-26') return 'FY 26-27';
  if (fy === 'FY 26-27') return 'FY 27-28';
  if (fy === 'FY 27-28') return 'FY 28-29';
  if (fy === 'FY 28-29') return 'FY 29-30';
  if (fy === 'FY 29-30') return 'FY 30-31';
  return null;
};

export const MONTH_NAMES = getMonthsForFY('FY 26-27');

export const INITIAL_USERS: User[] = [
  {
    id: '1',
    username: 'admin.user',
    password: 'password',
    email: 'admin@company.com',
    role: 'Super Admin',
    status: 'Active',
    assignedVerticals: ['All'],
    verticalPermissions: { 'Global': 'Editor' },
    lastLogin: 'Never',
    hasResourceAccess: true
  }
];

export const PFS_STATUS_OPTIONS = [
  'TBD',
  'Carryover (NA)',
  'Pre-PFS In-Progress',
  'Pre-PFS Completed',
  'Stage 1 In-Progress',
  'Stage 1 Completed'
] as const;

export type DCBAStage = 'T' | 'P' | 'E' | 'D' | 'C' | 'B' | 'A' | 'H' | 'L';

export interface Opportunity {
  id: string;
  productFamily: string;
  domain: string;
  customerName: string;
  segment: string;
  stage: DCBAStage;
  value: number; // Derived: Tentative Price x Peak Year Volume (in Cr)
  sopDate: string;
  probability: number; // 0 to 1
  status: 'Open' | 'Won' | 'Lost' | 'On Hold' | 'Past';
  updatedAt: string;
  
  // New detailed fields
  vertical: string;
  businessUnit: string;
  type: string; // e.g. New, Carry Over
  fiscalYear: string;
  productDescription?: string;
  rfiRfqReceiveDate?: string;
  pmtTechSales?: string;
  targetLoiDate?: string;
  actualLoiDate?: string;
  pfsStatus?: string;
  tentativePrice?: number;
  sw?: string;
  hw?: string;
  me?: string;
  bu?: string;
  
  // Existing optional fields
  remarks?: RemarkEntry[];
  marketingContact?: string;
  vth?: string;
  peakYearVolume?: number;
  programLifeYears?: number;
  fyValue?: number;
}

export const DCBA_STAGES: { value: DCBAStage; label: string; description: string; color: string }[] = [
  { value: 'T', label: 'Target', description: 'Identified as a potential target', color: 'bg-slate-400' },
  { value: 'P', label: 'PoC', description: 'Proof of Concept', color: 'bg-yellow-500' },
  { value: 'E', label: 'Discussion', description: 'Preliminary discussions ongoing', color: 'bg-blue-400' },
  { value: 'D', label: 'RFI Received', description: 'Request for Information received', color: 'bg-indigo-400' },
  { value: 'C', label: 'RFQ Received', description: 'Request for Quotation received', color: 'bg-purple-400' },
  { value: 'B', label: 'Awarded', description: 'Business awarded, under development', color: 'bg-emerald-400' },
  { value: 'A', label: 'Production', description: 'Development done, in production', color: 'bg-orange-400' },
  { value: 'H', label: 'Hold', description: 'On Hold', color: 'bg-amber-500' },
  { value: 'L', label: 'Lost', description: 'Opportunity Lost', color: 'bg-rose-500' },
];

export const INITIAL_MASTER_PROJECTS: MasterProject[] = [];
