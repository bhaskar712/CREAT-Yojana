
export const RATE_PER_HOUR = 1650;
export const CONTRACTED_EMPLOYEE_RATE = 1150;
export const HOURS_PER_MONTH = 180;
export const getStorageKey = (fy: string, mode: string = 'Budget') => `${fy.replace(/\s+/g, '').toLowerCase()}-${mode.toLowerCase()}-v1`;
export const MAX_MONTHS = 144;
export const PMO_BUDGET_CATEGORY = 'PMO_BUDGET';

export const ALL_FISCAL_YEARS = [
  'All FY', 'FY 19-20', 'FY 20-21', 'FY 21-22', 'FY 22-23', 'FY 23-24', 'FY 24-25', 'FY 25-26', 
  'FY 26-27', 'FY 27-28', 'FY 28-29', 'FY 29-30', 'FY 30-31'
];
export const DEFAULT_FY = 'FY 26-27';

export const isConfirmedProject = (p: { tbc?: string } | undefined | null): boolean => {
  if (!p) return false;
  const val = String(p.tbc || 'Yes').trim().toLowerCase();
  return val === 'yes';
};

export const SKILL_MAPPING: Record<string, string> = {
  'HW_CoC': 'Hardware_CoC',
  'HW CoC': 'Hardware_CoC',
  'HW': 'Hardware_CoC',
  'Mech_CoC': 'Mechanical_CoC',
  'Mech CoC': 'Mechanical_CoC',
  'Mech': 'Mechanical_CoC',
  'MCAD': 'Mechanical_CoC',
  'Mechanical CoC': 'Mechanical_CoC',
  'Hardware CoC': 'Hardware_CoC',
  'Validation Vertical': 'Validation_Vertical',
  'Mechanical Vertical': 'Mechanical_Vertical',
  'Validation CoC': 'Validation_CoC',
  'Software Vertical': 'Software_Vertical',
  'Hardware Vertical': 'Hardware_Vertical',
  'Software - IVI': 'Software_Vertical',
  'Validation': 'Validation_Vertical',
  'Mechanical': 'Mechanical_CoC',
  'Hardware': 'Hardware_CoC',
  'Software': 'Software_CoC',
  'SW': 'Software_CoC',
  'Software_Coc': 'Software_CoC',
  'Product Planning (MM)': 'Product Planning',
  'Product Planning - R&D': 'Product Planning',
  'Product Planning R&D': 'Product Planning',
  'Product Planning, Management & Tech Sales': 'Product Planning',
  'Product Management': 'Product Manager',
  'Tech Sales (MM)': 'Tech Sales',
  'Operational Expenses (Cr)': 'Operational Expenses (Cr)',
  'Operational Expenses': 'Operational Expenses (Cr)',
  'Operational Expense': 'Operational Expenses (Cr)',
  'Opex': 'Operational Expenses (Cr)',
  'Software - CoC': 'Software_CoC',
  'Software CoC': 'Software_CoC',
  'Validation - Vertical': 'Validation_Vertical',
  'Mechanical - CoC': 'Mechanical_CoC',
  'Hardware - CoC': 'Hardware_CoC',
  'Mechanical - Vertical': 'Mechanical_Vertical',
  'Hardware - Vertical': 'Hardware_Vertical',
  'Validation - CoC': 'Validation_CoC',
  'Software - Vertical': 'Software_Vertical',
  'Application Engineering': 'Application Engg',
  'Application Eng': 'Application Engg',
  'Proto Engineering': 'Proto Engineer',
  'Hardware_vertical': 'Hardware_Vertical',
  'Hardware_Vertical': 'Hardware_Vertical',
  'HW_Vertical': 'Hardware_Vertical',
  'Software CS & FuSA': 'Software CS & FuSA',
  'NPC': 'NPC',
  'Lab Engineer': 'Lab Engineer',
  'Material Science': 'Material Science',
  'Contracted Employee (MM)': 'Contracted Employee',
  'Contracted Employee': 'Contracted Employee'
};

export const normalizeSkill = (raw: string | undefined | null): string => {
  if (!raw) return 'Unspecified Skill';
  const trimmed = String(raw).trim();
  if (SKILL_MAPPING[trimmed]) return SKILL_MAPPING[trimmed];

  const lower = trimmed.toLowerCase();
  const cleanLower = lower.replace(/[\s_-]/g, '');

  for (const [k, v] of Object.entries(SKILL_MAPPING)) {
    if (k.toLowerCase() === lower || k.toLowerCase().replace(/[\s_-]/g, '') === cleanLower) {
      return v;
    }
  }

  for (const cat of [...MANPOWER_CATEGORIES, ...SKILL_ORDER]) {
    if (cat.toLowerCase() === lower || cat.toLowerCase().replace(/[\s_-]/g, '') === cleanLower) {
      return cat;
    }
  }

  return trimmed;
};

