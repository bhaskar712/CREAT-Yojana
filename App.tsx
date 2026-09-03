
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LZString from 'lz-string';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ProjectData, 
  AppTab, 
  VERTICALS, 
  MANPOWER_CATEGORIES, 
  EXPENSE_CATEGORIES, 
  ProjectStatus,
  PROJECT_STATUS_OPTIONS,
  getMonthsForFY,
  getMultiYearMonths,
  getPreviousFY,
  getMonthsForMultiFY,
  getAbsoluteMonthIndex,
  User,
  INITIAL_USERS,
  MasterConfigState,
  DeletionTarget,
  BUSINESS_UNIT_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PRODUCT_FAMILY_OPTIONS,
  SEGMENT_OPTIONS,
  PACE_OPTIONS,
  RemarkEntry,
  AuditLogEntry,
  BU_DOMAINS,
  FiscalYear,
  Employee,
  FiscalMode,
  MasterProject,
  generateUUID
} from './types';
import { RATE_PER_HOUR, HOURS_PER_MONTH, getStorageKey, MAX_MONTHS, ALL_FISCAL_YEARS, DEFAULT_FY, CONTRACTED_EMPLOYEE_RATE, SKILL_MAPPING, isConfirmedProject, repairProjectSkills, isSummaryOrCalculatedLabel, classifyCategory } from './constants';
import BudgetTable from './components/BudgetTable';
import Dashboard, { PortfolioIntelligenceBar } from './components/Dashboard';
import AboutPage from './components/AboutPage';
import MasterConfig from './components/MasterConfig';
import { syncService, getYearKey as getCloudYearKey } from './services/syncService';
import { FilterBar } from './components/Filters';
import HRManagement from './components/HRManagement';
import PMO from './components/PMO';
import { ImportInspectionModal } from './components/ImportInspectionModal';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { BudgetView } from './components/BudgetView';
import { DashboardView } from './components/DashboardView';
import { PMOView } from './components/PMOView';
import { ResourcesView } from './components/ResourcesView';
import { MasterProjectList } from './components/MasterProjectList';
import { ConfigView } from './components/ConfigView';
import { exportProjectRegistry, processExcelImport } from './services/exportService';
import { ModalLabel, ModalInput, ModalSelect } from './components/ModalUtils';
import { Logo } from './components/Logo';
import { Footer } from './components/Footer';
import { NotificationToast } from './components/NotificationToast';
import { FiscalYearSelector } from './components/FiscalYearSelector';
import { AddProjectModal } from './components/AddProjectModal';
import { DeletionConfirmationModal } from './components/DeletionConfirmationModal';
import { HomeView } from './components/HomeView';
import { DCBAPortal } from './components/DCBAPortal';

const isNew = (cat: string) => (cat || '').trim().toLowerCase().includes('new');
const isCO = (cat: string) => (cat || '').trim().toLowerCase().includes('carry');

const SESSION_KEY = 'creat_yojana_active_session';
const REMEMBER_ME_KEY = 'creat_yojana_remembered_identity';
const SYNC_CONFIG_KEY = 'creat_yojana_sync_config';
const LAST_ACTIVITY_KEY = 'creat_yojana_last_activity_time';
const SELECTED_FY_KEY = 'creat_yojana_selected_fy';
const TAB_FY_MAP_KEY = 'creat_yojana_tab_fy_map';
const REOPEN_TIMEOUT = 10 * 60 * 1000;

const INITIAL_MASTER_CONFIG: MasterConfigState = { 
  verticals: VERTICALS, 
  functionalTeams: [
    "Finance", "ECS-1", "Mechanical", "Hardware", "Management", "INITIA", "LAS", "ECS-2", 
    "Human Resource", "V&V", "Costing Cell", "Tech Sales", "Purchase", "Manufacturing Engineering", 
    "Product Planning", "Software", "NPC", "Quality", "Admin", "Material Science"
  ],
  buDomains: BU_DOMAINS, 
  businessUnits: BUSINESS_UNIT_OPTIONS, 
  projectTypes: PROJECT_TYPE_OPTIONS, 
  productFamilies: PRODUCT_FAMILY_OPTIONS, 
  segments: SEGMENT_OPTIONS, 
  paces: PACE_OPTIONS, 
  customers: ["Suzuki PV", "VECV", "HMCL", "TML PV", "REML", "TG", "TVSM", "HONDA PV", "M&M PV", "TBD", "Olectra", "ALL", "KTM", "JSW", "Honda 2W", "Volvo", "NA"], 
  projectCategories: ['New', 'CarryOver'], 
  bands: [...Array.from({ length: 18 }, (_, i) => `B${i}`), 'I1'],
  employeeCategories: ['Employee - CREAT', 'Employee - ATG', 'Consultant - CREAT', 'Consultant - ATG'],
  locations: [
    'CREAT Pune (ICC)', 
    'CREAT Pune (KWT)', 
    'CREAT Gurgaon', 
    'CREAT Chennai', 
    'CREAT Bengaluru', 
    'CREAT GmBH', 
    'NA', 
    'TBD 2', 
    'TBD 3'
  ],
  skillLevelsL2: ['AUTOSAR Stack', 'Hardware Design', 'Mechanical CAD', 'System Engineering', 'Project Management', 'Validation Testing', 'Quality Assurance'],
  pfsStatuses: [
    'TBD',
    'Carryover (NA)',
    'Pre-PFS In-Progress',
    'Pre-PFS Completed',
    'Stage 1 In-Progress',
    'Stage 1 Completed'
  ],
  pmtTechSalesOptions: ['Bhaskar Paul', 'Dikshu Dhar', 'Suleman A', 'Safal Jain', 'Anjali Sharma'],
  fyFinancials: {
    'FY 24-25': { hourlyRate: 1600, hoursPerMonth: 180, contractedEmployeeRate: 1600 },
    'FY 25-26': { hourlyRate: 1650, hoursPerMonth: 180, contractedEmployeeRate: 1650 },
    'FY 26-27': { hourlyRate: 1450, hoursPerMonth: 180, contractedEmployeeRate: 1450 }
  },
  fyBenchmarks: {},
  hourlyRate: RATE_PER_HOUR, 
  hoursPerMonth: HOURS_PER_MONTH, 
  contractedEmployeeRate: CONTRACTED_EMPLOYEE_RATE,
  isFiscalLocked: false,
  currentMonthIndex: 0,
  fiscalLocks: {}
};










const getInitialState = <T,>(key: string, defaultValue: T): T => {
  if (key === 'employees') {
    const savedGlobal = localStorage.getItem('global-employees-v1');
    if (savedGlobal) {
      try {
        let parsedString = savedGlobal;
        if (!savedGlobal.startsWith('{') && !savedGlobal.startsWith('[')) {
          try {
            parsedString = LZString.decompressFromUTF16(savedGlobal) || savedGlobal;
          } catch (e) {
            // Fallback if decompression fails
          }
        }
        return JSON.parse(parsedString) as T;
      } catch {
        // Fallback to legacy location
      }
    }
  }

  if (key === 'masterProjects') {
    const savedMaster = localStorage.getItem('masterProjects');
    if (savedMaster) {
      try {
        return JSON.parse(savedMaster) as T;
      } catch (e) {}
    }
  }

  const fy = (localStorage.getItem(SELECTED_FY_KEY) as FiscalYear) || DEFAULT_FY;
  
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  const primary = segments.length > 0 ? segments[0] : undefined;
  const secondary = segments[1];
  let mode = localStorage.getItem('last_fiscal_mode') || 'Budget';
  
  if (primary === 'pmo' || primary === 'analytics') {
    const s2 = (secondary || '').toLowerCase();
    mode = (s2 === 'actuals' || s2 === 'forecast' || s2 === 'budget' || s2 === 'variance') ? s2 : 'forecast';
    mode = mode.charAt(0).toUpperCase() + mode.slice(1);
    if (mode === 'Actuals') mode = 'Actuals';
  }

  const saved = localStorage.getItem(getStorageKey(fy, mode));
  if (!saved) return defaultValue;
  try {
    let parsedString = saved;
    if (!saved.startsWith('{') && !saved.startsWith('[')) {
      try {
        parsedString = LZString.decompressFromUTF16(saved) || saved;
      } catch (e) {
        // Fallback if decompression fails
      }
    }
    const parsed = JSON.parse(parsedString) as any;
    return (parsed[key] !== undefined && parsed[key] !== null) ? (parsed[key] as T) : defaultValue;
  } catch {
    return defaultValue;
  }
};







const HR_TREE_PERSISTENCE_KEY = 'creat_yojana_hr_tree_state';

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (typeof saved === 'string' && typeof lastActive === 'string') {
      const elapsed = Date.now() - parseInt(lastActive, 10);
      if (elapsed > REOPEN_TIMEOUT && (lastActive !== '0')) { 
        localStorage.removeItem(SESSION_KEY); 
        localStorage.removeItem(LAST_ACTIVITY_KEY); 
        return null; 
      }
      try {
        return JSON.parse(saved) as User;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [selectedFYs, setSelectedFYs] = useState<FiscalYear[]>(() => {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    // Parse single FY segment from URL
    const fyRawSegments = segments.filter(s => s.startsWith('fy-') || s === 'all-fy');
    if (fyRawSegments.length > 0) {
      const segment = fyRawSegments[0];
      if (segment === 'all-fy') return ['All FY' as FiscalYear];
      if (segment.startsWith('fy-')) return [segment.toUpperCase().replace('-', ' ') as FiscalYear];
    }

    const saved = localStorage.getItem(SELECTED_FY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
        return [saved as FiscalYear];
      } catch {
        return [saved as FiscalYear];
      }
    }
    return [DEFAULT_FY as FiscalYear];
  });

  const selectedFY = selectedFYs[0] || DEFAULT_FY; // Compatibility layer for single-FY consumers

  const [fiscalMode, setFiscalMode] = useState<FiscalMode>(() => {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const primary = segments.length > 0 ? segments[0] : undefined;
    
    if (primary === 'budget') return 'Budget';
    if (primary === 'pmo') {
      const s2 = (segments[2] || '').toLowerCase();
      const s1 = (segments[1] || '').toLowerCase();
      const mode = (s2 === 'actuals' || s2 === 'forecast' || s2 === 'budget') ? s2 : 
                   (s1 === 'actuals' || s1 === 'forecast' || s1 === 'budget' ? s1 : 'forecast');
      return mode === 'actuals' ? 'Actuals' : (mode === 'budget' ? 'Budget' : 'Forecast');
    }
    if (primary === 'analytics') {
      const s1 = (segments[1] || '').toLowerCase();
      const mode = (s1 === 'actuals' || s1 === 'forecast' || s1 === 'budget') ? s1 : 'forecast';
      return mode === 'actuals' ? 'Actuals' : (mode === 'budget' ? 'Budget' : 'Forecast');
    }
    return 'Budget';
  });
  const [showEmptyActuals, setShowEmptyActuals] = useState(false);

  const currentMonths = useMemo(() => {
    return getMonthsForMultiFY(selectedFYs);
  }, [selectedFYs]);

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'conflict' } | null>(null);
  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'conflict' = 'info') => setNotification({ message, type }), []);
  
  useEffect(() => { if (notification && notification.type !== 'conflict') { const timer = setTimeout(() => setNotification(null), 5000); return () => clearTimeout(timer); } }, [notification]);

  const [loginForm, setLoginForm] = useState({ username: localStorage.getItem(REMEMBER_ME_KEY) || '', password: '' });
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem(REMEMBER_ME_KEY));
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return AppTab.HOME;
    const primary = segments.length > 0 ? segments[0] : undefined;
    if (primary === 'pmo') return AppTab.PMO;
    if (primary === 'resources') return AppTab.HR_RESOURCES;
    if (primary === 'seat-allocation') return AppTab.SEAT_ALLOCATION;
    if (primary === 'analytics') return AppTab.DASHBOARD;
    if (primary === 'config') return AppTab.CONFIG;
    if (primary === 'about') return AppTab.ABOUT;
    if (primary === 'dcba') return AppTab.DCBA_PORTAL;
    if (primary === 'master-projects') return AppTab.MASTER_PROJECTS;
    return AppTab.HOME;
  });

  const [tabFYMap, setTabFYMap] = useState<Record<string, FiscalYear>>(() => {
    const saved = localStorage.getItem(TAB_FY_MAP_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [processorSubTab, setProcessorSubTab] = useState<'list' | 'analytics'>(() => {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const primary = segments.length > 0 ? segments[0] : undefined;
    const secondary = segments[1];
    if (primary === 'pmo') {
      return secondary === 'analytics' ? 'analytics' : 'list';
    }
    return 'list';
  });

  const [dcbaViewMode, setDcbaViewMode] = useState<'list' | 'matrix' | 'yoy' | 'bcg' | 'dashboard'>(() => {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const primary = segments.length > 0 ? segments[0] : undefined;
    const secondary = segments[1];
    if (primary === 'dcba') {
      if (secondary === 'matrix') return 'matrix';
      if (secondary === 'yoy') return 'yoy';
      return 'list';
    }
    return 'list';
  });
  const [hrViewMode, setHrViewMode] = useState<'tabular' | 'graphical' | 'matrix' | 'dashboard'>('tabular');
  const [processorRawData, setProcessorRawData] = useState<any[]>([]);
  const [processorFileName, setProcessorFileName] = useState<string>(() => getInitialState('processorFileName', ''));
  const [processorMode, setProcessorMode] = useState<FiscalMode>(() => {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const primary = segments.length > 0 ? segments[0] : undefined;
    let urlMode: FiscalMode = 'Actuals';
    if (primary === 'pmo') {
      const s2 = (segments[2] || '').toLowerCase();
      const s1 = (segments[1] || '').toLowerCase();
      const mode = (s2 === 'actuals' || s2 === 'forecast' || s2 === 'budget') ? s2 : 
                   (s1 === 'actuals' || s1 === 'forecast' || s1 === 'budget' ? s1 : 'budget');
      urlMode = mode === 'actuals' ? 'Actuals' : (mode === 'budget' ? 'Budget' : 'Forecast');
    } else if (primary === 'analytics') {
      const s1 = (segments[1] || '').toLowerCase();
      const mode = (s1 === 'actuals' || s1 === 'forecast' || s1 === 'budget') ? s1 : 'actuals';
      urlMode = mode === 'actuals' ? 'Actuals' : (mode === 'budget' ? 'Budget' : 'Forecast');
    }
    const storedMode = getInitialState('processorMode', urlMode);
    return storedMode;
  });
  const [activeCategory, setActiveCategory] = useState<string>('verticals');
  const [seatAllocationSubTab, setSeatAllocationSubTab] = useState<'dashboard' | 'allocation' | 'master'>('dashboard');
  const isNavigatingRef = useRef(false);
  
  // FY Persistence Logic: Save FY when it changes
  useEffect(() => {
    console.log("FY change useEffect running, resetting initialization", { selectedFY });
    isInitializedRef.current = false;
    isDirtyRef.current = false;
  }, [selectedFY]);


  useEffect(() => {
    if (selectedFY && activeTab && activeTab !== AppTab.HOME) {
      const moduleKey = getModuleKey(activeTab, fiscalMode);
      setTabFYMap(prev => {
        if (prev[moduleKey] === selectedFY) return prev;
        const updated = { ...prev, [moduleKey]: selectedFY };
        localStorage.setItem(TAB_FY_MAP_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [selectedFY, activeTab, fiscalMode]);

  useEffect(() => {
    localStorage.setItem('last_fiscal_mode', fiscalMode);
  }, [fiscalMode]);

  const getModuleKey = useCallback((tab: AppTab, mode: FiscalMode) => {
    if (tab === AppTab.ENTRY || tab === AppTab.DASHBOARD) {
      return mode === 'Budget' ? 'Budget' : 'PMO';
    }
    if (tab === AppTab.PMO || tab === AppTab.PMO_ANALYTICS) return 'PMO';
    if (tab === AppTab.HR_RESOURCES) return 'Resources';
    if (tab === AppTab.SEAT_ALLOCATION) return 'Seats';
    if (tab === AppTab.CONFIG) return 'Config';
    if (tab === AppTab.ABOUT) return 'About';
    return 'Home';
  }, []);

  const [employees, setEmployees] = useState<Employee[]>(() => getInitialState('employees', []));
  const [rawProjects, setProjects] = useState<ProjectData[]>(() => getInitialState('projects', []));
  const projects = useMemo(() => repairProjectSkills(rawProjects, employees), [rawProjects, employees]);
  const [masterProjects, setMasterProjects] = useState<MasterProject[]>(() => getInitialState('masterProjects', []));
  const [history, setHistory] = useState<AuditLogEntry[]>(() => getInitialState('history', []));
  
  const [users, setUsers] = useState<User[]>(() => getInitialState('users', INITIAL_USERS));
  
  const [prevYearProjects, setPrevYearProjects] = useState<ProjectData[] | null>(null);
  const [isPrevYearLoading, setIsPrevYearLoading] = useState(false);

  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isImportInspectionOpen, setIsImportInspectionOpen] = useState(false);
  const [isImportTypeModalOpen, setIsImportTypeModalOpen] = useState(false);
  const [importType, setImportType] = useState<'raw' | 'processed'>('raw');
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [importTargetMode, setImportTargetMode] = useState<FiscalMode>('Budget');

  const [hrTreeZoom, setHrTreeZoom] = useState<number>(() => {
    const saved = localStorage.getItem(HR_TREE_PERSISTENCE_KEY);
    return saved ? JSON.parse(saved).zoom : 0.85;
  });
  const [hrTreeLayout, setHrTreeLayout] = useState<'horizontal' | 'columnar'>(() => {
    const saved = localStorage.getItem(HR_TREE_PERSISTENCE_KEY);
    return saved ? JSON.parse(saved).layout : 'horizontal';
  });
  const [hrCollapsedNodes, setHrCollapsedNodes] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(HR_TREE_PERSISTENCE_KEY);
    return saved ? new Set(JSON.parse(saved).collapsedNodes) : new Set();
  });

  const [budgetSortBy, setBudgetSortBy] = useState<'default' | 'manpower' | 'expense' | 'total'>('default');
  const [budgetSortOrder, setBudgetSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    localStorage.setItem(HR_TREE_PERSISTENCE_KEY, JSON.stringify({
      zoom: hrTreeZoom,
      layout: hrTreeLayout,
      collapsedNodes: Array.from(hrCollapsedNodes)
    }));
  }, [hrTreeZoom, hrTreeLayout, hrCollapsedNodes]);
  
  const [sharedFilters, setSharedFilters] = useState({ 
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
  
  const [masterConfig, setMasterConfig] = useState<MasterConfigState>(() => {
    const defaultState = INITIAL_MASTER_CONFIG;
    const saved = getInitialState<Partial<MasterConfigState>>('masterConfig', {});
    const combined = { ...defaultState, ...saved } as MasterConfigState;
    
    // Migration: Ensure correct employee categories and remove old naming conventions
    const requestedCategories = ['Employee - CREAT', 'Employee - ATG', 'Consultant - CREAT', 'Consultant - ATG'];
    const currentCats = combined.employeeCategories || [];
    const hasOldDrafts = currentCats.some(c => c.includes('CREAT-') || c.includes('-ATG') && !c.includes(' - '));
    
    if (hasOldDrafts) {
      // If we see old style like "CREAT-Employee", we replace the whole list with the requested ones
      // but keep any custom categories the user might have added that don't match the old pattern
      const customCats = currentCats.filter(c => !c.includes('CREAT-') && !c.includes('-ATG'));
      combined.employeeCategories = Array.from(new Set([...requestedCategories, ...customCats]));
    } else if (!requestedCategories.every(rc => currentCats.includes(rc))) {
      // Just ensure the requested ones are present
      combined.employeeCategories = Array.from(new Set([...requestedCategories, ...currentCats]));
    }

    // Ensure Support and SCS are present as requested
    if (combined.verticals && !combined.verticals.includes('Support')) {
      combined.verticals = [...combined.verticals, 'Support'];
    }
    if (combined.verticals && !combined.verticals.includes('SCS')) {
      combined.verticals = [...combined.verticals, 'SCS'];
    }

    const newBands = ['B13', 'B14', 'B15', 'B16', 'B17', 'I1'];
    newBands.forEach(b => {
      if (combined.bands && !combined.bands.includes(b)) {
        combined.bands = [...combined.bands, b];
      }
    });

    if (combined.benchmarks && Object.keys(combined.benchmarks).length > 0 && (!combined.fyBenchmarks['FY 25-26'])) {
        combined.fyBenchmarks['FY 25-26'] = combined.benchmarks;
    }
    return combined;
  });

  const currentFYFinancials = useMemo(() => {
    const fy = selectedFY || DEFAULT_FY;
    const config = masterConfig.fyFinancials?.[fy] || { hourlyRate: masterConfig.hourlyRate, hoursPerMonth: 180, contractedEmployeeRate: masterConfig.contractedEmployeeRate || 1650 };
    // User requested "ground is always 180 hours"
    return { ...config, hoursPerMonth: 180 };
  }, [selectedFY, masterConfig]);

  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);

  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // URL Synchronization Logic
  useEffect(() => {
    if (!currentUser || isNavigatingRef.current) return;
    
    let newPath = '/';
    const fySlug = selectedFYs.length > 0 
      ? (selectedFYs[0] === 'All FY' ? 'all-fy' : selectedFYs[0].toLowerCase().replace(' ', '-'))
      : 'fy-25-26';
    const modeSlug = (activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS)
      ? (processorMode === 'Actuals' ? 'Actuals' : 'Budget')
      : fiscalMode;

    if (activeTab === AppTab.ENTRY) {
      newPath = `/budget/${fySlug}`;
      if (focusedProjectId) {
        const p = projectsRef.current.find(proj => proj.id === focusedProjectId);
        if (p) newPath += `/${p.code || p.id}`;
      }
    } else if (activeTab === AppTab.PMO) {
      newPath = `/pmo/${processorSubTab}/${modeSlug}/${fySlug}`;
    } else if (activeTab === AppTab.PMO_ANALYTICS) {
      newPath = `/pmo/analytics/${modeSlug}/${fySlug}`;
    } else if (activeTab === AppTab.DASHBOARD) {
      newPath = `/analytics/${modeSlug}/${fySlug}`;
    } else if (activeTab === AppTab.HR_RESOURCES) {
      newPath = '/resources';
    } else if (activeTab === AppTab.SEAT_ALLOCATION) {
      newPath = '/seat-allocation';
    } else if (activeTab === AppTab.CONFIG) {
      newPath = `/config/${activeCategory.toLowerCase()}`;
    } else if (activeTab === AppTab.ABOUT) {
      newPath = '/about';
    } else if (activeTab === AppTab.DCBA_PORTAL) {
      newPath = `/dcba/${dcbaViewMode}`;
    } else if (activeTab === AppTab.MASTER_PROJECTS) {
      newPath = '/master-projects';
    } else if (activeTab === AppTab.HOME) {
      newPath = '/';
    }

    const currentPath = location.pathname.replace(/\/$/, '') || '/';
    const targetPath = newPath.replace(/\/$/, '') || '/';

    if (currentPath !== targetPath) {
      console.log('Navigating due to state change', { currentPath, targetPath, activeTab, selectedFYs });
      isNavigatingRef.current = true;
      navigate(newPath);
      // Reset ref after a short delay to allow location change to propagate
      setTimeout(() => { isNavigatingRef.current = false; }, 500);
    }
  }, [activeTab, selectedFYs, fiscalMode, processorMode, currentUser, dcbaViewMode, processorSubTab, navigate, focusedProjectId, activeCategory, location.pathname]);

  // Handle Back/Forward Navigation
  useEffect(() => {
    const handleLocationChange = () => {
      console.log('handleLocationChange called', { location: location.pathname });
      if (isNavigatingRef.current) return;

      const path = location.pathname;
      const segments = path.split('/').filter(Boolean);
      const primary = segments.length > 0 ? segments[0] : undefined;
      const secondary = segments[1];
      const tertiary = segments[2];

      // Update Active Tab
      if (primary === 'budget') {
        setActiveTab(prev => {
          console.log('setActiveTab triggered', { prev, target: AppTab.ENTRY });
          if (prev !== AppTab.ENTRY) {
            console.log('Switching tab to ENTRY');
            return AppTab.ENTRY;
          }
          return prev;
        });
        if (tertiary) {
          const project = projectsRef.current.find(p => p.code === tertiary || p.id === tertiary);
          if (project && project.id !== focusedProjectId) {
            setFocusedProjectId(project.id);
          }
        }
      } else if (primary === 'pmo') {
        const subTab = (secondary === 'analytics') ? 'analytics' : 'list';
        setProcessorSubTab(prev => prev !== subTab ? subTab : prev);
        
        setActiveTab(prev => {
          const targetTab = (subTab === 'analytics') ? AppTab.PMO_ANALYTICS : AppTab.PMO;
          if (prev !== targetTab) {
            console.log('Switching tab to', targetTab);
            return targetTab;
          }
          return prev;
        });
      } else if (primary === 'analytics') {
        setActiveTab(prev => {
          if (prev !== AppTab.DASHBOARD) {
            console.log('Switching tab to DASHBOARD');
            return AppTab.DASHBOARD;
          }
          return prev;
        });
      } else if (primary === 'resources') {
        setActiveTab(prev => {
          if (prev !== AppTab.HR_RESOURCES) {
            console.log('Switching tab to HR_RESOURCES');
            return AppTab.HR_RESOURCES;
          }
          return prev;
        });
      } else if (primary === 'seat-allocation') {
        setActiveTab(prev => {
          if (prev !== AppTab.SEAT_ALLOCATION) {
            console.log('Switching tab to SEAT_ALLOCATION');
            return AppTab.SEAT_ALLOCATION;
          }
          return prev;
        });
      } else if (primary === 'config') {
        setActiveTab(prev => {
          if (prev !== AppTab.CONFIG) {
            console.log('Switching tab to CONFIG');
            return AppTab.CONFIG;
          }
          return prev;
        });
        if (secondary) {
          setActiveCategory(prev => prev.toLowerCase() !== secondary.toLowerCase() ? secondary : prev);
        }
      } else if (primary === 'about') {
        setActiveTab(prev => {
          if (prev !== AppTab.ABOUT) {
            console.log('Switching tab to ABOUT');
            return AppTab.ABOUT;
          }
          return prev;
        });
      } else if (primary === 'dcba') {
        setActiveTab(prev => {
          if (prev !== AppTab.DCBA_PORTAL) {
            console.log('Switching tab to DCBA_PORTAL');
            return AppTab.DCBA_PORTAL;
          }
          return prev;
        });
        if (secondary === 'matrix') {
          setDcbaViewMode(prev => prev !== 'matrix' ? 'matrix' : prev);
        } else if (secondary === 'yoy') {
          setDcbaViewMode(prev => prev !== 'yoy' ? 'yoy' : prev);
        } else if (secondary === 'dashboard') {
          setDcbaViewMode(prev => prev !== 'dashboard' ? 'dashboard' : prev);
        } else {
          setDcbaViewMode(prev => prev !== 'list' ? 'list' : prev);
        }
      } else if (primary === 'master-projects') {
        setActiveTab(prev => {
          if (prev !== AppTab.MASTER_PROJECTS) {
            console.log('Switching tab to MASTER_PROJECTS');
            return AppTab.MASTER_PROJECTS;
          }
          return prev;
        });
      } else if (segments.length === 0) {
        setActiveTab(prev => {
          if (prev !== AppTab.HOME) {
            console.log('Switching tab to HOME');
            return AppTab.HOME;
          }
          return prev;
        });
      }

      // Update Fiscal Mode
      // User request: prevent automatic tab switching during fiscal mode update
      const modeSegment = segments.find(s => {
        const ls = s.toLowerCase();
        return ['budget', 'forecast', 'actuals', 'variance', 'pmo_budget'].includes(ls);
      });
      if (modeSegment) {
        const normalizedMode = modeSegment.toLowerCase() === 'actuals' ? 'Actuals' : 
                              (modeSegment.toLowerCase() === 'budget' ? 'Budget' : 
                              (modeSegment.toLowerCase() === 'forecast' ? 'Forecast' : 
                              (modeSegment.toLowerCase() === 'variance' ? 'Variance' : 'PMO_Budget'))) as FiscalMode;
        
        if (primary === 'pmo') {
          setProcessorMode(prev => prev !== normalizedMode ? normalizedMode : prev);
        } else {
          setFiscalMode(prev => prev !== normalizedMode ? normalizedMode : prev);
        }
      }

      // Update Fiscal Year
      const fyRawSegments = segments.filter(s => s.startsWith('fy-') || s === 'all-fy');
      console.log('handleLocationChange: fyRawSegments', fyRawSegments);
      // DO NOT automatically force override multi-year selections if they are already active
      // Only update if we are not already in a multi-select mode, or if the URL *explicitly* mandates a structural change
      if (fyRawSegments.length > 0 && selectedFYs.length <= 1) {
        const segment = fyRawSegments[0];
        let fyFromUrl: FiscalYear | null = null;
        if (segment === 'all-fy') fyFromUrl = 'All FY' as FiscalYear;
        else if (segment.startsWith('fy-')) fyFromUrl = segment.toUpperCase().replace('-', ' ') as FiscalYear;
        
        if (fyFromUrl) {
          const fyArray = [fyFromUrl];
          console.log('setSelectedFYs from URL:', fyArray, 'Current:', selectedFYs);
          setSelectedFYs(prev => {
            console.log('Prev FYs:', prev, 'New FYs:', fyArray, 'Match:', JSON.stringify(prev) === JSON.stringify(fyArray));
            if (JSON.stringify(prev) !== JSON.stringify(fyArray)) return fyArray;
            return prev;
          });
        }
      }
    };

    handleLocationChange();
  }, [location.pathname]);
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null);

  /* Browse logic removed here */
  const [locks, setLocks] = useState<Record<string, { userId: string, username: string }>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const isInitializedRef = useRef(false);
  const prevSelectedFYsRef = useRef(JSON.stringify(selectedFYs));
  const prevFiscalModeRef = useRef(fiscalMode);
  const prevProcessorSubTabRef = useRef(processorSubTab);
  const prevProcessorModeRef = useRef(processorMode);
  const isDirtyRef = useRef(false);
  const firstDirtyTimeRef = useRef(0);
  const lastUpdatedRef = useRef(getInitialState('lastUpdated', 0));
  const [lastUpdated, setLastUpdated] = useState<number>(lastUpdatedRef.current);
  
  const [fiscalLocks, setFiscalLocks] = useState<Record<string, boolean>>(() => {
    const saved = getInitialState<Partial<MasterConfigState>>('masterConfig', {});
    return saved.fiscalLocks || {};
  });
  const latestFiscalLocksRef = useRef<Record<string, boolean>>(fiscalLocks);
  useEffect(() => { latestFiscalLocksRef.current = fiscalLocks; }, [fiscalLocks]);

  const [aggregatedMonthLocks, setAggregatedMonthLocks] = useState<Record<string, boolean[]>>(() => {
    const saved = getInitialState<Partial<MasterConfigState>>('masterConfig', {});
    return saved.forecastMonthLocks || {};
  });
  const latestMonthLocksRef = useRef<Record<string, boolean[]>>(aggregatedMonthLocks);
  useEffect(() => { latestMonthLocksRef.current = aggregatedMonthLocks; }, [aggregatedMonthLocks]);


  const syncConfig = useMemo(() => {
    const saved = localStorage.getItem(SYNC_CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse sync config', e);
      }
    }
    // Use environment variables as defaults if available
    return { 
      url: (import.meta.env.VITE_SYNC_URL as string) || 'local', 
      key: (import.meta.env.VITE_SYNC_KEY as string) || 'local' 
    };
  }, []);
  
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline' | 'unconfigured' | 'pending'>('unconfigured');
  const [syncTrigger, setSyncTrigger] = useState(0);

  const performSync = useCallback(async () => { 
    console.log("performSync check:", { 
        initialized: isInitializedRef.current, 
        status: syncStatus, 
        hasUrl: !!syncConfig.url, 
        hasKey: !!syncConfig.key, 
        isDirty: isDirtyRef.current 
    });
    if ((!isInitializedRef.current && syncStatus !== 'pending') || syncStatus === 'unconfigured' || !syncConfig.url || !syncConfig.key || !isDirtyRef.current) return; 
    
    if ((activeTab === AppTab.PMO && processorSubTab === 'analytics') || activeTab === AppTab.DASHBOARD || activeTab === AppTab.PMO_ANALYTICS) {
      console.log("pm_analytics: Skipping auto-sync to prevent saving merged data back to single context.");
      return;
    }
    
    console.log("performSync started, status:", syncStatus, "isDirty:", isDirtyRef.current);
    
    setSyncStatus('syncing'); 
    try { 
      const targetModeVal = activeTab === AppTab.PMO ? processorMode : fiscalMode;
      
      // Keep history log reasonable
      const maxHistoryEntries = 100;
      const optimizedHistory = history.length > maxHistoryEntries ? history.slice(-maxHistoryEntries) : history;

      if (selectedFYs.includes('All FY') || selectedFYs.length > 1) {
        const yearsTarget = ALL_FISCAL_YEARS.filter(y => y !== 'All FY');
        const fyTagKey = targetModeVal === 'Actuals' ? 'actualsFYs' : (targetModeVal === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
        
        const batchItems: { id: string, data: any }[] = [];
        
        for (const year of yearsTarget) {
          const isolatedProjects = projects.filter(p => {
             const fystags = p[fyTagKey as keyof ProjectData] as string[] || [];
             return fystags.includes(year);
          });
          if (isolatedProjects.length > 0) {
            const documentId = getCloudYearKey(year, targetModeVal);
            // Send users and masterConfig only in the first item of the batch to save bandwidth
            // The server will handle merging these into the global state
            const isFirst = batchItems.length === 0;
            batchItems.push({
              id: documentId,
              data: { 
                projects: isolatedProjects, 
                users: isFirst ? users : undefined, 
                masterConfig: isFirst ? masterConfig : undefined, 
                lastUpdated, 
                settings: {}, 
                history: isFirst ? optimizedHistory : [] 
              }
            });
          }
        }
        
        if (batchItems.length > 0) {
          await syncService.saveBatchToServer(syncConfig, batchItems);
        }
        
        if (lastUpdated === lastUpdatedRef.current) {
          isDirtyRef.current = false;
          firstDirtyTimeRef.current = 0;
          setSyncStatus('synced');
        } else {
          setSyncStatus('pending');
        }
        return;
      }

      let payloadProjects = projects;
      let targetFY = selectedFYs[0] || DEFAULT_FY;
      
      const syncPayload = { projects: payloadProjects, users, masterConfig, lastUpdated, settings: {}, history: optimizedHistory };
      console.log("Saving data... Payload keys:", Object.keys(syncPayload), "Target FY:", targetFY, "Mode:", targetModeVal);
      const result = await syncService.saveToServer(syncConfig, syncPayload, targetFY, targetModeVal); 
      console.log("saveToServer result:", result);
      if (result.success) {
        if (syncPayload.lastUpdated === lastUpdatedRef.current) {
          isDirtyRef.current = false;
          firstDirtyTimeRef.current = 0;
          setSyncStatus('synced');
        } else {
          setSyncStatus('pending');
        }
      } else {
        console.warn("saveToServer returned success: false", result);
        setSyncStatus('error');
      }
    } catch (err: any) { 
      console.error("performSync error:", err);
      setSyncStatus('error'); 
    } 
  }, [projects, masterProjects, users, masterConfig, lastUpdated, syncConfig, syncStatus, history, selectedFYs, fiscalMode, processorMode, activeTab, processorSubTab]);

  const isAdmin = useMemo(() => { 
    const r = currentUser?.role?.toLowerCase(); 
    return r === 'super admin' || r === 'admin'; 
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !syncConfig.url || !syncConfig.key) return;
    syncService.loadResources(syncConfig)
      .then(emps => setEmployees(emps))
      .catch(err => console.error("Global Resources Hydration Error:", err));

    syncService.loadMasterProjects(syncConfig)
      .then(mprojs => {
        if (mprojs && mprojs.length > 0) {
          setMasterProjects(mprojs);
          localStorage.setItem('masterProjects', JSON.stringify(mprojs));
        }
      })
      .catch(err => console.error("Global Master Projects Hydration Error:", err));
  }, [currentUser, syncConfig]);

  // Auto-sync missing active projects into masterProjects registry so Master Projects stays complete
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const masterCodes = new Set((masterProjects || []).map(m => (m.code || '').trim().toUpperCase()));
    const missingMaster: MasterProject[] = [];

    projects.forEach(p => {
      const code = (p.code || '').trim().toUpperCase();
      if (code && !masterCodes.has(code)) {
        masterCodes.add(code);
        missingMaster.push({
          id: p.id || p.code,
          code: p.code,
          name: p.name || p.code,
          vertical: p.vertical || 'ECS-1',
          buDomain: p.buDomain || 'N/A',
          businessUnit: p.businessUnit || 'N/A',
          projectType: p.projectType || 'Customer',
          productFamily: p.productFamily || 'IVI',
          category: p.category || 'R&D PFS',
          generation: p.generation || 'Current',
          pdh: p.pdh || 'N/A',
          tbc: p.tbc || 'Yes',
          applicableFYs: (p as any).actualsFYs || (p as any).budgetFYs || (selectedFYs.includes('All FY') ? ['FY 26-27'] : selectedFYs)
        });
      }
    });

    if (missingMaster.length > 0) {
      setMasterProjects(prev => {
        const next = [...prev, ...missingMaster];
        localStorage.setItem('masterProjects', JSON.stringify(next));
        if (syncConfig.url && syncConfig.key) {
          syncService.saveMasterProjects(syncConfig, next).catch(e => console.warn("Auto-sync master error:", e));
        }
        return next;
      });
    }
  }, [projects, masterProjects, selectedFYs, syncConfig]);

  useEffect(() => {
    if (!selectedFY || !syncConfig.url || !syncConfig.key || !currentUser) return;
    
    const prevFY = getPreviousFY(selectedFY);

    if (prevFY) {
      setIsPrevYearLoading(true);
      syncService.loadFromServer(syncConfig, prevFY, fiscalMode)
        .then(data => {
          setPrevYearProjects(data?.projects || []);
          setIsPrevYearLoading(false)
        })
        .catch(() => {
          setPrevYearProjects([]);
          setIsPrevYearLoading(false);
        });
    } else {
      setPrevYearProjects(null);
    }
  }, [selectedFY, syncConfig, currentUser]);

  const refreshFiscalLocks = useCallback(async () => {
    if (!syncConfig.url || !syncConfig.key) return null;
    const years = ALL_FISCAL_YEARS.filter(y => y !== 'All FY') as FiscalYear[];
    const locks: Record<string, boolean> = {};
    const monthLocks: Record<string, boolean[]> = {};
    for (const y of years) {
      try {
        const data = await syncService.loadFromServer(syncConfig, y, fiscalMode);
        locks[y] = !!data?.masterConfig?.isFiscalLocked;
        if (data?.masterConfig?.fiscalLocks) {
          Object.assign(locks, data.masterConfig.fiscalLocks);
        }
        if (data?.masterConfig?.forecastMonthLocks?.[y]) {
          monthLocks[y] = data.masterConfig.forecastMonthLocks[y];
        }
      } catch (e) {
        locks[y] = y !== 'FY 25-26'; 
      }
    }
    setFiscalLocks(locks);
    setAggregatedMonthLocks(monthLocks);
  }, [syncConfig, fiscalMode]);

  useEffect(() => {
    if (currentUser) refreshFiscalLocks();
  }, [currentUser, refreshFiscalLocks]);

  const handleToggleFiscalLock = async (fy: FiscalYear, mode?: FiscalMode, type: 'budget' | 'pmo' = 'pmo') => {
    console.log('DEBUG: handleToggleFiscalLock called', fy, mode, type, 'isAdmin:', isAdmin, 'currentUser:', currentUser);
    if (!isAdmin) {
      console.log('DEBUG: Not admin, returning');
      return;
    }
    try {
      const lockKey = type === 'budget' ? `budget_page_${fy}` : (mode ? `pmo_page_${fy}_${mode}` : `pmo_page_${fy}_master`);
      
      // Compute the next lock state based on what is currently rendered in the UI state
      const isCurrentlyLocked = !!latestFiscalLocksRef.current[lockKey];
      const nextLockState = !isCurrentlyLocked;
      
      notify(`Protocol Change: Toggling lock for ${lockKey}...`, 'info');

      // Optimistically calculate all updates
      const updatedLocksTarget = { ...latestFiscalLocksRef.current, [lockKey]: nextLockState };
      const updatedMonthLocksTarget = { ...latestMonthLocksRef.current };

      if (type === 'pmo' && !mode && nextLockState) {
        updatedLocksTarget[`pmo_page_${fy}_Budget`] = true;
        updatedLocksTarget[`pmo_page_${fy}_Forecast`] = true;
        updatedLocksTarget[`pmo_page_${fy}_Actuals`] = true;
        updatedLocksTarget[`budget_page_${fy}`] = true;
        updatedMonthLocksTarget[fy] = new Array(12).fill(true);
      }

      if (type === 'pmo' && !mode && !nextLockState) {
        updatedLocksTarget[`pmo_page_${fy}_Budget`] = false;
        updatedLocksTarget[`pmo_page_${fy}_Forecast`] = false;
        updatedLocksTarget[`pmo_page_${fy}_Actuals`] = false;
        updatedLocksTarget[`budget_page_${fy}`] = false;
        updatedMonthLocksTarget[fy] = new Array(12).fill(false);
      }

      if (type === 'pmo' && mode === 'Forecast' && nextLockState) {
        updatedMonthLocksTarget[fy] = new Array(12).fill(true);
      }

      if (type === 'pmo' && mode === 'Forecast' && !nextLockState) {
        updatedMonthLocksTarget[fy] = new Array(12).fill(false);
      }

      // Apply optimistic update immediately to prevent race conditions on subsequent fast clicks
      latestFiscalLocksRef.current = updatedLocksTarget;
      latestMonthLocksRef.current = updatedMonthLocksTarget;
      setFiscalLocks(updatedLocksTarget);
      setAggregatedMonthLocks(updatedMonthLocksTarget);
      setMasterConfig(prev => ({ 
        ...prev, 
        fiscalLocks: updatedLocksTarget,
        forecastMonthLocks: updatedMonthLocksTarget
      }));

      const modes: FiscalMode[] = ['Budget', 'Forecast', 'Actuals'];
      const updatedLocksGlobal: Record<string, boolean> = {};
      const updatedMonthLocksGlobal: Record<string, boolean[]> = {};

      // Propagate the state change cleanly across all three modes (Budget/Forecast/Actuals) of the given fiscal year
      await Promise.all(modes.map(async (m) => {
        let data = await syncService.loadFromServer(syncConfig, fy, m);
        if (!data) {
          data = {
            projects: [],
            employees: [],
            masterConfig: { ...masterConfig, isFiscalLocked: false, fiscalLocks: {}, forecastMonthLocks: {} },
            history: [],
            lastUpdated: Date.now(),
            users: users
          };
        }
        
        // Push the most up-to-date locally computed locks to the server version
        const updatedConfig = { 
          ...data.masterConfig,
          fiscalLocks: updatedLocksTarget,
          forecastMonthLocks: updatedMonthLocksTarget
        };

        await syncService.saveToServer(syncConfig, {
          ...data,
          masterConfig: updatedConfig,
          lastUpdated: Date.now()
        }, fy, m);

        Object.assign(updatedLocksGlobal, updatedLocksTarget);
        if (updatedMonthLocksTarget[fy]) {
          updatedMonthLocksGlobal[fy] = updatedMonthLocksTarget[fy];
        }
      }));
      
      notify(`Context ${lockKey} is now ${nextLockState ? 'LOCKED' : 'UNLOCKED'}.`, 'success');
    } catch (err: any) {
      notify(`Lock state transition failed.`, 'error');
    }
  };

  const handleToggleMonthLock = async (fy: FiscalYear, monthIndex: number | 'all' | 'none') => {
    if (!isAdmin) return;
    try {
      notify(`Protocol Change: Updating month level lock...`, 'info');
      
      const currentMonthLocks = { ...latestMonthLocksRef.current };
      let fyLocks = [...(currentMonthLocks[fy] || new Array(12).fill(false))];
      
      if (monthIndex === 'all') {
        fyLocks = new Array(12).fill(true);
      } else if (monthIndex === 'none') {
        fyLocks = new Array(12).fill(false);
      } else {
        const isCurrentlyLocked = fyLocks[monthIndex];
        if (isCurrentlyLocked) {
          for (let i = monthIndex; i < 12; i++) fyLocks[i] = false;
        } else {
          for (let i = 0; i <= monthIndex; i++) fyLocks[i] = true;
        }
      }
      
      const updatedMonthLocksTarget = {
        ...currentMonthLocks,
        [fy]: fyLocks
      };

      // Apply optimistic update immediately
      latestMonthLocksRef.current = updatedMonthLocksTarget;
      setAggregatedMonthLocks(updatedMonthLocksTarget);
      setMasterConfig(prev => ({ 
        ...prev, 
        forecastMonthLocks: updatedMonthLocksTarget
      }));

      const modes: FiscalMode[] = ['Budget', 'Forecast', 'Actuals'];

      await Promise.all(modes.map(async (m) => {
        let data = await syncService.loadFromServer(syncConfig, fy, m);
        if (!data) {
          data = {
            projects: [],
            employees: [],
            masterConfig: { ...masterConfig, isFiscalLocked: false, fiscalLocks: {}, forecastMonthLocks: {} },
            history: [],
            lastUpdated: Date.now(),
            users: users
          };
        }
        
        const updatedConfig = { 
          ...data.masterConfig,
          fiscalLocks: { ...latestFiscalLocksRef.current }, // Always use latest locks
          forecastMonthLocks: updatedMonthLocksTarget
        };
        
        await syncService.saveToServer(syncConfig, {
          ...data,
          masterConfig: updatedConfig,
          lastUpdated: Date.now()
        }, fy, m);
      }));
      
      notify(`Month lock updated for ${fy}.`, 'success');
      triggerLocalUpdate();
    } catch (err: any) {
      notify(`Lock Protocol Failure: ${err.message}`, 'error');
    }
  };

  const handleSelectFY = (fys: FiscalYear | FiscalYear[]) => {
    let nextFYs = Array.isArray(fys) ? fys : [fys];
    console.log('handleSelectFY called with:', nextFYs);
    
    // Check if the selection has actually changed to avoid infinite loops or unnecessary updates
    if (JSON.stringify(selectedFYs) === JSON.stringify(nextFYs)) return;

    if (isDirtyRef.current) {
      performSync();
    }
    
    setSelectedFYs(nextFYs);
    localStorage.setItem(SELECTED_FY_KEY, JSON.stringify(nextFYs));
    
    const moduleKey = getModuleKey(activeTab, fiscalMode);
    const primaryFY = nextFYs[0] || DEFAULT_FY;
    
    setTabFYMap(prev => {
      const updated = { ...prev, [moduleKey]: primaryFY };
      localStorage.setItem(TAB_FY_MAP_KEY, JSON.stringify(updated));
      return updated;
    });

    isDirtyRef.current = false;
    notify(`Viewing Context: ${nextFYs.join(', ')}. Loading context-specific registry...`, 'info');
  };

  const canViewVertical = useCallback((v: string) => { 
    if (!currentUser) return false; 
    const r = currentUser.role?.toLowerCase(); 
    if (r === 'super admin' || r === 'admin') return true; 
    const perms = currentUser.verticalPermissions || {}; 
    const globalLevel = perms['Global'] || 'None'; 
    const verticalKey = Object.keys(perms).find(k => k.toUpperCase() === v.toUpperCase());
    const specificLevel = verticalKey ? perms[verticalKey] : 'None'; 
    return globalLevel !== 'None' || specificLevel !== 'None'; 
  }, [currentUser]);

  const dynamicOptions = useMemo(() => {
    const categories: { key: string, field: keyof ProjectData }[] = [
      { key: 'projectId', field: 'code' },
      { key: 'domain', field: 'buDomain' },
      { key: 'bu', field: 'businessUnit' },
      { key: 'customer', field: 'customer' },
      { key: 'projectType', field: 'projectType' },
      { key: 'family', field: 'productFamily' },
      { key: 'category', field: 'category' },
      { key: 'tbc', field: 'tbc' },
      { key: 'pdh', field: 'pdh' },
      { key: 'generation', field: 'generation' }
    ];

    const results: any = {};
    categories.forEach(({ key, field }) => {
      const filteredForThisDropdown = projects.filter(p => {
        if (!canViewVertical(p.vertical)) return false;
        const searchStr = sharedFilters.search.toLowerCase().trim();
        if (searchStr && !(p.code || '').toLowerCase().includes(searchStr) && !(p.name || '').toLowerCase().includes(searchStr)) return false;
        if (!sharedFilters.vertical.includes('All') && !sharedFilters.vertical.map(v => v.toUpperCase()).includes((p.vertical || "").toUpperCase())) return false;
        for (const cat of categories) {
          if (cat.key === key) continue;
          const filterVals = (sharedFilters as any)[cat.key];
          if (filterVals.includes('All')) continue;
          let pVal = (p[cat.field] || 'NA').toString().toUpperCase();
          if (cat.field === 'generation' && !p.generation) pVal = 'CURRENT';
          if (cat.field === 'tbc' && !p.tbc) pVal = 'YES';
          if (!filterVals.map((v: any) => v.toString().toUpperCase()).includes(pVal)) return false;
        }
        return true;
      });
      const uniqueValues = Array.from(new Set(filteredForThisDropdown.map(p => {
        if (field === 'generation' && !p.generation) return 'Current';
        if (field === 'tbc' && !p.tbc) return 'Yes';
        return (p[field] || 'NA').toString();
      })));
      results[key] = ['All', ...uniqueValues.sort()];
    });
    return results;
  }, [projects, sharedFilters, canViewVertical]);

  const resetActivity = useCallback(() => {
    if (currentUser) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }
  }, [currentUser]);

  useEffect(() => {
    const events: string[] = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e: string) => window.addEventListener(e, resetActivity));
    return () => events.forEach((e: string) => window.removeEventListener(e, resetActivity));
  }, [resetActivity]);

  useEffect(() => {
    const checkTimeout = () => {
      if (!currentUser) return;
      const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (typeof lastActive === 'string') {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        if (elapsed > REOPEN_TIMEOUT && lastActive !== '0') { 
          setCurrentUser(null);
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          notify("Session expired due to inactivity.", "info");
        }
      }
    };
    const interval = setInterval(checkTimeout, 30000);
    return () => clearInterval(interval);
  }, [currentUser, notify]);
  
  useEffect(() => {
    // Detect fiscal context change (Mode or FY array)
    const isModeChange = prevFiscalModeRef.current !== fiscalMode;
    const currentFYsStr = JSON.stringify(selectedFYs);
    const isFYChange = prevSelectedFYsRef.current !== currentFYsStr;
    const isSubTabChange = prevProcessorSubTabRef.current !== processorSubTab;
    const isProcModeChange = prevProcessorModeRef.current !== processorMode;
    
    if (isModeChange || isFYChange || isSubTabChange || isProcModeChange) {
      prevFiscalModeRef.current = fiscalMode;
      prevSelectedFYsRef.current = currentFYsStr;
      prevProcessorSubTabRef.current = processorSubTab;
      prevProcessorModeRef.current = processorMode;
      
      const transitionContext = async () => {
        if (isDirtyRef.current) {
          await performSync();
        }
        isInitializedRef.current = false;
        isDirtyRef.current = false;
        setProjects([]); // Clear projects to ensure isolation during re-hydration
        setSyncTrigger(t => t + 1); // trigger useEffect initialization if needed
      };
      
      transitionContext();
      return; // Skip saving old state to new context
    }

    if (isInitializedRef.current) {
      if ((activeTab === AppTab.PMO && processorSubTab === 'analytics') || activeTab === AppTab.DASHBOARD || activeTab === AppTab.PMO_ANALYTICS) {
        // Prevent saving/overwriting merged analytics data into single-context local storage buckets
        return;
      }
      const targetModeVal = activeTab === AppTab.PMO ? processorMode : fiscalMode;
      if (selectedFYs.includes('All FY') || selectedFYs.length > 1) {
        // Prevent saving aggregated views back into a single bucket, and clean up All FY placeholder
        if (selectedFYs.includes('All FY')) {
          localStorage.removeItem(getStorageKey('All FY', targetModeVal));
        }
        return;
      }

      const stateToStore = { 
        projects, 
        users, 
        masterConfig, 
        lastUpdated, 
        history,
        processorFileName,
        processorMode
      };
      try {
        localStorage.setItem(getStorageKey(selectedFY || DEFAULT_FY, targetModeVal), LZString.compressToUTF16(JSON.stringify(stateToStore)));
      } catch (e) {
        if (e instanceof Error && e.name === 'QuotaExceededError') {
          console.warn('LocalStorage quota exceeded, attempting to save without history...');
          try {
            const minimalState = { ...stateToStore, history: [] };
            localStorage.setItem(getStorageKey(selectedFY || DEFAULT_FY, targetModeVal), LZString.compressToUTF16(JSON.stringify(minimalState)));
          } catch (innerError) {
            console.error('Critical failure: even minimal state exceeds quota. Relying on cloud sync.', innerError);
            // If even minimal state fails, we don't save to localStorage to avoid corrupting it
            // The app will load from the server on next refresh
          }
        } else {
          console.error('Failed to save state to localStorage:', e);
        }
      }
    }
  }, [projects, users, masterConfig, lastUpdated, history, processorFileName, processorMode, selectedFY, fiscalMode, activeTab]);

  const logAction = useCallback((action: string, details: string, type: AuditLogEntry['type'] = 'update') => {
    const entry: AuditLogEntry = {
      id: generateUUID(),
      timestamp: Date.now(),
      userId: currentUser?.id || 'sys',
      username: currentUser?.username || 'System',
      action,
      details,
      type
    };
    setHistory(prev => [entry, ...prev].slice(0, 1000));
    triggerLocalUpdate();
  }, [currentUser]);

  const canAddProject = useMemo(() => {
    if (!currentUser) return false;
    const r = currentUser.role?.toLowerCase();
    if (r === 'super admin' || r === 'admin') return true;
    const perms = currentUser.verticalPermissions || {};
    return Object.values(perms).some(level => level === 'Editor');
  }, [currentUser]);
  
  const canEditVertical = useCallback((v: string, ignoreLock: boolean = false) => { 
    if (!currentUser) return false; 
    const r = currentUser.role?.toLowerCase(); 
    const isAdminUser = r === 'super admin' || r === 'admin';
    
    if (!ignoreLock) {
      // Global System Lock
      if (masterConfig.isFiscalLocked) return false;

      // Extract actual concrete years from selectedFYs
      const yearsToCheck = selectedFYs.includes('All FY')
        ? (ALL_FISCAL_YEARS.filter(y => y !== 'All FY') as FiscalYear[])
        : selectedFYs;

      // Page & Mode Specific Locks
      if (activeTab === AppTab.ENTRY) {
        // Budget Page Lock spanning any selected years
        if (yearsToCheck.some(fy => !!fiscalLocks[`budget_page_${fy}`])) return false;
      } else if (activeTab === AppTab.PMO || activeTab === AppTab.DASHBOARD || activeTab === AppTab.PMO_ANALYTICS) {
        // PMO Page Locks
        if (yearsToCheck.some(fy => !!fiscalLocks[`pmo_page_${fy}_master`])) return false;
        if (fiscalMode === 'Actuals' && ALL_FISCAL_YEARS.filter(y => y !== 'All FY').some(fy => !!fiscalLocks[`pmo_page_${fy}_master`])) return false;
        if (yearsToCheck.some(fy => !!fiscalLocks[`pmo_page_${fy}_${fiscalMode}`])) return false;
      }
    }

    if (isAdminUser) return true;
    const perms = currentUser.verticalPermissions || {}; 
    const globalLevel = perms['Global'] || 'None'; 
    const verticalKey = Object.keys(perms).find(k => k.toUpperCase() === v.toUpperCase());
    const specificLevel = verticalKey ? perms[verticalKey] : 'None'; 
    return globalLevel === 'Editor' || specificLevel === 'Editor'; 
  }, [currentUser, masterConfig.isFiscalLocked, fiscalLocks, activeTab, selectedFYs, fiscalMode]);

  const triggerLocalUpdate = () => { 
    const now = Date.now(); 
    setLastUpdated(now); 
    lastUpdatedRef.current = now; 
    if (!isDirtyRef.current) firstDirtyTimeRef.current = now;
    isDirtyRef.current = true; 
    setSyncStatus('pending'); 
    setSyncTrigger(t => t + 1);
  };

  const hydrateFromCloud = useCallback(async (): Promise<any> => { 
    console.log("hydrateFromCloud called", { hasUrl: !!syncConfig.url, hasKey: !!syncConfig.key });
    if (!syncConfig.url || !syncConfig.key) {
      console.log("No cloud config found, falling back to local storage.");
      const result = loadStateFromLocalStorage(selectedFYs.length > 0 ? selectedFYs : DEFAULT_FY as FiscalYear);
      isInitializedRef.current = true;
      setSyncStatus('unconfigured');
      return result;
    }
    const targetModeVal = activeTab === AppTab.PMO ? processorMode : fiscalMode;
    const isAnalytics = (activeTab === AppTab.PMO && processorSubTab === 'analytics') || activeTab === AppTab.DASHBOARD || activeTab === AppTab.PMO_ANALYTICS;
    console.log(`Hydrating from cloud for FY: ${selectedFYs.join(', ')} (isAnalytics: ${isAnalytics}, targetModeVal: ${targetModeVal})`);
    setSyncStatus('syncing'); 
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try { 
        let cloudData: any = null;
        let loadedBud: any = null;
        let loadedAct: any = null;
        let loadedFct: any = null;
        if (isAnalytics) {
          const queryY = selectedFYs.length > 0 ? selectedFYs : DEFAULT_FY;
          const [bud, act, fct] = await Promise.all([
            syncService.loadFromServer(syncConfig, queryY, 'Budget').catch(() => null),
            syncService.loadFromServer(syncConfig, queryY, 'Actuals').catch(() => null),
            syncService.loadFromServer(syncConfig, queryY, 'Forecast').catch(() => null),
          ]);
          loadedBud = bud;
          loadedAct = act;
          loadedFct = fct;

          if (bud || act || fct) {
            // ... rest of the merge logic is fine ...
            cloudData = { ...(bud || act || fct) };
            const actualsList = act?.projects || [];
            const forecastList = fct?.projects || [];
            const budgetList = bud?.projects || [];

            const isGenericCode = (c: string | undefined | null) => {
              if (!c) return true;
              const upper = String(c).toUpperCase().trim();
              return upper === 'UMD-XXXX' || upper === 'XXXX' || upper === 'TBD' || upper === 'UMD-TBD' || upper === 'N/A' || upper === 'NA' || upper === 'TEMP';
            };

            const mergedProjectsMap: Record<string, any> = {};
            const codeToKeyMap: Record<string, string> = {};
            const nameToKeyMap: Record<string, string> = {};

            const registerProject = (p: any, mode: 'Budget' | 'Actuals' | 'Forecast') => {
              if (!p) return;
              let matchedKey: string | null = null;
              const pId = p.id ? String(p.id).trim() : null;
              const pCode = (p.code && !isGenericCode(p.code)) ? String(p.code).toUpperCase().trim() : null;
              const pName = p.name ? String(p.name).trim().toLowerCase() : null;

              if (pId && mergedProjectsMap[pId]) {
                matchedKey = pId;
              } else if (pCode && codeToKeyMap[pCode] && mergedProjectsMap[codeToKeyMap[pCode]]) {
                matchedKey = codeToKeyMap[pCode];
              } else if (pName && nameToKeyMap[pName] && mergedProjectsMap[nameToKeyMap[pName]]) {
                matchedKey = nameToKeyMap[pName];
              }

              if (!matchedKey) {
                matchedKey = pId || (pCode ? `code_${pCode}` : `proj_${pName || ''}_${Math.random().toString(36).substr(2, 9)}`);
                mergedProjectsMap[matchedKey] = {
                  ...p,
                  pmoRows: mode === 'Budget' ? { ...(p.pmoRows || {}) } : {},
                  rows: mode === 'Budget' ? { ...(p.rows || {}) } : {},
                  skills: mode === 'Budget' ? { ...(p.skills || {}) } : {},
                  expenses: mode === 'Budget' ? { ...(p.expenses || {}) } : {},
                  employeeSkills: mode === 'Budget' ? { ...(p.employeeSkills || {}) } : {},
                  actuals: mode === 'Actuals' ? { ...(p.actuals || {}) } : {},
                  actualsEmployeeSkills: mode === 'Actuals' ? { ...(p.actualsEmployeeSkills || {}) } : {},
                  actualsExpenseDetails: mode === 'Actuals' && p.actualsExpenseDetails ? { ...p.actualsExpenseDetails } : {},
                  forecast: mode === 'Forecast' ? { ...(p.forecast || {}) } : {},
                  forecastEmployeeSkills: mode === 'Forecast' ? { ...(p.forecastEmployeeSkills || {}) } : {},
                  forecastExpenseDetails: mode === 'Forecast' && p.forecastExpenseDetails ? { ...p.forecastExpenseDetails } : {},
                };
                if (pId) codeToKeyMap[pId] = matchedKey;
                if (pCode) codeToKeyMap[pCode] = matchedKey;
                if (pName) nameToKeyMap[pName] = matchedKey;
              } else {
                const existing = mergedProjectsMap[matchedKey];
                if (mode === 'Budget') {
                  if (p.pmoRows && Object.keys(p.pmoRows).length > 0) existing.pmoRows = { ...existing.pmoRows, ...p.pmoRows };
                  if (p.rows && Object.keys(p.rows).length > 0) existing.rows = { ...existing.rows, ...p.rows };
                  if (p.skills && Object.keys(p.skills).length > 0) existing.skills = { ...existing.skills, ...p.skills };
                  if (p.expenses && Object.keys(p.expenses).length > 0) existing.expenses = { ...existing.expenses, ...p.expenses };
                  if (p.employeeSkills && Object.keys(p.employeeSkills).length > 0) existing.employeeSkills = { ...existing.employeeSkills, ...p.employeeSkills };
                  if (p.budgetFYs) existing.budgetFYs = Array.from(new Set([...(existing.budgetFYs || []), ...(p.budgetFYs || [])]));
                } else if (mode === 'Actuals') {
                  existing.actuals = { ...existing.actuals, ...(p.actuals || {}) };
                  existing.actualsEmployeeSkills = { ...existing.actualsEmployeeSkills, ...(p.actualsEmployeeSkills || {}) };
                  if (p.actualsExpenseDetails) existing.actualsExpenseDetails = { ...(existing.actualsExpenseDetails || {}), ...p.actualsExpenseDetails };
                  if (p.actualsFYs) existing.actualsFYs = Array.from(new Set([...(existing.actualsFYs || []), ...(p.actualsFYs || [])]));
                } else if (mode === 'Forecast') {
                  existing.forecast = { ...existing.forecast, ...(p.forecast || {}) };
                  existing.forecastEmployeeSkills = { ...existing.forecastEmployeeSkills, ...(p.forecastEmployeeSkills || {}) };
                  if (p.forecastExpenseDetails) existing.forecastExpenseDetails = { ...(existing.forecastExpenseDetails || {}), ...p.forecastExpenseDetails };
                  if (p.forecastFYs) existing.forecastFYs = Array.from(new Set([...(existing.forecastFYs || []), ...(p.forecastFYs || [])]));
                }
              }
            };

            budgetList.forEach((p: any) => registerProject(p, 'Budget'));
            actualsList.forEach((p: any) => registerProject(p, 'Actuals'));
            forecastList.forEach((p: any) => registerProject(p, 'Forecast'));

            cloudData.projects = Object.values(mergedProjectsMap);
          }
        } else {
          cloudData = await syncService.loadFromServer(syncConfig, selectedFYs.length > 0 ? selectedFYs : DEFAULT_FY, targetModeVal);
        }

        if (cloudData) { 
          const mappedProjects = (cloudData.projects || []).map((p: any) => ({
            ...p,
            businessUnit: (p.businessUnit === 'ADAS' || p.businessUnit === 'Sensor') ? 'ADAS & Sensor' : p.businessUnit,
            segment: p.segment === 'CV' ? 'CV_OR' : p.segment
          }));
          setProjects(mappedProjects); 
          if (cloudData.users) setUsers(cloudData.users); 
          setMasterConfig(prev => {
            const merged = { ...prev, ...(cloudData.masterConfig || {}) };
            
            // Apply mandatory mappings
            if (merged.businessUnits) {
              const bus = merged.businessUnits;
              if (bus.includes('ADAS') || bus.includes('Sensor')) {
                const newBus = bus.filter((b: string) => b !== 'ADAS' && b !== 'Sensor');
                if (!newBus.includes('ADAS & Sensor')) newBus.push('ADAS & Sensor');
                merged.businessUnits = newBus;
              }
            }
            if (merged.segments) {
              const segs = merged.segments;
              const cvIdx = segs.indexOf('CV');
              if (cvIdx !== -1) {
                segs[cvIdx] = 'CV_OR';
                merged.segments = segs;
              }
            }

            const requiredBands = ['B13', 'B14', 'B15', 'B16', 'B17', 'I1'];
            let bands = [...(merged.bands || [])];
            let changed = false;
            requiredBands.forEach(b => { if (!bands.includes(b)) { bands.push(b); changed = true; } });
            return changed ? { ...merged, bands } : merged;
          }); 
          setHistory(cloudData.history || []);
          if (cloudData.processorFileName) setProcessorFileName(cloudData.processorFileName);
          lastUpdatedRef.current = cloudData.lastUpdated; 
          setLastUpdated(cloudData.lastUpdated); 
          try {
            const currentFY = selectedFYs.length > 0 ? (Array.isArray(selectedFYs) ? selectedFYs[0] : selectedFYs) : DEFAULT_FY;
            if (loadedAct) localStorage.setItem(getStorageKey(currentFY, 'Actuals'), LZString.compressToUTF16(JSON.stringify(loadedAct)));
            if (loadedBud) localStorage.setItem(getStorageKey(currentFY, 'Budget'), LZString.compressToUTF16(JSON.stringify(loadedBud)));
            if (loadedFct) localStorage.setItem(getStorageKey(currentFY, 'Forecast'), LZString.compressToUTF16(JSON.stringify(loadedFct)));
          } catch (e) {}
          console.log("Setting isInitialized to true in hydrateFromCloud");
          isInitializedRef.current = true; 
          setSyncStatus('synced'); 
          return cloudData; 
        } else { 
          console.log("No cloud data found, falling back to local storage.");
          loadStateFromLocalStorage(selectedFYs.length > 0 ? selectedFYs : [DEFAULT_FY as FiscalYear]);
          console.log("Setting isInitialized to true in hydrateFromCloud fallback");
          isInitializedRef.current = true;
          setSyncStatus('synced'); 
          return null; 
        } 
      } catch (err: any) { 
        retries++;
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return null;
        
        console.warn(`Hydration attempt ${retries} failed:`, err.message || err);
        
        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 500; // Exponential backoff: 1s, 2s, 4s...
          console.log(`Retrying hydration in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error('All hydration retries failed, falling back to local storage:', err);
        loadStateFromLocalStorage(selectedFYs.length > 0 ? selectedFYs : [DEFAULT_FY as FiscalYear]);
        console.log("Setting isInitialized to true in hydrateFromCloud catch");
        isInitializedRef.current = true;
        setSyncStatus('error'); 
        return null; 
      }
    }
    return null;
  }, [syncConfig, selectedFYs, fiscalMode, processorMode, processorSubTab, activeTab]);

  const loadStateFromLocalStorage = useCallback((fys: FiscalYear | FiscalYear[]) => {
    const fyArray = Array.isArray(fys) ? fys : [fys];
    const isAllFY = fyArray.includes('All FY');
    const isAnalytics = (activeTab === AppTab.PMO && processorSubTab === 'analytics') || activeTab === AppTab.DASHBOARD || activeTab === AppTab.PMO_ANALYTICS;
    const modesToLoad: string[] = isAnalytics ? ['Budget', 'Actuals', 'Forecast'] : [activeTab === AppTab.PMO ? processorMode : fiscalMode];

    if (isAllFY || fyArray.length > 1) {
      const years = isAllFY ? [
        'FY 19-20', 'FY 20-21', 'FY 21-22', 'FY 22-23', 'FY 23-24', 'FY 24-25', 'FY 25-26', 
        'FY 26-27', 'FY 27-28', 'FY 28-29', 'FY 29-30', 'FY 30-31'
      ] : fyArray;
      
      const validResults: any[] = [];
      years.forEach(y => {
        modesToLoad.forEach(mVal => {
          const key = getStorageKey(y, mVal as any);
          const saved = localStorage.getItem(key);
          if (saved) {
            try {
              let parsedString = saved;
              if (!saved.startsWith('{') && !saved.startsWith('[')) {
                try {
                  parsedString = LZString.decompressFromUTF16(saved) || saved;
                } catch (e) {}
              }
              validResults.push({ ...JSON.parse(parsedString), sourceMode: mVal });
            } catch (e) {}
          }
        });
      });

      if (validResults.length > 0) {
        const mergedProjectsMap: Record<string, any> = {};
        let latestMasterConfig = validResults[0].masterConfig;
        let latestUsers = validResults[0].users;
        let maxLastUpdated = 0;

        const mergeData = (target: any, source: any) => {
          if (!source) return target;
          const result = { ...(target || {}) };
          Object.entries(source).forEach(([cat, data]: [string, any]) => {
            if (!result[cat]) result[cat] = new Array(144).fill(0);
            if (Array.isArray(data)) {
              data.forEach((val, i) => {
                if (val && i < 144) result[cat][i] = val;
              });
            } else if (data && typeof data === 'object') {
              Object.entries(data).forEach(([k, v]) => {
                const idx = parseInt(k);
                if (!isNaN(idx) && idx >= 0 && idx < 144 && v) {
                  result[cat][idx] = v;
                }
              });
            }
          });
          return result;
        };

        const mergeEmployeeSkills = (targetMap: any, sMap: any) => {
          if (!sMap) return targetMap || {};
          const result = { ...(targetMap || {}) };
          Object.entries(sMap).forEach(([skill, emailMap]: [string, any]) => {
            if (!result[skill]) result[skill] = {};
            if (emailMap && typeof emailMap === 'object') {
              Object.entries(emailMap).forEach(([email, allocations]: [string, any]) => {
                if (!result[skill][email]) result[skill][email] = new Array(144).fill(0);
                if (Array.isArray(allocations)) {
                  allocations.forEach((val, i) => {
                    if (val !== undefined && i < 144) result[skill][email][i] = val;
                  });
                } else if (allocations && typeof allocations === 'object') {
                  Object.entries(allocations).forEach(([k, v]) => {
                    const idx = parseInt(k);
                    if (!isNaN(idx) && idx >= 0 && idx < 144) {
                      result[skill][email][idx] = v as number;
                    }
                  });
                }
              });
            }
          });
          return result;
        };

        const isGenericCode = (c: string | undefined | null) => {
          if (!c) return true;
          const upper = String(c).toUpperCase().trim();
          return upper === 'UMD-XXXX' || upper === 'XXXX' || upper === 'TBD' || upper === 'UMD-TBD' || upper === 'N/A' || upper === 'NA' || upper === 'TEMP';
        };

        const codeToKeyMap: Record<string, string> = {};
        const nameToKeyMap: Record<string, string> = {};

        validResults.forEach(data => {
          if (data.lastUpdated > maxLastUpdated) {
            maxLastUpdated = data.lastUpdated;
            if (data.masterConfig) latestMasterConfig = data.masterConfig;
            if (data.users) latestUsers = data.users;
          }

          (data.projects || []).forEach((p: any) => {
            if (!p) return;
            const currentMode = data.sourceMode || 'Budget';
            let matchedKey: string | null = null;
            const pId = p.id ? String(p.id).trim() : null;
            const pCode = (p.code && !isGenericCode(p.code)) ? String(p.code).toUpperCase().trim() : null;
            const pName = p.name ? String(p.name).trim().toLowerCase() : null;

            if (pId && mergedProjectsMap[pId]) {
              matchedKey = pId;
            } else if (pCode && codeToKeyMap[pCode] && mergedProjectsMap[codeToKeyMap[pCode]]) {
              matchedKey = codeToKeyMap[pCode];
            } else if (pName && nameToKeyMap[pName] && mergedProjectsMap[nameToKeyMap[pName]]) {
              matchedKey = nameToKeyMap[pName];
            }

            if (!matchedKey) {
              matchedKey = pId || (pCode ? `code_${pCode}` : `proj_${pName || ''}_${Math.random().toString(36).substr(2, 9)}`);
              mergedProjectsMap[matchedKey] = { 
                ...p,
                pmoRows: currentMode === 'Budget' ? { ...(p.pmoRows || {}) } : {},
                rows: currentMode === 'Budget' ? { ...(p.rows || {}) } : {},
                skills: currentMode === 'Budget' ? { ...(p.skills || {}) } : {},
                expenses: currentMode === 'Budget' ? { ...(p.expenses || {}) } : {},
                employeeSkills: currentMode === 'Budget' ? { ...(p.employeeSkills || {}) } : {},
                actuals: currentMode === 'Actuals' ? { ...(p.actuals || {}) } : {},
                actualsEmployeeSkills: currentMode === 'Actuals' ? { ...(p.actualsEmployeeSkills || {}) } : {},
                forecast: currentMode === 'Forecast' ? { ...(p.forecast || {}) } : {},
                forecastEmployeeSkills: currentMode === 'Forecast' ? { ...(p.forecastEmployeeSkills || {}) } : {},
              };
              if (pId) codeToKeyMap[pId] = matchedKey;
              if (pCode) codeToKeyMap[pCode] = matchedKey;
              if (pName) nameToKeyMap[pName] = matchedKey;
            } else {
              const existing = mergedProjectsMap[matchedKey];
              existing.budgetFYs = Array.from(new Set([...(existing.budgetFYs || []), ...(p.budgetFYs || [])]));
              existing.actualsFYs = Array.from(new Set([...(existing.actualsFYs || []), ...(p.actualsFYs || [])]));
              existing.forecastFYs = Array.from(new Set([...(existing.forecastFYs || []), ...(p.forecastFYs || [])]));
              
              if (currentMode === 'Budget') {
                existing.pmoRows = mergeData(existing.pmoRows, p.pmoRows);
                existing.rows = mergeData(existing.rows, p.rows);
                existing.skills = mergeData(existing.skills, p.skills);
                existing.expenses = mergeData(existing.expenses, p.expenses);
                existing.employeeSkills = mergeEmployeeSkills(existing.employeeSkills, p.employeeSkills);
              } else if (currentMode === 'Actuals') {
                existing.actuals = mergeData(existing.actuals, p.actuals);
                existing.actualsEmployeeSkills = mergeEmployeeSkills(existing.actualsEmployeeSkills, p.actualsEmployeeSkills);
              } else if (currentMode === 'Forecast') {
                existing.forecast = mergeData(existing.forecast, p.forecast);
                existing.forecastEmployeeSkills = mergeEmployeeSkills(existing.forecastEmployeeSkills, p.forecastEmployeeSkills);
              }
            }
          });
        });

        const mappedProjects = Object.values(mergedProjectsMap).map((p: any) => ({
          ...p,
          businessUnit: (p.businessUnit === 'ADAS' || p.businessUnit === 'Sensor') ? 'ADAS & Sensor' : p.businessUnit,
          segment: p.segment === 'CV' ? 'CV_OR' : p.segment
        }));
        
        setProjects(mappedProjects);
        if (latestUsers) setUsers(latestUsers);
        if (latestMasterConfig) setMasterConfig(prev => ({ ...prev, ...latestMasterConfig }));
        return;
      }
    }

    const singleFY = Array.isArray(fys) ? fys[0] : fys;
    const isGenericCode = (c: string | undefined | null) => {
      if (!c) return true;
      const upper = String(c).toUpperCase().trim();
      return upper === 'UMD-XXXX' || upper === 'XXXX' || upper === 'TBD' || upper === 'UMD-TBD' || upper === 'N/A' || upper === 'NA' || upper === 'TEMP';
    };
    const mergedProjectsMap: Record<string, any> = {};
    const codeToKeyMap: Record<string, string> = {};
    const nameToKeyMap: Record<string, string> = {};
    let latestMasterConfig = null;
    let latestUsers = null;
    let parsedHistory = null;
    let parsedLastUpdated = 0;
    let parsedProcessorFileName = null;
    let hasAnySaved = false;

    modesToLoad.forEach(mVal => {
      const key = getStorageKey(singleFY, mVal as any);
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          let parsedString = saved;
          if (!saved.startsWith('{') && !saved.startsWith('[')) {
            try {
              parsedString = LZString.decompressFromUTF16(saved) || saved;
            } catch (e) {}
          }
          const parsed = JSON.parse(parsedString);
          hasAnySaved = true;

          if (parsed.masterConfig) latestMasterConfig = parsed.masterConfig;
          if (parsed.users) latestUsers = parsed.users;
          if (parsed.history) parsedHistory = parsed.history;
          if (parsed.lastUpdated) parsedLastUpdated = Math.max(parsedLastUpdated, parsed.lastUpdated);
          if (parsed.processorFileName) parsedProcessorFileName = parsed.processorFileName;

          (parsed.projects || []).forEach((p: any) => {
            if (!p) return;
            let matchedKey: string | null = null;
            const pId = p.id ? String(p.id).trim() : null;
            const pCode = (p.code && !isGenericCode(p.code)) ? String(p.code).toUpperCase().trim() : null;
            const pName = p.name ? String(p.name).trim().toLowerCase() : null;

            if (pId && mergedProjectsMap[pId]) {
              matchedKey = pId;
            } else if (pCode && codeToKeyMap[pCode] && mergedProjectsMap[codeToKeyMap[pCode]]) {
              matchedKey = codeToKeyMap[pCode];
            } else if (pName && nameToKeyMap[pName] && mergedProjectsMap[nameToKeyMap[pName]]) {
              matchedKey = nameToKeyMap[pName];
            }

            if (!matchedKey) {
              matchedKey = pId || (pCode ? `code_${pCode}` : `proj_${pName || ''}_${Math.random().toString(36).substr(2, 9)}`);
              mergedProjectsMap[matchedKey] = { 
                ...p,
                pmoRows: mVal === 'Budget' ? { ...(p.pmoRows || {}) } : {},
                rows: mVal === 'Budget' ? { ...(p.rows || {}) } : {},
                skills: mVal === 'Budget' ? { ...(p.skills || {}) } : {},
                expenses: mVal === 'Budget' ? { ...(p.expenses || {}) } : {},
                employeeSkills: mVal === 'Budget' ? { ...(p.employeeSkills || {}) } : {},
                actuals: mVal === 'Actuals' ? { ...(p.actuals || {}) } : {},
                actualsEmployeeSkills: mVal === 'Actuals' ? { ...(p.actualsEmployeeSkills || {}) } : {},
                forecast: mVal === 'Forecast' ? { ...(p.forecast || {}) } : {},
                forecastEmployeeSkills: mVal === 'Forecast' ? { ...(p.forecastEmployeeSkills || {}) } : {},
              };
              if (pId) codeToKeyMap[pId] = matchedKey;
              if (pCode) codeToKeyMap[pCode] = matchedKey;
              if (pName) nameToKeyMap[pName] = matchedKey;
            } else {
              const existing = mergedProjectsMap[matchedKey];
              if (mVal === 'Budget') {
                if (p.pmoRows && Object.keys(p.pmoRows).length > 0) existing.pmoRows = p.pmoRows;
                if (p.rows && Object.keys(p.rows).length > 0) existing.rows = p.rows;
                if (p.skills && Object.keys(p.skills).length > 0) existing.skills = p.skills;
                if (p.expenses && Object.keys(p.expenses).length > 0) existing.expenses = p.expenses;
                if (p.employeeSkills && Object.keys(p.employeeSkills).length > 0) existing.employeeSkills = p.employeeSkills;
              } else if (mVal === 'Actuals') {
                if (p.actuals && Object.keys(p.actuals).length > 0) existing.actuals = p.actuals;
                if (p.actualsEmployeeSkills && Object.keys(p.actualsEmployeeSkills).length > 0) existing.actualsEmployeeSkills = p.actualsEmployeeSkills;
              } else if (mVal === 'Forecast') {
                if (p.forecast && Object.keys(p.forecast).length > 0) existing.forecast = p.forecast;
                if (p.forecastEmployeeSkills && Object.keys(p.forecastEmployeeSkills).length > 0) existing.forecastEmployeeSkills = p.forecastEmployeeSkills;
              }
            }
          });
        } catch (e) {}
      }
    });

    if (hasAnySaved) {
      const mappedProjects = Object.values(mergedProjectsMap).map((p: any) => ({
        ...p,
        businessUnit: (p.businessUnit === 'ADAS' || p.businessUnit === 'Sensor') ? 'ADAS & Sensor' : p.businessUnit,
        segment: p.segment === 'CV' ? 'CV_OR' : p.segment
      }));
      setProjects(mappedProjects);
      if (latestUsers) setUsers(latestUsers);
      setMasterConfig(prev => {
        const merged = { ...prev, ...(latestMasterConfig || {}) };

        // Apply mandatory mappings
        if (merged.businessUnits) {
          const bus = merged.businessUnits;
          if (bus.includes('ADAS') || bus.includes('Sensor')) {
            const newBus = bus.filter((b: string) => b !== 'ADAS' && b !== 'Sensor');
            if (!newBus.includes('ADAS & Sensor')) newBus.push('ADAS & Sensor');
            merged.businessUnits = newBus;
          }
        }
        if (merged.segments) {
          const segs = merged.segments;
          const cvIdx = segs.indexOf('CV');
          if (cvIdx !== -1) {
            segs[cvIdx] = 'CV_OR';
            merged.segments = segs;
          }
        }

        const requiredBands = ['B13', 'B14', 'B15', 'B16', 'B17', 'I1'];
        let bands = [...(merged.bands || [])];
        let changed = false;
        requiredBands.forEach(b => { if (!bands.includes(b)) { bands.push(b); changed = true; } });
        return changed ? { ...merged, bands } : merged;
      });
      if (parsedHistory) setHistory(parsedHistory);
      setLastUpdated(parsedLastUpdated);
      if (parsedProcessorFileName) setProcessorFileName(parsedProcessorFileName);
    } else {
      setProjects([]);
      setHistory([]);
      setLastUpdated(0);
    }
    isInitializedRef.current = true;
    isDirtyRef.current = false;
    setSyncStatus('synced');
  }, [fiscalMode, processorMode, processorSubTab, activeTab]);

  // Unified Initialization Logic
  useEffect(() => {
    console.log("Initialization useEffect running", { initialized: isInitializedRef.current, hasUrl: !!syncConfig.url, hasKey: !!syncConfig.key });
    // Don't return early; if it's not initialized, we need to initialize.
    // If it is initialized, hydrateFromCloud might still be needed if syncConfig changed,
    // but the Guard !isInitializedRef.current should be handled by the effect dependencies.
    // Actually, let's just force-set it to true to avoid multiple runs if hydrate is async.
    
    if (syncConfig.url && syncConfig.key) {
        console.log("Calling hydrateFromCloud from useEffect");
        if (!isInitializedRef.current) {
            isInitializedRef.current = true;
            hydrateFromCloud().catch(err => {
                console.error("Hydration failed, resetting", err);
                isInitializedRef.current = false;
            });
        }
    } else {
      console.log("Calling loadStateFromLocalStorage from useEffect");
      isInitializedRef.current = true;
      loadStateFromLocalStorage(selectedFYs.length > 0 ? selectedFYs : [DEFAULT_FY as FiscalYear]);
    }
  }, [selectedFYs, fiscalMode, processorSubTab, processorMode, activeTab, syncConfig, currentUser, hydrateFromCloud, loadStateFromLocalStorage, syncTrigger]);

  const handleRestore = async (snapshotId?: string) => { 
    try { 
      if (snapshotId === 'FORCE_PUSH') { 
        setSyncStatus('syncing'); 
        
        let payloadProjects = projects;
        let targetFY = selectedFYs.length > 0 ? selectedFYs[0] : DEFAULT_FY;
        const targetModeVal = activeTab === AppTab.PMO ? processorMode : fiscalMode;
        if (selectedFYs.includes('All FY') || selectedFYs.length > 1) {
          targetFY = DEFAULT_FY;
          const existingData = await syncService.loadFromServer(syncConfig, targetFY, targetModeVal);
          if (existingData && existingData.projects) {
            payloadProjects = existingData.projects; 
          } else {
            setSyncStatus('error');
            notify("Manual Push Failed. Could not isolate projects.", "error"); 
            return;
          }
        }

        await syncService.saveToServer(syncConfig, { 
          projects: payloadProjects, 
          masterProjects, 
          users, 
          employees,
          masterConfig, 
          lastUpdated: Date.now(), 
          settings: {}, 
          history,
          processorFileName,
          processorMode
        }, targetFY, targetModeVal); 
        setSyncStatus('synced'); 
        isDirtyRef.current = false; 
        logAction("Cloud Push", "Forced master push to cloud", "system");
        notify("Manual Push Success.", "success"); 
        return; 
      } 
      const data = await hydrateFromCloud(); 
      if (data) {
        logAction("Cloud Pull", "Registry synchronized from cloud", "system");
        notify("Cloud Sync Success.", "success"); 
      }
    } catch (err: any) { 
      setSyncStatus('error'); 
      notify(`Sync Protocol Failure.`, "error"); 
    } 
  };

  const handleCloudUpdate = useCallback((cloudData: any) => { 
    if (!cloudData || cloudData.lastUpdated <= lastUpdatedRef.current) return; 
    if (isDirtyRef.current) { notify("Cloud Conflict Detected.", "conflict"); return; } 
    setProjects(cloudData.projects || []); 
    if (cloudData.masterProjects) setMasterProjects(cloudData.masterProjects);
    setUsers(cloudData.users || INITIAL_USERS); 
    setMasterConfig(prev => {
      const merged = { ...prev, ...(cloudData.masterConfig || {}) };
      const requiredBands = ['B13', 'B14', 'B15', 'B16', 'B17', 'I1'];
      let bands = [...(merged.bands || [])];
      let changed = false;
      requiredBands.forEach(b => { if (!bands.includes(b)) { bands.push(b); changed = true; } });
      return changed ? { ...merged, bands } : merged;
    }); 
    setHistory(cloudData.history || []);
    if (cloudData.processorFileName) setProcessorFileName(cloudData.processorFileName);
    setLastUpdated(cloudData.lastUpdated); 
    lastUpdatedRef.current = cloudData.lastUpdated; 
    setSyncStatus('synced'); 
    isInitializedRef.current = true; 
  }, [notify]);
  
  useEffect(() => { 
    if (!currentUser || !syncConfig.url || !syncConfig.key || !selectedFY) return; 
    const channel = syncService.setupPresence(syncConfig, currentUser, (presenceState: any) => { 
      const newLocks: Record<string, { userId: string, username: string }> = {}; 
      const userIds = Object.keys(presenceState || {}) as string[];
      setOnlineUserIds(userIds); 
      userIds.forEach((userId: string) => { 
        if (currentUser && userId === currentUser.id) return; 
        const presenceList = (presenceState as Record<string, any[]>)[userId];
        if (presenceList && presenceList.length > 0) {
          const presence = presenceList[0] as any; 
          if (presence && presence.focusedProjectId) {
            newLocks[String(presence.focusedProjectId)] = { 
              userId: String(userId), 
              username: String(presence.username || 'Unknown') 
            }; 
          }
        }
      }); 
      setLocks(newLocks); 
    }); 
    if (channel) channel.track({ username: currentUser.username, focusedProjectId: focusedProjectId }); 
    return () => { channel?.unsubscribe(); }; 
  }, [currentUser, focusedProjectId, syncConfig, selectedFY]);

  useEffect(() => { 
    if (!syncConfig.url || !syncConfig.key || !selectedFY) return; 
    const channel = syncService.subscribeToChanges(syncConfig, selectedFY || DEFAULT_FY, fiscalMode, handleCloudUpdate); 
    return () => { channel?.unsubscribe(); }; 
  }, [syncConfig, selectedFY, handleCloudUpdate, fiscalMode]);
  
  useEffect(() => { 
    if (syncConfig.url && syncConfig.key && isDirtyRef.current && syncStatus !== 'syncing') { 
      const now = Date.now();
      const delay = (firstDirtyTimeRef.current && now - firstDirtyTimeRef.current > 10000) ? 0 : 2000;
      const timer = window.setTimeout(performSync, delay); 
      return () => clearTimeout(timer); 
    } 
  }, [syncTrigger, syncConfig, performSync, syncStatus]);

  useEffect(() => { 
    if (currentUser) { 
      const verticalsList = (masterConfig.verticals || []) as string[];
      const filtered: string[] = verticalsList.filter((v: string) => canViewVertical(v)); 
      const perms = currentUser.verticalPermissions || {};
      const globalPerm = perms['Global'] || 'None';
      const hasSpecificAdmin = currentUser.role === 'Super Admin' || currentUser.role === 'Admin';
      if (!hasSpecificAdmin && globalPerm === 'None') { 
        if (filtered.length > 0) { 
          const firstAvailable: string = String(filtered[0] || 'All');
          setSharedFilters(prev => {
            if (prev.vertical.includes('All') && firstAvailable !== 'All') {
              return { ...prev, vertical: [firstAvailable] };
            }
            return prev;
          }); 
        } 
      } 
    } 
  }, [currentUser, masterConfig.verticals, canViewVertical]);

  const updateContext = useCallback((tab: AppTab, mode?: FiscalMode) => {
    const nextTab = tab;
    const nextMode = mode || ((tab === AppTab.PMO || tab === AppTab.PMO_ANALYTICS) ? processorMode : fiscalMode);
    
    const moduleKey = getModuleKey(nextTab, nextMode);
    const lastFY = tabFYMap[moduleKey] || selectedFY;
    
    const isTabChanging = nextTab !== activeTab;
    const isModeChanging = mode && mode !== fiscalMode;
    const isContextChanging = isTabChanging || isModeChanging;

    if (isContextChanging) {
      if (isDirtyRef.current) {
        performSync();
      }
      isInitializedRef.current = false;
      isDirtyRef.current = false;
    }

    if (isContextChanging && lastFY !== selectedFY) {
      console.log(`Restoring FY ${lastFY} for module ${moduleKey}`);
      handleSelectFY([lastFY as FiscalYear]);
      localStorage.setItem(SELECTED_FY_KEY, lastFY);
    }

    setActiveTab(nextTab);
    if (mode) {
      setFiscalMode(mode);
      if (nextTab === AppTab.PMO || nextTab === AppTab.PMO_ANALYTICS) setProcessorMode(mode);
    }
    
    setFocusedProjectId(null);
  }, [tabFYMap, selectedFY, fiscalMode, processorMode, getModuleKey, performSync]);

  const handleUpdateEmployees = useCallback(async (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    try {
      localStorage.setItem('global-employees-v1', LZString.compressToUTF16(JSON.stringify(newEmployees)));
    } catch (e) {
      console.warn('Failed to save employees to localStorage (quota exceeded). Relying on cloud sync.', e);
    }
    if (syncConfig.url && syncConfig.key) {
      try {
        setSyncStatus('syncing');
        await syncService.saveResources(syncConfig, newEmployees);
        setSyncStatus('synced');
        logAction("Resource Sync", `Registry updated with ${newEmployees.length} records`, "system");
      } catch (err) {
        setSyncStatus('error');
        notify("Resource cloud sync failed.", "error");
      }
    }
  }, [syncConfig, logAction, notify]);

  const handleAddProject = (p: any) => { 
    const currentFY = selectedFY || DEFAULT_FY;
    const fyTagKey = fiscalMode === 'Actuals' ? 'actualsFYs' : (fiscalMode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
    const newProjectId = generateUUID();
    const newProject: ProjectData = { 
      ...p, 
      id: newProjectId, 
      timelineOffset: 0, 
      igGates: Array(MAX_MONTHS).fill(''), 
      rows: (p as any).rows || {},
      actuals: (p as any).actuals || {},
      forecast: (p as any).forecast || {},
      isLocked: false,
      remarks: [],
      rowRemarks: {},
      prevYearBudget: (p as any).prevYearBudget || 0,
      expenseTillMar26: (p as any).expenseTillMar26 || 0,
      currentGate: (p as any).currentGate || 'TBD',
      [fyTagKey]: [currentFY]
    }; 
    setProjects(prev => [...prev, newProject]); 
    
    // Also push to master registry to ensure it's not filtered out
    const newMasterData: MasterProject = {
      id: newProjectId,
      code: p.code || '',
      name: p.name || '',
      vertical: p.vertical || 'SUPPORT',
      businessUnit: p.businessUnit || 'NA',
      buDomain: p.buDomain || 'NA',
      productFamily: p.productFamily || 'SUPPORT',
      category: p.category || 'Base',
      projectType: p.projectType || 'NA',
      tbc: p.tbc || 'Yes',
      pdh: p.pdh || 'NA',
      generation: p.generation || 'Current',
      createdAt: Date.now(),
      applicableFYs: [currentFY],
      timelineOffset: 0,
      igGates: Array(MAX_MONTHS).fill('')
    };
    handleSaveMasterProject(newMasterData);
    
    setIsAddProjectModalOpen(false); 
    logAction("Project Created", `${(p as any).code || 'unknown'}: ${(p as any).name || 'unknown'}`, "create");
    triggerLocalUpdate(); 
    notify(`Project ${(p as any).code || ''} initialized.`, "success"); 
  };
  
  const confirmDeletion = () => {
    if (!deletionTarget) return;
    if (deletionTarget.type === 'user') {
      setUsers(prev => prev.filter(u => u.id !== deletionTarget.id));
      logAction("Identity Purged", `${deletionTarget.name}`, "delete");
    } else if (deletionTarget.type === 'project') {
      setProjects(prev => prev.filter(p => p.id !== deletionTarget.id));
      logAction("Project Purged", `${deletionTarget.name}`, "delete");
    } else if (deletionTarget.type === 'employee') {
      const newEmployees = employees.filter(e => e.id !== deletionTarget.id);
      handleUpdateEmployees(newEmployees);
    } else if (deletionTarget.type === 'employees') {
      handleUpdateEmployees([]);
      logAction("All Resources Purged", "System-wide resource inventory reset", "delete");
    } else if (deletionTarget.type === 'projects') {
      handleDeleteAllProjects();
    } else if (deletionTarget.type === 'master') {
      handleApplyMasterDelete(deletionTarget.id);
    }
    triggerLocalUpdate();
    setDeletionTarget(null);
    notify(`${deletionTarget.type.toUpperCase()} purged.`, "success");
  };

  const handleCopyProjectData = useCallback((targetId: string, sourceId: string) => {
    let tName = "", sName = "";
    setProjects(prev => prev.map(p => {
      if (p.id === targetId) {
        const source = prev.find(s => s.id === sourceId);
        tName = p.name;
        sName = source?.name || "Unknown";
        return {
          ...p,
          rows: JSON.parse(JSON.stringify(source?.rows || {})),
          pmoRows: JSON.parse(JSON.stringify(source?.pmoRows || {})),
          actuals: JSON.parse(JSON.stringify(source?.actuals || {})),
          igGates: JSON.parse(JSON.stringify(source?.igGates || Array(MAX_MONTHS).fill(''))),
          rowRemarks: JSON.parse(JSON.stringify(source?.rowRemarks || {})),
        };
      }
      return p;
    }));
    logAction("Data Cloned", `From ${sName} to ${tName}`, "update");
    triggerLocalUpdate();
    notify("Cloned.", "success");
  }, [logAction, notify]);

  useEffect(() => {
    if (activeTab === AppTab.ENTRY) {
      // Logic if needed
    }
  }, [activeTab]);

  const handleUpdateMasterField = useCallback((id: string, field: string, value: any) => {
    setProjects((prev: ProjectData[]) => prev.map(p => {
      if (p.id !== id) return p;
      if (field === 'remarks') {
        const history = [...(p.remarks || [])];
        const last = history[history.length - 1];
        if (!last || last.text !== value) {
          history.push({
            text: String(value),
            userId: currentUser?.id || 'sys',
            username: currentUser?.username || 'sys',
            timestamp: Date.now()
          });
          logAction("Remark Update", `${p.code}: ${String(value).substring(0, 30)}...`, "update");
        }
        return { ...p, remarks: history };
      }
      logAction("Field Modified", `${p.code}: ${field} -> ${value}`, "update");
      return { ...p, [field]: value };
    }));
    triggerLocalUpdate();
  }, [currentUser, logAction]);
  
  const handleImportMaster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const isPmoTab = activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS;
      const targetMode = isPmoTab 
        ? (processorMode === 'Budget' ? 'PMO_Budget' : processorMode) 
        : (fiscalMode === 'Budget' ? 'Budget' : fiscalMode) as any;
      setImportTargetMode(targetMode);
      const importData = await processExcelImport(file, masterConfig, projects, currentMonths, targetMode, undefined, 'auto', employees);
      setPendingImportData(importData);
      setIsImportInspectionOpen(true);
    } catch (err: any) {
      notify("Protocol Error: " + err.message, "error");
    } finally {
      e.target.value = '';
    }
  };

  const finalizeImport = () => {
    if (!pendingImportData) return;
    try {
      const nowProjects = [...projects];
      const isBudgetImport = importTargetMode === 'Budget';
      const targetKey = importTargetMode === 'Actuals' ? 'actuals' : (importTargetMode === 'Forecast' ? 'forecast' : (importTargetMode === 'Budget' ? 'rows' : 'pmoRows'));
      
      const startMonth = currentMonths && currentMonths.length > 0 ? currentMonths[0] : 'Apr-25';
      const yearOffset = getAbsoluteMonthIndex(startMonth);
      
      const currentFY = selectedFY || DEFAULT_FY;
      
      pendingImportData.projects.forEach((p: any) => {
        if (p.status === 'error') return;
        const { status, errors, hasEstimationData, rows, pmoRows: pmoRowsInP, igGates, remarks, ...projectPayload } = p;
        const idx = nowProjects.findIndex(ex => ex.id === p.id);
        
        if (idx >= 0) {
          const existing = nowProjects[idx];
          // Remove undefined properties to avoid overwriting existing values
          const cleanPayload = Object.fromEntries(Object.entries(projectPayload).filter(([_, v]) => v !== undefined));
          const updated = { ...existing, ...cleanPayload };
          // Tagging Logic
          const fyTagKey = importTargetMode === 'Actuals' ? 'actualsFYs' : (importTargetMode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
          const existingTags = updated[fyTagKey] || [];
          if (!existingTags.includes(currentFY)) {
            updated[fyTagKey] = [...existingTags, currentFY];
          }

          const hasData = hasEstimationData || (p.rows && Object.keys(p.rows).length > 0) || (p.pmoRows && Object.keys(p.pmoRows).length > 0) || (p.skills && Object.keys(p.skills).length > 0) || (p.expenses && Object.keys(p.expenses).length > 0);

          if (hasData) {
            const targetData = { ...(existing[targetKey] || {}) };
            const importedRows = (importTargetMode === 'Budget')
              ? { ...(p.rows || {}), ...(p.skills || {}), ...(p.expenses || {}) }
              : ((importTargetMode as any) === 'PMO_Budget' || (importTargetMode as any) === 'PMO' ? { ...(p.pmoRows || {}) } : { ...(p[targetKey] || {}) });
            Object.keys(importedRows).forEach(cat => { 
              if (isSummaryOrCalculatedLabel(cat)) return;
              const existingArray = [...(targetData[cat] || Array(MAX_MONTHS).fill(0))];
              const importedValues = importedRows[cat]; 
              if (Array.isArray(importedValues)) {
                const isAbsolute = importedValues.length === MAX_MONTHS;
                const hasDataAtAbs = isAbsolute && importedValues.slice(yearOffset, yearOffset + 12).some(v => v !== 0);
                const hasDataAtStart = importedValues.slice(0, 12).some(v => v !== 0);
                for (let i = 0; i < 12; i++) {
                  const absIdx = yearOffset + i;
                  if (absIdx >= 0 && absIdx < MAX_MONTHS) {
                    let val = 0;
                    if (isAbsolute && hasDataAtAbs) {
                      val = importedValues[absIdx] !== undefined ? importedValues[absIdx] : 0;
                    } else if (hasDataAtStart) {
                      val = importedValues[i] !== undefined ? importedValues[i] : 0;
                    }
                    existingArray[absIdx] = val;
                  }
                }
              } else if (importedValues && typeof importedValues === 'object') {
                Object.entries(importedValues).forEach(([idxStr, v]) => {
                  const idx = parseInt(idxStr);
                  if (idx >= yearOffset && idx < yearOffset + 12 && idx >= 0 && idx < MAX_MONTHS) {
                    existingArray[idx] = v as number;
                  }
                });
              }
              targetData[cat] = existingArray;
            });
            updated[targetKey] = targetData;
            
            if (p.igGatesDict) {
              const existingGates = [...(existing.igGates || Array(MAX_MONTHS).fill(''))];
              Object.entries(p.igGatesDict).forEach(([idxStr, g]) => {
                const idx = parseInt(idxStr);
                if (idx >= 0 && idx < MAX_MONTHS) existingGates[idx] = g as string;
              });
              updated.igGates = existingGates;
            } else if (p.igGates && p.igGates.length > 0) {
              const existingGates = [...(existing.igGates || Array(MAX_MONTHS).fill(''))];
              p.igGates.forEach((g: string, i: number) => {
                if (i + yearOffset < MAX_MONTHS) existingGates[i + yearOffset] = g;
              });
              updated.igGates = existingGates;
            }

            // Merge Employee Roster Data
            if (p.employeeSkills) {
              const empSkillsKey = importTargetMode === 'Actuals' ? 'actualsEmployeeSkills' : (importTargetMode === 'Forecast' ? 'forecastEmployeeSkills' : ((importTargetMode as any) === 'PMO_Budget' || (importTargetMode as any) === 'PMO' ? 'pmoEmployeeSkills' : 'employeeSkills'));
              const existingSkills = { ...(existing[empSkillsKey] || {}) };
              Object.entries(p.employeeSkills).forEach(([skill, emailMap]) => {
                if (!existingSkills[skill]) existingSkills[skill] = {};
                Object.entries(emailMap as Record<string, number[]>).forEach(([email, importedValues]) => {
                  const existingArray = [...(existingSkills[skill][email] || Array(MAX_MONTHS).fill(0))];
              if (Array.isArray(importedValues)) {
                const isAbsolute = importedValues.length === MAX_MONTHS;
                if (isAbsolute) {
                  for (let i = 0; i < 12; i++) {
                    const absIdx = yearOffset + i;
                    if (absIdx >= 0 && absIdx < MAX_MONTHS) existingArray[absIdx] = importedValues[absIdx] || 0;
                  }
                } else {
                  importedValues.forEach((v, i) => {
                    const finalIdx = i + yearOffset;
                    if (finalIdx >= 0 && finalIdx < MAX_MONTHS) existingArray[finalIdx] = v;
                  });
                }
              } else if (importedValues && typeof importedValues === 'object') {
                Object.entries(importedValues).forEach(([idxStr, v]) => {
                  const idx = parseInt(idxStr);
                  if (idx >= yearOffset && idx < yearOffset + 12 && idx >= 0 && idx < MAX_MONTHS) {
                    existingArray[idx] = v as number;
                  }
                });
              }
                  existingSkills[skill][email] = existingArray;
                });
              });
              updated[empSkillsKey] = existingSkills;
            }

            const mergeEmpHours = (existingMap: any, importedMap: any) => {
              const result = { ...(existingMap || {}) };
              if (!importedMap) return result;
              Object.entries(importedMap).forEach(([email, importedValues]) => {
                const existingArray = [...(result[email] || Array(MAX_MONTHS).fill(0))];
              if (Array.isArray(importedValues)) {
                const isAbsolute = (importedValues as number[]).length === MAX_MONTHS;
                if (isAbsolute) {
                  for (let i = yearOffset; i < yearOffset + 12; i++) {
                    if (i >= 0 && i < MAX_MONTHS) existingArray[i] = (importedValues as number[])[i] || 0;
                  }
                } else {
                  (importedValues as number[]).forEach((v, i) => {
                    const finalIdx = i + yearOffset;
                    if (finalIdx >= 0 && finalIdx < MAX_MONTHS) existingArray[finalIdx] = v;
                  });
                }
              } else if (importedValues && typeof importedValues === 'object') {
                  Object.entries(importedValues as Record<string, number>).forEach(([idxStr, v]) => {
                    const idx = parseInt(idxStr);
                    if (idx >= yearOffset && idx < yearOffset + 12 && idx >= 0 && idx < MAX_MONTHS) {
                      existingArray[idx] = v;
                    }
                  });
                }
                result[email] = existingArray;
              });
              return result;
            };

            if (p.employeeBillableHours) updated.employeeBillableHours = mergeEmpHours(existing.employeeBillableHours, p.employeeBillableHours);
            if (p.employeeNonBillableHours) updated.employeeNonBillableHours = mergeEmpHours(existing.employeeNonBillableHours, p.employeeNonBillableHours);
            if (p.employeeIdleHours) updated.employeeIdleHours = mergeEmpHours(existing.employeeIdleHours, p.employeeIdleHours);
            
            if (p.employeeInfo) {
              updated.employeeInfo = { ...(existing.employeeInfo || {}), ...p.employeeInfo };
            }
          }
          if (remarks && remarks.length > 0 && remarks[0]) {
            const currentHistory = [...(updated.remarks || [])];
            const lastEntry = currentHistory[currentHistory.length - 1];
            if (!lastEntry || (lastEntry as RemarkEntry).text !== remarks[0].text) { 
              currentHistory.push(remarks[0]); 
              updated.remarks = currentHistory; 
            }
          }
          nowProjects[idx] = updated;
        } else {
          const fyTagKey = importTargetMode === 'Actuals' ? 'actualsFYs' : (importTargetMode === 'Forecast' ? 'forecastFYs' : 'budgetFYs');
          const cleanPayload = Object.fromEntries(Object.entries(projectPayload).filter(([_, v]) => v !== undefined));
          const newProject: any = { 
            vertical: 'Unassigned',
            category: 'KTB',
            tbc: 'Yes',
            ...cleanPayload, 
            rows: {}, 
            pmoRows: {},
            actuals: {}, 
            forecast: {},
            id: generateUUID(),
            igGates: Array(MAX_MONTHS).fill(''), 
            remarks: p.remarks || [], 
            timelineOffset: 0, 
            isLocked: false,
            [fyTagKey]: [currentFY]
          };
          
          const hasNewData = hasEstimationData || (p.rows && Object.keys(p.rows).length > 0) || (p.pmoRows && Object.keys(p.pmoRows).length > 0) || (p.skills && Object.keys(p.skills).length > 0);
          if (hasNewData) {
            const targetData: Record<string, number[]> = {};
            const importedRows = (importTargetMode === 'Budget')
              ? { ...(p.rows || {}), ...(p.skills || {}), ...(p.expenses || {}) }
              : ((importTargetMode as any) === 'PMO_Budget' || (importTargetMode as any) === 'PMO' ? { ...(p.pmoRows || {}) } : { ...(p[targetKey] || {}) });
            Object.keys(importedRows).forEach(cat => {
              if (isSummaryOrCalculatedLabel(cat)) return;
              const arr = Array(MAX_MONTHS).fill(0);
              const importedValues = importedRows[cat];
              if (Array.isArray(importedValues)) {
                const isAbsolute = importedValues.length === MAX_MONTHS;
                if (isAbsolute) {
                  const hasDataAtYearOffset = importedValues.slice(yearOffset, yearOffset + 12).some(v => v !== 0);
                  const hasDataOutsideZeroTo11 = importedValues.slice(12).some(v => v !== 0);
                  if (hasDataAtYearOffset || hasDataOutsideZeroTo11) {
                    for (let i = 0; i < MAX_MONTHS; i++) {
                      if (importedValues[i] !== undefined) arr[i] = importedValues[i];
                    }
                  } else {
                    for (let i = 0; i < 12; i++) {
                      const absIdx = yearOffset + i;
                      if (absIdx >= 0 && absIdx < MAX_MONTHS) arr[absIdx] = importedValues[i] || 0;
                    }
                  }
                } else {
                  importedValues.forEach((v: number, i: number) => {
                    const finalIdx = i + yearOffset;
                    if (finalIdx >= 0 && finalIdx < MAX_MONTHS) arr[finalIdx] = v;
                  });
                }
              } else if (importedValues && typeof importedValues === 'object') {
                Object.entries(importedValues).forEach(([idxStr, v]) => {
                  const idx = parseInt(idxStr);
                  if (idx >= yearOffset && idx < yearOffset + 12 && idx >= 0 && idx < MAX_MONTHS) {
                    arr[idx] = v as number;
                  }
                });
              }
              targetData[cat] = arr;
            });
            newProject[targetKey] = targetData;
            
            const gateArr = Array(MAX_MONTHS).fill('');
            if (p.igGatesDict) {
              Object.entries(p.igGatesDict).forEach(([idxStr, g]) => {
                const idx = parseInt(idxStr);
                if (idx >= 0 && idx < MAX_MONTHS) gateArr[idx] = g as string;
              });
            } else if (p.igGates) {
              p.igGates.forEach((g: string, i: number) => {
                if (i + yearOffset < MAX_MONTHS) gateArr[i + yearOffset] = g;
              });
            }
            newProject.igGates = gateArr;

            // Merge Employee Roster Data for new project
            if (p.employeeSkills) {
              const empSkillsKey = importTargetMode === 'Actuals' ? 'actualsEmployeeSkills' : (importTargetMode === 'Forecast' ? 'forecastEmployeeSkills' : ((importTargetMode as any) === 'PMO_Budget' || (importTargetMode as any) === 'PMO' ? 'pmoEmployeeSkills' : 'employeeSkills'));
              const targetSkills: Record<string, Record<string, number[]>> = {};
              Object.entries(p.employeeSkills).forEach(([skill, emailMap]) => {
                targetSkills[skill] = {};
                Object.entries(emailMap as Record<string, number[]>).forEach(([email, importedValues]) => {
                  const arr = Array(MAX_MONTHS).fill(0);
                  if (Array.isArray(importedValues)) {
                    importedValues.forEach((v, i) => {
                      if (i + yearOffset < MAX_MONTHS) arr[i + yearOffset] = v;
                    });
                  } else if (importedValues && typeof importedValues === 'object') {
                    Object.entries(importedValues).forEach(([idxStr, v]) => {
                      const idx = parseInt(idxStr);
                      if (idx >= 0 && idx < MAX_MONTHS) arr[idx] = v as number;
                    });
                  }
                  targetSkills[skill][email] = arr;
                });
              });
              newProject[empSkillsKey] = targetSkills;
            }

            const createEmpHours = (importedMap: any) => {
              const result: Record<string, number[]> = {};
              if (!importedMap) return result;
              Object.entries(importedMap).forEach(([email, importedValues]) => {
                const arr = Array(MAX_MONTHS).fill(0);
                if (Array.isArray(importedValues)) {
                  (importedValues as number[]).forEach((v, i) => {
                    if (i + yearOffset < MAX_MONTHS) arr[i + yearOffset] = v;
                  });
                } else if (importedValues && typeof importedValues === 'object') {
                  Object.entries(importedValues as Record<string, number>).forEach(([idxStr, v]) => {
                    const idx = parseInt(idxStr);
                    if (idx >= 0 && idx < MAX_MONTHS) arr[idx] = v;
                  });
                }
                result[email] = arr;
              });
              return result;
            };

            if (p.employeeBillableHours) newProject.employeeBillableHours = createEmpHours(p.employeeBillableHours);
            if (p.employeeNonBillableHours) newProject.employeeNonBillableHours = createEmpHours(p.employeeNonBillableHours);
            if (p.employeeIdleHours) newProject.employeeIdleHours = createEmpHours(p.employeeIdleHours);
            
            if (p.employeeInfo) {
              newProject.employeeInfo = p.employeeInfo;
            }
          }
          
          nowProjects.push(newProject);
          
          // CRITICAL FIX: Ensure project gets into Master Projects registry
          const newMasterData: MasterProject = {
            id: newProject.id,
            code: p.code || '',
            name: p.name || '',
            vertical: p.vertical || 'SUPPORT',
            businessUnit: p.businessUnit || 'NA',
            buDomain: p.buDomain || 'NA',
            productFamily: p.productFamily || 'SUPPORT',
            category: p.category || 'Base',
            projectType: p.projectType || 'NA',
            tbc: p.tbc || 'Yes',
            pdh: p.pdh || 'NA',
            generation: p.generation || 'Current',
            createdAt: Date.now(),
            applicableFYs: [currentFY],
            timelineOffset: 0,
            igGates: Array(MAX_MONTHS).fill('')
          };
          
          setMasterProjects(prev => {
            const next = [...prev, newMasterData];
            localStorage.setItem('masterProjects', JSON.stringify(next));
            if (syncConfig.url && syncConfig.key) {
              syncService.saveMasterProjects(syncConfig, next).catch(e => console.warn(e));
            }
            return next;
          });
        }
      });
      setProjects(nowProjects);
      logAction("Registry Import", `Synchronized ${pendingImportData.summary.total} entries`, "system");
      triggerLocalUpdate(); 
    } catch (err) {
      console.error("Import failed:", err);
      alert("Import failed during commit. Check console for details.");
    } finally {
      setIsImportInspectionOpen(false); 
      setPendingImportData(null); 
    }
  };

  const hasMeaningfulData = useCallback((data: Record<string, number[]>) => {
    return Object.values(data || {}).some(arr => arr.some(v => v !== 0));
  }, []);

  const totalsLookup = useMemo(() => { 
    const map: Record<string, { budget: any, actuals: any, forecast: any }> = {}; 
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const isAllFY = fyStrings.includes('All FY');
    
    let yearOffset = 0;
    let range = MAX_MONTHS;

    if (!isAllFY) {
      const startYears = fyStrings.map(fy => {
        const match = fy.match(/\d+/);
        return match ? parseInt(match[0]) : 25;
      });
      const minYear = Math.min(...startYears);
      const maxYear = Math.max(...startYears);
      yearOffset = (minYear - 19) * 12;
      range = (maxYear - minYear + 1) * 12;
    }

    projects.forEach(p => { 
      const isHolidayLeave = (p.name || '').toLowerCase().includes('holiday') || (p.name || '').toLowerCase().includes('leave');
      
      const off = p.timelineOffset || 0; 
      
      const calc = (sourceKey: 'rows' | 'actuals' | 'forecast') => {
        let directMM = 0, contractedMM = 0, exp = 0, contractedExp = 0; 
        const rawSource = sourceKey === 'rows' 
          ? (p.rows && Object.keys(p.rows).length > 0 ? p.rows : {})
          : p[sourceKey];
        const hasData = rawSource && Object.keys(rawSource).length > 0;
        const dataSource = hasData 
          ? rawSource 
          : (sourceKey === 'rows' 
              ? { ...(p.rows || {}), ...(p.skills || {}), ...(p.expenses || {}) } 
              : {});
        
        // Use the range calculated above for the target period
        const targetRange = isAllFY ? MAX_MONTHS : range;
        
        // Pre-calculate rates for all months to handle multi-year changes
        const ratesCache: Record<number, { hRate: number, cRate: number }> = {};
        for (let i = 0; i < MAX_MONTHS; i++) {
          const fyStartYear = 19 + Math.floor(i / 12);
          const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
          const fyConfig = masterConfig.fyFinancials?.[fyStr];
          ratesCache[i] = {
            hRate: (fyConfig?.hourlyRate !== undefined && fyConfig?.hourlyRate !== null) ? fyConfig.hourlyRate : (masterConfig.hourlyRate || RATE_PER_HOUR),
            cRate: (fyConfig?.contractedEmployeeRate !== undefined && fyConfig?.contractedEmployeeRate !== null) ? fyConfig.contractedEmployeeRate : (masterConfig.contractedEmployeeRate || CONTRACTED_EMPLOYEE_RATE)
          };
        }

        const hpm = 180;
        let directManCr = 0;
        let contractedManCr = 0;

        // Group and map categories first to avoid duplication
        const groupedData: Record<string, Record<number, number>> = {};
        Object.entries(dataSource).forEach(([rawCat, monthsData]) => {
          const cat = SKILL_MAPPING[rawCat] || rawCat;
          if (!groupedData[cat]) groupedData[cat] = {};
          const getVal = (idx: number) => {
            if (Array.isArray(monthsData)) return monthsData[idx] || 0;
            if (monthsData && typeof monthsData === 'object') return (monthsData as any)[idx] || (monthsData as any)[String(idx)] || 0;
            return 0;
          };
          for (let i = 0; i < MAX_MONTHS; i++) {
            const v = getVal(i);
            if (v !== 0) groupedData[cat][i] = (groupedData[cat][i] || 0) + v;
          }
        });

        Object.entries(groupedData).forEach(([cat, catMonths]) => {
          if (isSummaryOrCalculatedLabel(cat)) return;
          const normCat = cat.trim().toLowerCase();
          const isContractedExp = normCat === 'contracted employee expense';

          const catKind = classifyCategory(cat);
          const isContracted = catKind === 'CONTRACTED_MANPOWER';
          const isManpower = catKind === 'DIRECT_MANPOWER' || catKind === 'CONTRACTED_MANPOWER';
          const isExpense = catKind === 'EXPENSE';

          for (let i = 0; i < MAX_MONTHS; i++) {
            const v = catMonths[i] || 0;
            const absoluteMonthIdx = i;
            const fyStartYear = 19 + Math.floor(absoluteMonthIdx / 12);
            const fyStr = `FY ${fyStartYear}-${fyStartYear + 1}`;
            
            if (isAllFY || fyStrings.includes(fyStr as any)) {
              const { hRate, cRate } = ratesCache[i];
              const val = Number(v) || 0;
              if (val === 0) continue;

              if (isManpower) {
                if (isContracted) {
                  contractedMM += val;
                  contractedManCr += (val * hpm * cRate) / 10000000;
                } else {
                  directMM += val;
                  if (!isHolidayLeave) {
                    directManCr += (val * hpm * hRate) / 10000000;
                  }
                }
              } else if (isExpense) {
                if (!isHolidayLeave || isContracted || isContractedExp) {
                  if (isContractedExp) {
                    const mmObj = groupedData['Contracted Employee'] || groupedData['Contracted Employee (MM)'] || {};
                    if ((mmObj[i] || 0) === 0) {
                      contractedExp += val > 1000 ? val / 10000000 : val;
                    }
                  } else {
                    exp += val > 1000 ? val / 10000000 : val;
                  }
                }
              }
            }
          }
        });
        const totalManCr = directManCr + contractedManCr + contractedExp;
        const expCr = exp; 
        
        return { 
          mm: directMM + contractedMM, 
          manpowerCr: totalManCr, 
          expensesCr: expCr, 
          grandTotalCrs: totalManCr + expCr 
        }; 
      };

      map[p.id] = { 
        budget: calc('rows'),
        actuals: calc('actuals'),
        forecast: calc('forecast')
      };
    }); 
    return map; 
  }, [projects, currentFYFinancials, selectedFYs, fiscalMode]);

  const calculateUnifiedSummary = useCallback((filterSet: any, mode: FiscalMode) => {
    const searchStr = filterSet.search.toLowerCase().trim();
    const isActualsMode = mode === 'Actuals';
    const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
    const isAllFY = fyStrings.includes('All FY');
    
    const registrySubset = projects.filter(p => {
      if (!canViewVertical(p.vertical)) return false;
      const matchVertical = filterSet.vertical.includes('All') ? true : filterSet.vertical.map((v:any)=>v.toUpperCase()).includes((p.vertical || "").toUpperCase());
      const matchDomain = filterSet.domain.includes('All') ? true : filterSet.domain.includes(p.buDomain);
      const matchBu = filterSet.bu.includes('All') ? true : filterSet.bu.includes(p.businessUnit);
      const matchType = filterSet.projectType.includes('All') ? true : filterSet.projectType.includes(p.projectType);
      const matchTbc = filterSet.tbc.includes('All') ? true : filterSet.tbc.includes(p.tbc);
      const matchCategory = filterSet.category.includes('All') ? true : filterSet.category.includes(p.category);
      const matchFamily = filterSet.family.includes('All') ? true : filterSet.family.includes(p.productFamily);
      const matchPdh = filterSet.pdh.includes('All') ? true : filterSet.pdh.includes(p.pdh);
      const matchGeneration = (filterSet.generation || []).includes('All') ? true : (filterSet.generation || []).includes(p.generation || 'Current');
      const matchSearch = !searchStr || (p.code || '').toLowerCase().includes(searchStr) || (p.name || '').toLowerCase().includes(searchStr);
      
      const matchProjectId = filterSet.projectId.includes('All') ? true : filterSet.projectId.includes(p.code);
      
      if (mode === 'Budget') {
        const hasTag = isAllFY || fyStrings.some(fy => (p.budgetFYs || []).includes(fy));
        const t = totalsLookup[p.id]?.budget || { grandTotalCrs: 0, mm: 0 };
        if (!hasTag && t.grandTotalCrs === 0 && t.mm === 0 && !searchStr && (filterSet.projectId.includes('All') || filterSet.projectId.length === 0)) return false;
      }

      return matchVertical && matchDomain && matchBu && matchType && matchTbc && matchCategory && matchFamily && matchPdh && matchGeneration && matchSearch && matchProjectId;
    });

    let baseEffortsMM = 0, baseManpowerCr = 0, baseExpensesCr = 0, baseNewCr = 0, baseCoCr = 0, baseTotalCr = 0;
    let consolidatedTotalCr = 0;
    let confirmedCount = 0;
    let portfolioCount = 0;
    let confirmedTotalCr = 0;
    let portfolioTotalCr = 0;

    registrySubset.forEach(p => {
      const t = totalsLookup[p.id] || { budget: { grandTotalCrs: 0, mm: 0, manpowerCr: 0, expensesCr: 0 }, actuals: { grandTotalCrs: 0, mm: 0, manpowerCr: 0, expensesCr: 0 }, forecast: { grandTotalCrs: 0, mm: 0, manpowerCr: 0, expensesCr: 0 } };
      const currentStats = mode === 'Actuals' ? t.actuals : (mode === 'Forecast' ? t.forecast : t.budget);
      
      const hasCurrentData = (currentStats.grandTotalCrs || 0) !== 0 || (currentStats.mm || 0) !== 0;
      
      // Explicit Tag Check
      const hasTag = mode === 'Actuals' 
        ? (isAllFY || fyStrings.some(fy => (p.actualsFYs || []).includes(fy)))
        : (mode === 'Forecast' ? (isAllFY || fyStrings.some(fy => (p.forecastFYs || []).includes(fy))) : (isAllFY || fyStrings.some(fy => (p.budgetFYs || []).includes(fy))));

      // Exclude PMO-only projects from Budget section metrics
      const hasPmoData = (p.pmoRows && Object.keys(p.pmoRows).length > 0) || hasMeaningfulData(p.pmoRows);
      const hasBudgetData = (p.rows && Object.keys(p.rows).length > 0 && hasMeaningfulData(p.rows)) || (t.budget.grandTotalCrs || 0) > 0;
      if (mode === 'Budget' && hasPmoData && !hasBudgetData) return;

      // A project belongs to the current mode if it has the tag OR has data OR it's PMO Hub (which is multi-year)
      const belongsToMode = (mode === 'Budget') ? (hasTag || hasCurrentData) : true;

      if (belongsToMode) {
        portfolioCount++;
        const spentCr = (currentStats.grandTotalCrs || 0);
        portfolioTotalCr += spentCr;
        
        if (isConfirmedProject(p)) {
          confirmedCount++;
          confirmedTotalCr += spentCr;
        }

        // Include all filtered projects in the hub totals for better visibility of imported data
        consolidatedTotalCr += spentCr;
        baseEffortsMM += (currentStats.mm || 0); 
        baseManpowerCr += (currentStats.manpowerCr || 0); 
        baseExpensesCr += (currentStats.expensesCr || 0); 
        baseTotalCr += spentCr;
        
        if (isNew(p.category)) baseNewCr += spentCr; 
        else if (isCO(p.category)) baseCoCr += spentCr;
      }
    });

    return { confirmedCount, portfolioCount, baseEffortsMM, baseManpowerCr, baseExpensesCr, baseNewCr, baseCoCr, baseTotalCr, consolidatedTotalCr, confirmedTotalCr, portfolioTotalCr };
  }, [projects, totalsLookup, canViewVertical, selectedFYs]);

  const projectsInScope = useMemo(() => {
    const searchStr = sharedFilters.search.toLowerCase().trim();
    const familyMatch = (p: ProjectData) => {
      if (sharedFilters.family.includes('All')) return true;
      return sharedFilters.family.includes(p.productFamily);
    };
    return projects.filter(p => {
      if (!canViewVertical(p.vertical)) return false;
      const isActualsMode = fiscalMode === 'Actuals';
      const isForecastMode = fiscalMode === 'Forecast';
      const fyStrings = Array.isArray(selectedFYs) ? selectedFYs : [selectedFYs as FiscalYear];
      const isAllFY = fyStrings.includes('All FY');
      const t = totalsLookup[p.id] || { budget: { grandTotalCrs: 0 }, actuals: { grandTotalCrs: 0 }, forecast: { grandTotalCrs: 0 } };
      
      const hasCurrentData = isActualsMode 
        ? t.actuals.grandTotalCrs > 0 
        : (isForecastMode ? t.forecast.grandTotalCrs > 0 : t.budget.grandTotalCrs > 0);
      
      // Explicit Tag Check
      const hasTag = isAllFY 
        ? true 
        : (isActualsMode 
          ? fyStrings.some(fy => (p.actualsFYs || []).includes(fy))
          : (isForecastMode ? fyStrings.some(fy => (p.forecastFYs || []).includes(fy)) : fyStrings.some(fy => (p.budgetFYs || []).includes(fy))));
      
      // Exclude PMO-only projects from the Budget section list
      const hasPmoData = (p.pmoRows && Object.keys(p.pmoRows).length > 0) || hasMeaningfulData(p.pmoRows);
      const hasBudgetData = (p.rows && Object.keys(p.rows).length > 0 && hasMeaningfulData(p.rows)) || t.budget.grandTotalCrs > 0;
      if (fiscalMode === 'Budget' && hasPmoData && !hasBudgetData) return false;

      const belongsToMode = (fiscalMode === 'Budget') ? (hasTag || hasCurrentData) : true;
      
      const matchProjectId = sharedFilters.projectId.includes('All') ? true : sharedFilters.projectId.includes(p.code);
      
      // Filter out projects that belong to the OTHER mode exclusively
      if (!belongsToMode && !searchStr && (sharedFilters.projectId.includes('All') || sharedFilters.projectId.length === 0)) return false;

      // Hide empty projects in Actuals mode if toggle is off AND it's not explicitly tagged for this FY
      if (isActualsMode && !hasCurrentData && !hasTag && !showEmptyActuals && !searchStr && (sharedFilters.projectId.includes('All') || sharedFilters.projectId.length === 0)) return false;

      const matchVertical = sharedFilters.vertical.includes('All') ? true : sharedFilters.vertical.map((v:any)=>v.toUpperCase()).includes((p.vertical || "").toUpperCase());
      const matchDomain = sharedFilters.domain.includes('All') ? true : sharedFilters.domain.includes(p.buDomain);
      const matchBu = sharedFilters.bu.includes('All') ? true : sharedFilters.bu.includes(p.businessUnit);
      const matchCustomer = (sharedFilters.customer || []).includes('All') ? true : (sharedFilters.customer || []).includes(p.customer);
      const matchType = sharedFilters.projectType.includes('All') ? true : sharedFilters.projectType.includes(p.projectType);
      const matchTbc = sharedFilters.tbc.includes('All') ? true : sharedFilters.tbc.map((v: any) => v.toString().toUpperCase()).includes(((p.tbc || 'Yes') as string).toUpperCase());
      const matchCategory = sharedFilters.category.includes('All') ? true : sharedFilters.category.includes(p.category);
      const familyMatches = familyMatch(p);
      const matchPdh = sharedFilters.pdh.includes('All') ? true : sharedFilters.pdh.includes(p.pdh);
      const matchGeneration = (sharedFilters.generation || []).includes('All') ? true : (sharedFilters.generation || []).includes(p.generation || 'Current');
      const matchSearch = !searchStr || (p.code || '').toLowerCase().includes(searchStr) || (p.name || '').toLowerCase().includes(searchStr);
      
      return matchVertical && matchDomain && matchBu && matchCustomer && matchType && matchTbc && matchCategory && familyMatches && matchPdh && matchGeneration && matchSearch && matchProjectId;
    });
  }, [projects, sharedFilters, canViewVertical, fiscalMode, showEmptyActuals, totalsLookup, selectedFYs]);

  const currentSummary = useMemo(() => {
    let baseEffortsMM = 0, baseManpowerCr = 0, baseExpensesCr = 0, baseNewCr = 0, baseCoCr = 0, baseTotalCr = 0;
    let consolidatedTotalCr = 0;
    let confirmedCount = 0;
    let portfolioCount = 0;
    let confirmedTotalCr = 0;
    let portfolioTotalCr = 0;

    projectsInScope.forEach(p => {
      const t = totalsLookup[p.id] || { budget: { grandTotalCrs: 0, mm: 0, manpowerCr: 0, expensesCr: 0 }, actuals: { grandTotalCrs: 0, mm: 0, manpowerCr: 0, expensesCr: 0 }, forecast: { grandTotalCrs: 0, mm: 0, manpowerCr: 0, expensesCr: 0 } };
      const currentStats = fiscalMode === 'Actuals' ? t.actuals : (fiscalMode === 'Forecast' ? t.forecast : t.budget);
      
      portfolioCount++;
      const spentCr = (currentStats.grandTotalCrs || 0);
      portfolioTotalCr += spentCr;
      
      if (isConfirmedProject(p)) {
        confirmedCount++;
        confirmedTotalCr += spentCr;
      }

      consolidatedTotalCr += spentCr;
      baseEffortsMM += (currentStats.mm || 0); 
      baseManpowerCr += (currentStats.manpowerCr || 0); 
      baseExpensesCr += (currentStats.expensesCr || 0); 
      baseTotalCr += spentCr;
      
      if (isNew(p.category)) baseNewCr += spentCr; 
      else if (isCO(p.category)) baseCoCr += spentCr;
    });

    return { 
      confirmedCount, 
      portfolioCount, 
      baseEffortsMM, 
      baseManpowerCr, 
      baseExpensesCr, 
      baseNewCr, 
      baseCoCr, 
      baseTotalCr, 
      consolidatedTotalCr, 
      confirmedTotalCr, 
      portfolioTotalCr 
    };
  }, [projectsInScope, totalsLookup, fiscalMode]);

  const handleUpdateMetadata = useCallback((projectId: string, field: string, value: any) => {
    setProjects((prev: ProjectData[]) => {
      const targetIdx = prev.findIndex(p => p.id === projectId);
      if (targetIdx === -1) return prev;
      const target = prev[targetIdx];
      const updatedProjects = [...prev];
      let finalState = { ...target, [field]: value };
      
      if (field === 'rowRemarks') {
        const newRowRemarks: Record<string, RemarkEntry[]> = { ...(target.rowRemarks || {}) };
        const remarkData = value as Record<string, string>;
        Object.entries(remarkData).forEach(([cat, newText]) => {
          const history = [...(newRowRemarks[cat] || [])];
          const last = history[history.length - 1];
          if (!last || last.text !== newText) {
            history.push({ text: String(newText), userId: currentUser?.id || 'sys', username: currentUser?.username || 'sys', timestamp: Date.now() });
          }
          newRowRemarks[cat] = history;
        });
        finalState = { ...target, rowRemarks: newRowRemarks };
      } else if (field === 'remarks') {
        const history = [...(target.remarks || [])];
        const last = history[history.length - 1];
        if (!last || last.text !== value) {
          history.push({ text: String(value), userId: currentUser?.id || 'sys', username: currentUser?.username || 'sys', timestamp: Date.now() });
        }
        finalState = { ...target, remarks: history };
      } else if (field === 'igGateUpdate') {
        const gateData = value as { monthIdx: number, gateVal: string };
        const gates = [...(target.igGates || Array(MAX_MONTHS).fill(''))];
        const actualIdx = gateData.monthIdx - (target.timelineOffset || 0);
        if (actualIdx >= 0 && actualIdx < MAX_MONTHS) { gates[actualIdx] = gateData.gateVal; finalState = { ...target, igGates: gates }; }
      }
      updatedProjects[targetIdx] = finalState;
      return updatedProjects;
    });
    triggerLocalUpdate();
  }, [currentUser]);

  useEffect(() => {
    console.log('activeTab changed:', activeTab);
  }, [activeTab]);

  const handleLogout = useCallback((e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setCurrentUser(null);
    setActiveTab(AppTab.HOME);
    navigate('/');
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    isInitializedRef.current = false;
    isDirtyRef.current = false;
    notify("Session terminated successfully.", "info");
  }, [notify, navigate]);

  const handleExportMaster = async () => { 
    if (projectsInScope.length === 0) return notify("No protocol data in current scope to export.", "error");
    try {
      await exportProjectRegistry(projectsInScope, masterConfig, selectedFY, currentMonths, fiscalMode);
      notify(`Consolidated ${fiscalMode} Protocol Exported Successfully.`, "success");
    } catch (err) {
      console.error(err);
      notify("Export Protocol Failure.", "error");
    }
  };

  const handleDeleteAllProjects = useCallback(async () => {
    if (!isAdmin) return;
    
    const isAllFY = selectedFY === 'All FY';
    
    if (isAllFY) {
      // Global Purge - Clear all years in localStorage
      ALL_FISCAL_YEARS.forEach(fy => {
        ['Budget', 'Actuals', 'Forecast'].forEach(mode => {
          const key = getStorageKey(fy, mode);
          localStorage.removeItem(key);
          
          // Also attempt to clear cloud if configured
          if (syncConfig.url && syncConfig.key) {
            const docId = getCloudYearKey(fy, mode);
            syncService.deleteSnapshot(syncConfig, docId).catch(() => {});
          }
        });
      });
      logAction("System Purge", "All projects across all fiscal years have been deleted", "delete");
    } else {
      // Current FY Purge
      const currentFY = selectedFY || DEFAULT_FY;
      ['Budget', 'Actuals', 'Forecast'].forEach(mode => {
        const key = getStorageKey(currentFY, mode);
        localStorage.removeItem(key);
        if (syncConfig.url && syncConfig.key) {
          const docId = getCloudYearKey(currentFY, mode);
          syncService.deleteSnapshot(syncConfig, docId).catch(() => {});
        }
      });
      logAction("FY Purge", `All projects for ${currentFY} have been deleted`, "delete");
    }

    setProjects([]);
    setProcessorRawData([]);
    setProcessorFileName('');
    isDirtyRef.current = true;
    setDeletionTarget(null);
    notify(isAllFY ? "All projects across all years have been purged." : `All projects for ${selectedFY || DEFAULT_FY} have been purged.`, "success");
  }, [isAdmin, notify, logAction, selectedFY, syncConfig]);

  const renderContent = () => {
    if (activeTab === AppTab.HOME) {
      return <HomeView updateContext={updateContext} />;
    }

    const userAuthorizedVerticals = (masterConfig.verticals || []).filter(v => canViewVertical(v));
    const verticalOptions: string[] = ['All', ...userAuthorizedVerticals];
    const yearsToCheckObj = selectedFYs.includes('All FY')
      ? (ALL_FISCAL_YEARS.filter(y => y !== 'All FY') as FiscalYear[])
      : selectedFYs;

    const isBudgetLocked = masterConfig.isFiscalLocked || yearsToCheckObj.some(fy => !!fiscalLocks[`budget_page_${fy}`]);
    const isPMOMasterLocked = (() => {
      if (masterConfig.isFiscalLocked) return true;
      
      // 1. Check if any selected year has local PMO master lock
      if (yearsToCheckObj.some(fy => !!fiscalLocks[`pmo_page_${fy}_master`])) return true;

      // 2. If ANY year level PMO master lock is enabled and current sub-tab mode is Actuals, lock everything
      const hasAnyPMOMasterLock = ALL_FISCAL_YEARS.filter(y => y !== 'All FY').some(fy => !!fiscalLocks[`pmo_page_${fy}_master`]);
      if (processorMode === 'Actuals' && hasAnyPMOMasterLock) return true;

      // 3. Check if current PMO mode (Budget, Forecast, Actuals) is locked for any selected year
      if (yearsToCheckObj.some(fy => !!fiscalLocks[`pmo_page_${fy}_${processorMode}`])) return true;

      return false;
    })();

    const isCurrentContextLocked = activeTab === AppTab.ENTRY ? isBudgetLocked : ((activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS) ? isPMOMasterLocked : masterConfig.isFiscalLocked);

    const sharedActions = (
      <div className="flex items-center gap-2">
        {canAddProject && <button disabled={isCurrentContextLocked} onClick={() => setIsAddProjectModalOpen(true)} className="h-10 px-5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center space-x-1.5 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="4"/></svg><span className="leading-none">New</span></button>}
        {isAdmin && <>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportMaster} />
          <button disabled={isCurrentContextLocked} onClick={() => fileInputRef.current?.click()} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m-4-4l4 4 4-4" strokeWidth="3"/></svg>
            <span className="leading-none">Import</span>
          </button>
          <button 
            disabled={isCurrentContextLocked || projects.length === 0} 
            onClick={() => setDeletionTarget({ type: 'projects', id: 'all', name: 'All Projects' })}
            className="h-10 px-4 bg-white border border-rose-200 rounded-xl text-[10px] font-black text-rose-500 uppercase hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="leading-none">Delete All</span>
          </button>
        </>}
        <button onClick={handleExportMaster} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 transition-all flex items-center justify-center space-x-2 shadow-sm"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 16V4m-4 4l4-4 4 4" strokeWidth="3"/></svg><span className="leading-none">Export</span></button>
      </div>
    );

    console.log('Rendering content for activeTab:', activeTab);
    switch(activeTab) {
      case AppTab.MASTER_PROJECTS:
        return (
          <div className="p-8">
            <MasterProjectList 
              projects={masterProjects.filter(p => selectedFY === 'All FY' || p.applicableFYs.includes(selectedFY))}
              allMasterProjects={masterProjects}
              currentFY={selectedFY}
              onSave={handleSaveMasterProject}
              onDelete={handleDeleteMasterProject}
              onDeleteAll={() => {
                setMasterProjects([]);
                localStorage.setItem('masterProjects', JSON.stringify([]));
                if (syncConfig.url && syncConfig.key) {
                  syncService.saveMasterProjects(syncConfig, [])
                    .catch(err => console.error("Global Master Purge Sync Error:", err));
                }
                triggerLocalUpdate();
              }}
              config={masterConfig}
              verticals={masterConfig.verticals}
            />
          </div>
        );
      case AppTab.PMO:
        return (
          <PMOView 
            projects={projects}
            masterProjects={masterProjects}
            canViewVertical={canViewVertical}
            selectedFYs={selectedFYs}
            setSelectedFY={handleSelectFY}
            DEFAULT_FY={DEFAULT_FY}
            masterConfig={masterConfig}
            processorSubTab={'list'}
            processorRawData={processorRawData}
            setProcessorRawData={setProcessorRawData}
            processorFileName={processorFileName}
            setProcessorFileName={setProcessorFileName}
            processorMode={processorMode}
            setProcessorMode={setProcessorMode}
            currentMonths={currentMonths}
            setProjects={setProjects}
            triggerLocalUpdate={triggerLocalUpdate}
            isCurrentContextLocked={isCurrentContextLocked}
            employees={employees}
            isAdmin={isAdmin}
            setDeletionTarget={setDeletionTarget}
            lastUpdated={lastUpdated}
          />
        );
      case AppTab.PMO_ANALYTICS:
        return (
          <PMOView 
            projects={projects}
            masterProjects={masterProjects}
            canViewVertical={canViewVertical}
            selectedFYs={selectedFYs}
            setSelectedFY={handleSelectFY}
            DEFAULT_FY={DEFAULT_FY}
            masterConfig={masterConfig}
            activeTab={'analytics'}
            processorSubTab={'analytics'}
            processorRawData={processorRawData}
            setProcessorRawData={setProcessorRawData}
            processorFileName={processorFileName}
            setProcessorFileName={setProcessorFileName}
            processorMode={processorMode}
            setProcessorMode={setProcessorMode}
            currentMonths={currentMonths}
            setProjects={setProjects}
            triggerLocalUpdate={triggerLocalUpdate}
            isCurrentContextLocked={isCurrentContextLocked}
            employees={employees}
            isAdmin={isAdmin}
            setDeletionTarget={setDeletionTarget}
            lastUpdated={lastUpdated}
          />
        );
      case AppTab.ENTRY:
        return (
          <BudgetView 
            currentSummary={currentSummary}
            sharedFilters={sharedFilters}
            setSharedFilters={setSharedFilters}
            dynamicOptions={dynamicOptions}
            verticalOptions={verticalOptions}
            sharedActions={sharedActions}
            masterConfig={masterConfig}
            selectedFYs={selectedFYs}
            projectsInScope={projectsInScope}
            canEditVertical={canEditVertical}
            currentFYFinancials={currentFYFinancials}
            isAdmin={isAdmin}
            fiscalMode={fiscalMode}
            DEFAULT_FY={DEFAULT_FY}
            locks={locks}
            setFocusedProjectId={setFocusedProjectId}
            projects={projects}
            handleCopyProjectData={handleCopyProjectData}
            setProjects={setProjects}
            triggerLocalUpdate={triggerLocalUpdate}
            isDirtyRef={isDirtyRef}
            showEmptyActuals={showEmptyActuals}
            sortBy={budgetSortBy}
            setSortBy={setBudgetSortBy}
            sortOrder={budgetSortOrder}
            setSortOrder={setBudgetSortOrder}
            totalsLookup={totalsLookup}
          />
        );
      case AppTab.DASHBOARD:
        return (
          <DashboardView 
            currentSummary={currentSummary}
            fiscalMode={fiscalMode}
            updateContext={updateContext}
            sharedFilters={sharedFilters}
            setSharedFilters={setSharedFilters}
            dynamicOptions={dynamicOptions}
            verticalOptions={verticalOptions}
            sharedActions={sharedActions}
            projectsInScope={projectsInScope}
            prevYearProjects={prevYearProjects}
            isPrevYearLoading={isPrevYearLoading}
            selectedFYs={selectedFYs}
            currentFYFinancials={currentFYFinancials}
            masterConfig={masterConfig}
            currentUser={currentUser!}
            currentMonths={currentMonths}
          />
        );
      case AppTab.HR_RESOURCES:
        return (
          <ResourcesView 
            currentUser={currentUser!}
            isAdmin={isAdmin}
            employees={employees}
            projects={projects}
            masterConfig={masterConfig}
            handleUpdateEmployees={handleUpdateEmployees}
            setDeletionTarget={setDeletionTarget}
            hrTreeZoom={hrTreeZoom}
            setHrTreeZoom={setHrTreeZoom}
            hrTreeLayout={hrTreeLayout}
            setHrTreeLayout={setHrTreeLayout}
            hrCollapsedNodes={hrCollapsedNodes}
            setHrCollapsedNodes={setHrCollapsedNodes}
            hrViewMode={hrViewMode}
            notify={notify}
            selectedFY={selectedFY}
            syncConfig={syncConfig}
          />
        );
      case AppTab.CONFIG:
        return (
          <ConfigView 
            isAdmin={isAdmin}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            selectedFY={selectedFY as any}
            history={history}
            onlineUserIds={onlineUserIds}
            masterConfig={masterConfig}
            fiscalLocks={fiscalLocks}
            aggregatedMonthLocks={aggregatedMonthLocks}
            projects={projects}
            users={users}
            lastUpdated={lastUpdated}
            setMasterConfig={setMasterConfig}
            triggerLocalUpdate={triggerLocalUpdate}
            setUsers={setUsers}
            syncConfig={syncConfig}
            handleRestore={handleRestore}
            syncStatus={syncStatus}
            setDeletionTarget={setDeletionTarget}
            handleToggleFiscalLock={handleToggleFiscalLock}
            handleToggleMonthLock={handleToggleMonthLock}
          />
        );
      case AppTab.ABOUT:
        return <div className="w-full h-full"><AboutPage /></div>;
      case AppTab.DCBA_PORTAL:
        return <DCBAPortal isAdmin={isAdmin} masterConfig={masterConfig} selectedFY={selectedFY as any} viewMode={dcbaViewMode} setViewMode={setDcbaViewMode} notify={notify} />;
      case AppTab.SEAT_ALLOCATION:
        // Using the integrated local Seat Allocation Tool
        let baseUrl = '/seat-allocation/dashboard6.html';
        if (seatAllocationSubTab === 'allocation') baseUrl = '/seat-allocation/allocation6.html';
        else if (seatAllocationSubTab === 'master') baseUrl = '/seat-allocation/EmployeeMaster6.html';
        
        // Passing credentials to the integrated tool for auto-login
        const params = `autoLogin=true&username=Deskify&password=${encodeURIComponent('Deskify#468')}`;
        const finalUrl = `${baseUrl}?${params}`;
        
        return (
          <div className="w-full h-full animate-fadeIn p-4">
            <div className="w-full h-[calc(100vh-140px)] bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-xl">
              <iframe 
                src={finalUrl} 
                className="w-full h-full border-none" 
                title="Seat Allocation Tool" 
              />
            </div>
          </div>
        );
      default:
        return <HomeView updateContext={updateContext} />;
    }
  };

  const mainTabs = useMemo(() => {
    if (activeTab === AppTab.DCBA_PORTAL) {
      return [
        { id: 'list', label: 'List View', visible: true },
        { id: 'matrix', label: 'Matrix View', visible: true },
        { id: 'yoy', label: 'YoY View', visible: true },
        { id: 'dashboard', label: 'Dashboard', visible: true },
        { id: 'bcg', label: 'BCG View', visible: false }
      ];
    }

    if (activeTab === AppTab.SEAT_ALLOCATION) {
      return [
        { id: 'dashboard', label: 'DASHBOARD', visible: true },
        { id: 'allocation', label: 'ALLOCATION', visible: true },
        { id: 'master', label: 'EMPLOYEE MASTER', visible: true }
      ];
    }

    if (activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS) {
      return [
        { id: 'pmo_budget', label: 'BUDGET', visible: true },
        { id: 'pmo_actual', label: 'ACTUAL', visible: true },
        { id: 'pmo_analytics', label: 'ANALYTICS', visible: true }
      ];
    }

    const tabs = [
      { id: AppTab.ENTRY, label: 'PROJECT LIST', visible: true }, 
      { id: AppTab.DASHBOARD, label: 'ANALYTICS', visible: true }
    ];
    
    return tabs;
  }, [activeTab]);
  
  const utilityTabs = useMemo(() => [
    { id: AppTab.CONFIG, label: 'config', visible: isAdmin }, 
    { id: AppTab.ABOUT, label: 'about', visible: true }
  ], [isAdmin]);

  const handleSaveMasterProject = (p: MasterProject) => {
    setMasterProjects(prev => {
        const index = prev.findIndex(item => item.id === p.id);
        const next = index >= 0 ? [...prev] : [...prev, p];
        if (index >= 0) next[index] = p;
        localStorage.setItem('masterProjects', JSON.stringify(next));
        
        // Cloud Sync for Master Projects
        if (syncConfig.url && syncConfig.key) {
          syncService.saveMasterProjects(syncConfig, next)
            .catch(err => console.error("Global Master Sync Error:", err));
        }
        
        triggerLocalUpdate();
        return next;
    });
  };

  const handleApplyMasterDelete = (id: string) => {
    setMasterProjects(prev => {
        const next = prev.filter(p => p.id !== id);
        localStorage.setItem('masterProjects', JSON.stringify(next));
        
        if (syncConfig.url && syncConfig.key) {
          syncService.saveMasterProjects(syncConfig, next)
            .catch(err => console.error("Global Master Sync Error:", err));
        }

        triggerLocalUpdate();
        return next;
    });
  };

  const handleDeleteMasterProject = (id: string) => {
    const p = masterProjects.find(item => item.id === id);
    setDeletionTarget({
      type: 'master',
      id: id,
      name: p ? `${p.code}: ${p.name}` : 'Master Project'
    });
  };

  const handleLogin = async (usernameInput?: string, passwordInput?: string, rememberMeInput?: boolean) => {
    setIsLoginLoading(true);
    setLoginError(null);
    
    const uName = usernameInput !== undefined ? usernameInput : loginForm.username;
    const pWord = passwordInput !== undefined ? passwordInput : loginForm.password;
    const remMe = rememberMeInput !== undefined ? rememberMeInput : rememberMe;

    try {
      const state = await hydrateFromCloud();
      const usersList = (state?.users || users || []) as User[];
      const user = usersList.find((u: User) => (u.username || '').trim() === (uName || '').trim());
      if (!user || user.password !== pWord) {
        setLoginError("Credentials invalid.");
      } else {
        if (remMe) {
          localStorage.setItem(REMEMBER_ME_KEY, uName);
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
        setLoginForm({ username: uName, password: pWord });
        setRememberMe(remMe);
        setCurrentUser(user);
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }
    } catch (err: any) {
      setLoginError("Sync failed: Authentication protocol disrupted.");
    } finally {
      setIsLoginLoading(false);
    }
  };

  if (!currentUser) return (
    <LoginView 
      loginForm={loginForm}
      setLoginForm={setLoginForm}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      loginError={loginError}
      isLoginLoading={isLoginLoading}
      onSubmit={handleLogin}
      rememberMe={rememberMe}
      setRememberMe={setRememberMe}
    />
  );

  const getContextLabel = () => {
    if (activeTab === AppTab.PMO || activeTab === AppTab.PMO_ANALYTICS) {
      const modeText = processorMode === 'Budget' ? 'Budget' : 'Actuals';
      const subTab = (activeTab === AppTab.PMO_ANALYTICS || processorSubTab === 'analytics') ? 'Analytics' : modeText;
      return `PMO / ${subTab}`;
    }
    if (activeTab === AppTab.ENTRY || activeTab === AppTab.DASHBOARD) {
      const sub = activeTab === AppTab.ENTRY ? 'Project List' : 'Analytics';
      if (fiscalMode === 'Budget') return `Budget / ${sub}`;
      return `PMO / ${fiscalMode === 'Forecast' ? 'Budget' : fiscalMode} / ${sub}`;
    }
    if (activeTab === AppTab.CONFIG) {
      const categoryLabels: Record<string, string> = {
        verticals: 'Verticals',
        functionalTeams: 'Functional Teams',
        buDomains: 'Domains',
        businessUnits: 'Business Units',
        projectTypes: 'Project Types',
        productFamilies: 'Product Families',
        segments: 'Segments',
        paces: 'Pace Options',
        customers: 'Customer List',
        projectCategories: 'Project Categories',
        bands: 'Resource Bands',
        employeeCategories: 'Resource Categories',
        locations: 'Operating Locations',
        skillLevelsL2: 'Skills (L2)',
        finance: 'Financial Settings',
        forecast_config: 'Forecast Settings',
        benchmarks: 'LY Actuals',
        fiscal_locks: 'Fiscal Locks',
        users: 'User Management',
        history: 'Operational Log'
      };
      const label = categoryLabels[activeCategory] || activeCategory;
      return `Config / ${label}`;
    }
    if (activeTab === AppTab.MASTER_PROJECTS) return "Master Project List";
    if (activeTab === AppTab.ABOUT) return "About";
    if (activeTab === AppTab.HR_RESOURCES) return "Resources";
    if (activeTab === AppTab.SEAT_ALLOCATION) return "SEAT ALLOCATION-DESKIFY";
    if (activeTab === AppTab.DCBA_PORTAL) return "DCBA Portal";
    return "";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-['Inter']">
      <Sidebar 
        isExpanded={isSidebarExpanded} 
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} 
        activeTab={activeTab}
        updateContext={updateContext}
        isAdmin={isAdmin}
      />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar 
        activeTab={activeTab}
        isAdmin={isAdmin}
        currentUser={currentUser}
        getContextLabel={getContextLabel}
        navigate={navigate}
        updateContext={updateContext}
        focusedProjectId={focusedProjectId}
        projects={projects}
        mainTabs={mainTabs as any}
        processorSubTab={processorSubTab}
        setProcessorSubTab={setProcessorSubTab}
        dcbaViewMode={dcbaViewMode}
        setDcbaViewMode={setDcbaViewMode}
        fiscalMode={fiscalMode}
        processorMode={processorMode}
        setShowEmptyActuals={setShowEmptyActuals}
        selectedFYs={selectedFYs}
        handleSelectFY={handleSelectFY}
        ALL_FISCAL_YEARS={ALL_FISCAL_YEARS}
        DEFAULT_FY={DEFAULT_FY}
        syncStatus={syncStatus}
        syncConfig={syncConfig}
        handleLogout={handleLogout}
        hrViewMode={hrViewMode}
        setHrViewMode={setHrViewMode}
        seatAllocationSubTab={seatAllocationSubTab}
        setSeatAllocationSubTab={setSeatAllocationSubTab}
      />

      <main className="flex-grow pt-0 px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3 lg:pb-4 max-w-full mx-auto w-full overflow-y-auto no-scrollbar">
        {renderContent()}
      </main>

      <Footer />
      <NotificationToast notification={notification} onClose={() => setNotification(null)} onResolve={() => { if (syncConfig.url && syncConfig.key) hydrateFromCloud(); setNotification(null); }} />
      <AddProjectModal isOpen={isAddProjectModalOpen} onClose={() => setIsAddProjectModalOpen(false)} onConfirm={handleAddProject} config={masterConfig} allowedVerticals={(masterConfig.verticals || []).filter(v => canViewVertical(v))} months={currentMonths} />
      <DeletionConfirmationModal target={deletionTarget} onClose={() => setDeletionTarget(null)} onConfirm={confirmDeletion} />
      
      {syncStatus === 'syncing' && !isInitializedRef.current && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center animate-fadeIn">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Synchronizing Context Registry...</p>
        </div>
      )}

      <ImportInspectionModal 
        isOpen={isImportInspectionOpen} 
        data={pendingImportData} 
        onClose={() => { setIsImportInspectionOpen(false); setPendingImportData(null); }} 
        onConfirm={finalizeImport} 
        fiscalMode={importTargetMode}
      />
      </div>
    </div>
  );
};