export const normalizeVertical = (raw: string | undefined | null): string => {
  if (!raw) return 'Unspecified';
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  const clean = lower.replace(/[\s_-]/g, '');
  if (clean === 'ecs1' || lower === 'ecs 1') return 'ECS-1';
  if (clean === 'ecs2' || lower === 'ecs 2') return 'ECS-2';
  if (clean === 'coc') return 'CoC';
  if (clean === 'atg') return 'ATG';
  if (clean === 'las') return 'LAS';
  if (clean === 'initia') return 'INITIA';
  if (clean === 'scs') return 'SCS';
  return trimmed;
};

export const normalizeDepartment = (raw: string | undefined | null): string => {
  if (!raw) return 'Unspecified';
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  const clean = lower.replace(/[\s_-]/g, '');
  if (clean === 'ecs1' || lower === 'ecs 1') return 'ECS-1';
  if (clean === 'ecs2' || lower === 'ecs 2') return 'ECS-2';
  if (clean === 'hwcoc' || lower === 'hw coc' || lower === 'hw') return 'HW_CoC';
  if (clean === 'swcoc' || lower === 'sw coc' || lower === 'sw') return 'SW_CoC';
  if (clean === 'mechcoc' || lower === 'mech coc' || lower === 'mech') return 'Mech_CoC';
  if (clean === 'atg') return 'ATG';
  if (clean === 'las') return 'LAS';
  if (clean === 'initia') return 'INITIA';
  if (clean === 'scs') return 'SCS';
  return trimmed;
};


export const isSummaryOrCalculatedLabel = (rawLabel: string | undefined | null): boolean => {
  if (!rawLabel) return false;
  const l = String(rawLabel).toLowerCase().trim();
  const normL = l.replace(/[\s_\-()[\]]/g, '');
  if (l === 'contracted employee' || l === 'contracted employee expense') return false;
  return (
    l.includes('total') ||
    l.includes('subtotal') ||
    l.includes('sub-total') ||
    l.includes('direct employee cost') ||
    normL.includes('directemployeecost') ||
    l.includes('people cost') ||
    normL.includes('peoplecost') ||
    l.includes('operational expense') ||
    normL.includes('operationalexpense') ||
    l.includes('contracted manpower') ||
    normL.includes('contractedmanpower') ||
    l.includes('direct manpower') ||
    normL.includes('directmanpower') ||
    l.includes('budget (cr') ||
    l.includes('budget(cr') ||
    normL === 'aggtotal' ||
    normL === 'average' ||
    normL === 'remarks' ||
    normL === 'rowremarks' ||
    l.includes('[a]') || l.includes('[b]') || l.includes('[c]') || l.includes('[d]') || l.includes('[e]')
  );
};

export const repairProjectSkills = (projects: any[], employees: any[]): any[] => {
  if (!projects || !Array.isArray(projects) || !employees || employees.length === 0) return projects;

  return projects.map(project => {
    let modified = false;
    const newEmployeeInfo = { ...(project.employeeInfo || {}) };
    const newEmployeeSkills = JSON.parse(JSON.stringify(project.employeeSkills || {}));
    const newActualsSkills = JSON.parse(JSON.stringify(project.actualsEmployeeSkills || {}));
    const newForecastSkills = JSON.parse(JSON.stringify(project.forecastEmployeeSkills || {}));

    Object.entries(newEmployeeInfo).forEach(([email, info]: [string, any]) => {
      if (info && (!info.skill || info.skill === 'Unspecified Skill' || info.skill === 'NA')) {
        const emp = employees.find((e: any) => 
          (e.email && e.email.trim().toLowerCase() === email.toLowerCase()) ||
          (e.name && info.name && e.name.trim().toLowerCase() === info.name.trim().toLowerCase())
        );
        if (emp && emp.skill && emp.skill !== 'Unspecified Skill' && emp.skill !== 'NA') {
          const normalized = normalizeSkill(emp.skill);
          if (normalized && normalized !== 'Unspecified Skill') {
            newEmployeeInfo[email] = {
              ...info,
              skill: normalized,
              skillLevel2: emp.skillLevel2 || info.skillLevel2 || ''
            };
            modified = true;

            ['employeeSkills', 'actualsEmployeeSkills', 'forecastEmployeeSkills'].forEach(key => {
              const skillsObj = (project as any)[key];
              if (skillsObj) {
                ['Unspecified Skill', 'Unspecified_Skill', 'NA', ''].forEach(badSkill => {
                  if (skillsObj[badSkill] && skillsObj[badSkill][email]) {
                    if (!skillsObj[normalized]) skillsObj[normalized] = {};
                    if (!skillsObj[normalized][email]) skillsObj[normalized][email] = new Array(144).fill(0);
                    for (let i = 0; i < 144; i++) {
                      skillsObj[normalized][email][i] += (skillsObj[badSkill][email][i] || 0);
                    }
                    delete skillsObj[badSkill][email];
                    if (Object.keys(skillsObj[badSkill]).length === 0) {
                      delete skillsObj[badSkill];
                    }
                    modified = true;
                  }
                });
              }
            });
          }
        }
      }
    });

    if (modified) {
      return {
        ...project,
        employeeInfo: newEmployeeInfo,
        employeeSkills: newEmployeeSkills,
        actualsEmployeeSkills: newActualsSkills,
        forecastEmployeeSkills: newForecastSkills
      };
    }
    return project;
  });
};

export const SKILL_ORDER = [
  'CoreSkills',
  'Product Manager',
  'PDTL',
  'Systems',
  'Product Planning',
  'Tech Sales',
  'Costing Cell',
  'NPC',
  'Hardware_CoC',
  'Hardware_Vertical',
  'ECAD',
  'Component Engineer',
  'Lab Engineer',
  'Mechanical_CoC',
  'Mechanical_Vertical',
  'Material Science',
  'CAE',
  'Optics',
  'Software_CoC',
  'Software CS & FuSA',
  'Software_Vertical',
  'INITIA',
  'Proto Engineer',
  'Application Engg',
  'Validation_CoC',
  'Validation_Vertical',
  'Manufacturing Engineering',
  'Quality',
  'Unspecified Skill'
];

export const EXPENSE_MAPPING: Record<string, string> = {
  'Travel': 'Travel',
  'Material': 'Material',
  'Consultant': 'Consultant',
  'Consultant ': 'Consultant',
  'Consultant Expense': 'Consultant',
  'Consultancy': 'Consultant',
  'HR': 'HR',
  'Admin': 'Admin',
  'Labs': 'Labs',
  'License': 'License',
  'Others': 'Others',
  'Other': 'Others',
  'Operational Expenses (Cr)': 'Operational Expenses (Cr)',
  'Operational Expenses': 'Operational Expenses (Cr)',
  'Operational Expense': 'Operational Expenses (Cr)',
  'Opex': 'Operational Expenses (Cr)',
};

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
] as const;

export const IG_LEVELS = ["TBD", "NA", "IG 0", "IG 1", "IG 2", "IG 3", "IG 4", "IG 5", "IG 6", "IG 7", "IG 8", "IG 9"];

export const GATE_COLORS: Record<string, string> = {
  "TBD": "bg-slate-400",
  "NA": "bg-slate-200",
  "IG 0": "bg-blue-400",
  "IG 1": "bg-blue-500",
  "IG 2": "bg-indigo-400",
  "IG 3": "bg-indigo-500",
  "IG 4": "bg-violet-400",
  "IG 5": "bg-violet-500",
  "IG 6": "bg-purple-400",
  "IG 7": "bg-purple-500",
  "IG 8": "bg-fuchsia-400",
  "IG 9": "bg-fuchsia-500"
};

export const EXPENSE_CATEGORIES = [
  "Travel", "Material", "Labs", "License", "Consultant", "HR", "Admin", "Others", "Contracted Employee", "Contracted Employee Expense", "Operational Expenses (Cr)"
] as const;

export const MANPOWER_LIST = [
  "product manager", "pdtl", "systems", "product planning", "tech sales", "costing cell", "npc",
  "hardware_coc", "hardware_vertical", "ecad", "component engineer", "lab engineer",
  "mechanical_coc", "mechanical_vertical", "material science", "cae", "optics",
  "software_coc", "software cs & fusa", "software_vertical", "initia",
  "proto engineer", "application engg", "validation_coc", "validation_vertical",
  "manufacturing engineering", "quality", "unspecified skill"
];

export const EXPENSE_LIST = [
  "travel", "material", "labs", "license", "consultant", "consultancy", "hr", "admin", "others", "other",
  "opex", "operational expenses", "operational expense", "operational expenses (cr)", "contracted employee expense"
];

export type CategoryKind = 'DIRECT_MANPOWER' | 'CONTRACTED_MANPOWER' | 'EXPENSE' | 'UNKNOWN_MANPOWER';

export function classifyCategory(rawCat: string | undefined | null): CategoryKind {
  if (!rawCat) return 'UNKNOWN_MANPOWER';
  const normCat = String(rawCat).trim().toLowerCase();

  if (normCat === 'contracted employee') return 'CONTRACTED_MANPOWER';
  if (normCat === 'contracted employee expense') return 'EXPENSE';

  const cleanNorm = normCat.replace(/[\s_-]/g, '');
  if (
    MANPOWER_LIST.includes(normCat) ||
    MANPOWER_LIST.some(m => m.replace(/[\s_-]/g, '') === cleanNorm)
  ) {
    return 'DIRECT_MANPOWER';
  }

  if (
    EXPENSE_LIST.includes(normCat) ||
    normCat.includes('expense') ||
    EXPENSE_LIST.some(e => e.replace(/[\s_-]/g, '') === cleanNorm)
  ) {
    return 'EXPENSE';
  }

  return 'UNKNOWN_MANPOWER';
}

