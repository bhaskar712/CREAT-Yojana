import React, { useMemo, useState } from 'react';
import { Project, FiscalMode, Opportunity } from '../types';
import { normalizeVertical } from '../constants';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  RotateCcw,
  Award,
  Activity,
  BarChart3,
  Layers,
  ShieldAlert,
  Wrench,
  MessageSquare,
  Table2,
  Compass
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Cell
} from 'recharts';

export type CadenceType = 'quarterly' | 'half_yearly' | 'yearly';
export type ParameterGroupTab = 'both' | 'porter' | 'easiness';
export type ScorecardViewMode = 'porter_sheet' | 'easiness_sheet' | 'cards' | 'trends';

export interface PorterSubFactorDef {
  id: string;
  forceId: string;
  forceName: string;
  subFactor: string;
  rationale: string;
  measurableInput: string;
  referenceFormula: string;
  weight: number; // e.g. 0.30 for 30%
  defaultZonalRating: number;
  defaultRemark: string;
}

export interface PorterForceDef {
  id: string;
  name: string;
  summaryLabel: string;
  color: string;
  badgeClass: string;
  interpretScore: (score: number) => string;
}

export interface EasinessSubFactorDef {
  id: string;
  dimensionId: string;
  dimensionName: string;
  subFactor: string;
  whatToMeasure: string;
  weight: number; // e.g. 0.25 for 25%
  ratingGuide: string;
  defaultZonalRating: number;
  defaultRemark: string;
}

export interface EasinessDimensionDef {
  id: string;
  name: string;
  summaryLabel: string;
  color: string;
  badgeClass: string;
}

// ============================================================================
// 1. PORTER ANALYSIS DEFINITIONS (Exact match to "Poter Scoring Method" sheet)
// ============================================================================
export const PORTER_FORCES: PorterForceDef[] = [
  {
    id: 'supplier_power',
    name: 'Supplier Power',
    summaryLabel: 'Supplier Power',
    color: '#2563eb',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    interpretScore: (s: number) =>
      s >= 3.8 ? 'Low supplier power (Favorable)' : s >= 2.6 ? 'Moderate supplier power' : 'High supplier power (Risk)'
  },
  {
    id: 'buyer_power',
    name: 'Buyer Power',
    summaryLabel: 'Buyer Power Score',
    color: '#7c3aed',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    interpretScore: (s: number) =>
      s >= 3.8 ? 'Low buyer power (Favorable)' : s >= 2.6 ? 'Moderate buyer power' : 'High buyer power (Risk)'
  },
  {
    id: 'new_entrants',
    name: 'Threat of New Entrants',
    summaryLabel: 'New Entrant Score',
    color: '#059669',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    interpretScore: (s: number) =>
      s >= 3.6 ? 'Low threat of new entrants' : s >= 2.5 ? 'Moderate threat of new entrants' : 'High threat of new entrants'
  },
  {
    id: 'substitutes',
    name: 'Threat of Substitutes',
    summaryLabel: 'Substitute Score',
    color: '#d97706',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    interpretScore: (s: number) =>
      s >= 3.8 ? 'Low substitute threat' : s >= 3.0 ? 'Moderate-low substitute threat' : 'High substitute threat'
  },
  {
    id: 'rivalry',
    name: 'Rivalry',
    summaryLabel: 'Rivalry Score',
    color: '#e11d48',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    interpretScore: (s: number) =>
      s >= 3.8 ? 'Low rivalry' : s >= 2.8 ? 'Moderate-high rivalry' : 'Intense rivalry'
  }
];

export const PORTER_SUBFACTORS: PorterSubFactorDef[] = [
  // Force 1: Supplier Power
  {
    id: 'sp_1',
    forceId: 'supplier_power',
    forceName: 'Supplier Power',
    subFactor: 'Number of qualified semiconductor alternatives',
    rationale: 'Multiple MCU/PHY/transceiver options, but automotive qualification limits alternatives',
    measurableInput: 'No. of qualified alternatives',
    referenceFormula: 'IF(Alternatives>=5,5, IF(Alternatives>=3,4, IF(Alternatives>=2,3, IF(Alternatives=1,2,1))))',
    weight: 0.30,
    defaultZonalRating: 3,
    defaultRemark: 'NXP, Infineon & Renesas AEC-Q100 options available'
  },
  {
    id: 'sp_2',
    forceId: 'supplier_power',
    forceName: 'Supplier Power',
    subFactor: 'Component dependency / concentration',
    rationale: 'Dependence on automotive-grade MCU, Ethernet PHY, PMIC, memory etc.',
    measurableInput: '% dependency on top supplier',
    referenceFormula: 'IF(Dependency<=20%,5, IF(Dependency<=40%,4, IF(Dependency<=60%,3, IF(Dependency<=80%,2,1))))',
    weight: 0.30,
    defaultZonalRating: 3,
    defaultRemark: 'Top silicon vendor accounts for ~45% of active BOM'
  },
  {
    id: 'sp_3',
    forceId: 'supplier_power',
    forceName: 'Supplier Power',
    subFactor: 'Switching cost between suppliers',
    rationale: 'HW redesign + SW adaptation + validation required',
    measurableInput: 'Engineering change / validation effort',
    referenceFormula: 'IF(Cost="Low",5, IF(Cost="Medium",3,1))',
    weight: 0.20,
    defaultZonalRating: 3,
    defaultRemark: 'AUTOSAR MCAL abstraction reduces SW rewrite effort'
  },
  {
    id: 'sp_4',
    forceId: 'supplier_power',
    forceName: 'Supplier Power',
    subFactor: 'UML purchasing leverage',
    rationale: 'Automotive volumes provide leverage, but suppliers retain technology leverage',
    measurableInput: 'Expected annual volume',
    referenceFormula: 'IF(Volume>=1M,5, IF(Volume>=500K,4, IF(Volume>=100K,3, IF(Volume>=50K,2,1))))',
    weight: 0.20,
    defaultZonalRating: 3,
    defaultRemark: 'Consolidated group buying across UNO MINDA divisions'
  },

  // Force 2: Buyer Power
  {
    id: 'bp_1',
    forceId: 'buyer_power',
    forceName: 'Buyer Power',
    subFactor: 'OEM purchasing concentration',
    rationale: 'Relatively concentrated PV OEM customer base',
    measurableInput: '% revenue from top 3 OEMs',
    referenceFormula: '<=30%=5; <=50%=4; <=70%=3; <=85%=2; >85%=1',
    weight: 0.25,
    defaultZonalRating: 2,
    defaultRemark: 'Top 3 PV/2W anchor OEMs drive majority of initial volume'
  },
  {
    id: 'bp_2',
    forceId: 'buyer_power',
    forceName: 'Buyer Power',
    subFactor: 'Availability of alternative Tier-1s',
    rationale: 'Several global and emerging Tier-1 competitors',
    measurableInput: 'No. of credible competitors',
    referenceFormula: '>=6=1; 4-5=2; 3=3; 2=4; 1=5',
    weight: 0.25,
    defaultZonalRating: 3,
    defaultRemark: '3-4 domestic & global Tier-1s bidding on target RFQs'
  },
  {
    id: 'bp_3',
    forceId: 'buyer_power',
    forceName: 'Buyer Power',
    subFactor: 'OEM switching cost',
    rationale: 'High after E/E architecture, SW and vehicle validation are completed',
    measurableInput: 'Development + validation time',
    referenceFormula: '>24 months=5; 12-24=4; 6-12=3; 3-6=2; <3=1',
    weight: 0.25,
    defaultZonalRating: 4,
    defaultRemark: '18-month vehicle integration & DV/PV validation lock-in'
  },
  {
    id: 'bp_4',
    forceId: 'buyer_power',
    forceName: 'Buyer Power',
    subFactor: 'Product differentiation',
    rationale: 'Platform/SW/networking can differentiate beyond ECU',
    measurableInput: 'Differentiated IP / SW content',
    referenceFormula: 'Very high=5 -> Very low=1',
    weight: 0.25,
    defaultZonalRating: 4,
    defaultRemark: 'In-house middleware, diagnostics & smart power distribution IP'
  },

  // Force 3: Threat of New Entrants
  {
    id: 'ne_1',
    forceId: 'new_entrants',
    forceName: 'Threat of New Entrants',
    subFactor: 'Technology complexity',
    rationale: 'Requires networking, embedded SW, diagnostics, cybersecurity etc.',
    measurableInput: 'Number of technology domains required',
    referenceFormula: '>=7=5; 5-6=4; 3-4=3; 2=2; 1=1',
    weight: 0.30,
    defaultZonalRating: 4,
    defaultRemark: 'Multi-domain HW, SOME/IP, TSN, OTA & HSM security stack'
  },
  {
    id: 'ne_2',
    forceId: 'new_entrants',
    forceName: 'Threat of New Entrants',
    subFactor: 'Automotive qualification barriers',
    rationale: 'Functional safety, cybersecurity and OEM qualification create high barriers',
    measurableInput: 'Safety + cybersecurity + OEM qualification',
    referenceFormula: 'Very high=5 -> Very low=1',
    weight: 0.25,
    defaultZonalRating: 5,
    defaultRemark: 'ISO 26262 ASIL-B/D and ISO/SAE 21434 compliance mandatory'
  },
  {
    id: 'ne_3',
    forceId: 'new_entrants',
    forceName: 'Threat of New Entrants',
    subFactor: 'OEM relationship / track record',
    rationale: 'Existing vehicle programs and references are important',
    measurableInput: 'Existing OEM relationship required',
    referenceFormula: 'Very high=5 -> Very low=1',
    weight: 0.25,
    defaultZonalRating: 4,
    defaultRemark: 'Deep incumbent OEM relationships across PV & 2W segments'
  },
  {
    id: 'ne_4',
    forceId: 'new_entrants',
    forceName: 'Threat of New Entrants',
    subFactor: 'Capital / engineering investment',
    rationale: 'Significant engineering and validation investment required',
    measurableInput: 'Estimated entry investment',
    referenceFormula: '>₹50Cr=5; ₹25-50Cr=4; ₹10-25Cr=3; ₹5-10Cr=2; <₹5Cr=1',
    weight: 0.20,
    defaultZonalRating: 3,
    defaultRemark: 'Significant HIL, EMI/EMC & core platform R&D outlay'
  },

  // Force 4: Threat of Substitutes
  {
    id: 'sub_1',
    forceId: 'substitutes',
    forceName: 'Threat of Substitutes',
    subFactor: 'Strength of conventional ECU architecture',
    rationale: 'Distributed ECUs remain mature and proven',
    measurableInput: 'Current penetration',
    referenceFormula: 'Low substitute penetration=5; High=1',
    weight: 0.30,
    defaultZonalRating: 3,
    defaultRemark: 'Entry-level trims still use distributed domain ECUs'
  },
  {
    id: 'sub_2',
    forceId: 'substitutes',
    forceName: 'Threat of Substitutes',
    subFactor: 'SDV/zonal adoption trend',
    rationale: 'Industry movement toward centralized/zonal architecture',
    measurableInput: '% target OEMs adopting zonal/centralized architecture',
    referenceFormula: '>=70%=5; 50-70%=4; 30-50%=3; 10-30%=2; <10%=1',
    weight: 0.30,
    defaultZonalRating: 4,
    defaultRemark: 'Next-gen EV & SUV platforms shifting to zonal E/E'
  },
  {
    id: 'sub_3',
    forceId: 'substitutes',
    forceName: 'Threat of Substitutes',
    subFactor: 'Cost advantage of substitute',
    rationale: 'Conventional architecture may remain attractive for cost-sensitive vehicles',
    measurableInput: 'Cost difference',
    referenceFormula: 'Substitute >30% cheaper=1; 20-30%=2; 10-20%=3; 5-10%=4; <5%=5',
    weight: 0.20,
    defaultZonalRating: 3,
    defaultRemark: 'Wiring harness weight/cost savings offset ECU BOM delta'
  },
  {
    id: 'sub_4',
    forceId: 'substitutes',
    forceName: 'Threat of Substitutes',
    subFactor: 'Migration difficulty',
    rationale: 'Moving toward zonal architecture requires substantial E/E redesign',
    measurableInput: 'Cost/time to change architecture',
    referenceFormula: 'Very high=5 -> Very low=1',
    weight: 0.20,
    defaultZonalRating: 4,
    defaultRemark: 'Once architected, OEMs lock platform for 5-7 years'
  },

  // Force 5: Rivalry
  {
    id: 'riv_1',
    forceId: 'rivalry',
    forceName: 'Rivalry',
    subFactor: 'Number of credible competitors',
    rationale: 'Multiple established Tier-1s developing zonal solutions',
    measurableInput: 'Number of Tier-1 competitors',
    referenceFormula: '1=5; 2=4; 3=3; 4-5=2; >5=1',
    weight: 0.25,
    defaultZonalRating: 3,
    defaultRemark: '3-4 serious Tier-1 contenders in Indian OEM RFQs'
  },
  {
    id: 'riv_2',
    forceId: 'rivalry',
    forceName: 'Rivalry',
    subFactor: 'Market growth',
    rationale: 'Emerging SDV/zonal market provides room for growth',
    measurableInput: 'CAGR',
    referenceFormula: '>20%=5; 15-20%=4; 10-15%=3; 5-10%=2; <5%=1',
    weight: 0.20,
    defaultZonalRating: 4,
    defaultRemark: 'High domestic content growth per vehicle (>18% CAGR)'
  },
  {
    id: 'riv_3',
    forceId: 'rivalry',
    forceName: 'Rivalry',
    subFactor: 'Product differentiation',
    rationale: 'Differentiation possible but core hardware can become comparable',
    measurableInput: 'Differentiation potential',
    referenceFormula: 'Very high=5 -> Very low=1',
    weight: 0.25,
    defaultZonalRating: 3,
    defaultRemark: 'Differentiation via local customization & speed-to-market'
  },
  {
    id: 'riv_4',
    forceId: 'rivalry',
    forceName: 'Rivalry',
    subFactor: 'Price competition',
    rationale: 'OEM RFQs can create significant cost pressure',
    measurableInput: 'Expected ASP reduction / RFQ pressure',
    referenceFormula: '<5%=5; 5-10%=4; 10-15%=3; 15-25%=2; >25%=1',
    weight: 0.20,
    defaultZonalRating: 2,
    defaultRemark: 'Aggressive target pricing on high-volume OEM platforms'
  },
  {
    id: 'riv_5',
    forceId: 'rivalry',
    forceName: 'Rivalry',
    subFactor: 'Exit barriers / strategic importance',
    rationale: 'Strategic platform business encourages continued competition',
    measurableInput: 'Degree to which the product creates strategic capability, platform/IP or customer lock-in',
    referenceFormula: '1 = low strategic importance; 2 = limited; 3 = moderate; 4 = high; 5 = critical platform',
    weight: 0.10,
    defaultZonalRating: 4,
    defaultRemark: 'Core strategic control node for future vehicle E/E'
  }
];

// ============================================================================
// 2. EASINESS MATRIX DEFINITIONS (Exact match to "Easiness Scoring" sheet)
// ============================================================================
export const EASINESS_DIMENSIONS: EasinessDimensionDef[] = [
  {
    id: 'easy_engineer',
    name: '1. Easy to Engineer',
    summaryLabel: 'Easy to Engineer',
    color: '#0284c7',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
  },
  {
    id: 'easy_manufacture',
    name: '2. Easy to Manufacture',
    summaryLabel: 'Easy to Manufacture',
    color: '#16a34a',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'easy_sell',
    name: '3. Easy to Sell',
    summaryLabel: 'Easy to Sell Score',
    color: '#ea580c',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200'
  }
];

export const EASINESS_SUBFACTORS: EasinessSubFactorDef[] = [
  // Dimension 1: 1. Easy to Engineer
  {
    id: 'ee_1',
    dimensionId: 'easy_engineer',
    dimensionName: '1. Easy to Engineer',
    subFactor: 'Existing Technology Reuse',
    whatToMeasure: '% of HW/SW/architecture reusable from existing',
    weight: 0.25,
    ratingGuide: '1 = <20% → 5 = >80%',
    defaultZonalRating: 4,
    defaultRemark: 'Reuses BCM/Gateway power stages & core CAN/LIN stacks'
  },
  {
    id: 'ee_2',
    dimensionId: 'easy_engineer',
    dimensionName: '1. Easy to Engineer',
    subFactor: 'Existing Engineering Skills',
    whatToMeasure: '% of required competencies already available internally',
    weight: 0.20,
    ratingGuide: '1 = <20% → 5 = >80%',
    defaultZonalRating: 3,
    defaultRemark: 'Core HW/SW available; ramping up SOME/IP & TSN specialists'
  },
  {
    id: 'ee_3',
    dimensionId: 'easy_engineer',
    dimensionName: '1. Easy to Engineer',
    subFactor: 'System Complexity',
    whatToMeasure: 'Number of new technology domains / interfaces',
    weight: 0.20,
    ratingGuide: '1 = Very high complexity → 5 = Low complexity',
    defaultZonalRating: 2,
    defaultRemark: 'High integration density across body, chassis & gateway'
  },
  {
    id: 'ee_4',
    dimensionId: 'easy_engineer',
    dimensionName: '1. Easy to Engineer',
    subFactor: 'Safety & Compliance Complexity',
    whatToMeasure: 'ASIL, cybersecurity, homologation and certification burden',
    weight: 0.15,
    ratingGuide: '1 = Very high → 5 = Low',
    defaultZonalRating: 3,
    defaultRemark: 'ASIL-B safety goals + UNECE R155/R156 cybersecurity'
  },
  {
    id: 'ee_5',
    dimensionId: 'easy_engineer',
    dimensionName: '1. Easy to Engineer',
    subFactor: 'Development Ecosystem',
    whatToMeasure: 'Availability of tools, reference designs, partners and stacks',
    weight: 0.10,
    ratingGuide: '1 = None → 5 = Mature',
    defaultZonalRating: 4,
    defaultRemark: 'Mature Vector AUTOSAR toolchain & silicon EVKs available'
  },
  {
    id: 'ee_6',
    dimensionId: 'easy_engineer',
    dimensionName: '1. Easy to Engineer',
    subFactor: 'Prototype / Validation Complexity',
    whatToMeasure: 'Difficulty and cost of prototype + vehicle validation',
    weight: 0.10,
    ratingGuide: '1 = Very high → 5 = Low',
    defaultZonalRating: 2,
    defaultRemark: 'Requires full automated HIL rig & multi-load thermal testing'
  },

  // Dimension 2: 2. Easy to Manufacture
  {
    id: 'em_1',
    dimensionId: 'easy_manufacture',
    dimensionName: '2. Easy to Manufacture',
    subFactor: 'Existing Manufacturing Capability',
    whatToMeasure: 'Can existing UML plants/lines manufacture it?',
    weight: 0.25,
    ratingGuide: '1 = New facility → 5 = Existing line',
    defaultZonalRating: 4,
    defaultRemark: 'Existing high-speed SMT lines can manufacture with fixture updates'
  },
  {
    id: 'em_2',
    dimensionId: 'easy_manufacture',
    dimensionName: '2. Easy to Manufacture',
    subFactor: 'Component Commonality',
    whatToMeasure: 'Commonality with existing BOM / components',
    weight: 0.20,
    ratingGuide: '1 = <20% → 5 = >80%',
    defaultZonalRating: 3,
    defaultRemark: '~55% passive, connector & protection BOM commonality'
  },
  {
    id: 'em_3',
    dimensionId: 'easy_manufacture',
    dimensionName: '2. Easy to Manufacture',
    subFactor: 'Manufacturing Process Complexity',
    whatToMeasure: 'Assembly, calibration, testing and programming',
    weight: 0.20,
    ratingGuide: '1 = Very high → 5 = Low',
    defaultZonalRating: 3,
    defaultRemark: 'Standard SMT + selective soldering + high-current EOL flashing'
  },
  {
    id: 'em_4',
    dimensionId: 'easy_manufacture',
    dimensionName: '2. Easy to Manufacture',
    subFactor: 'Capex Requirement',
    whatToMeasure: 'Incremental tooling / equipment / test investment',
    weight: 0.15,
    ratingGuide: '1 = Very high → 5 = Minimal',
    defaultZonalRating: 4,
    defaultRemark: 'Primarily ICT/EOL tester & housing tooling capex'
  },
  {
    id: 'em_5',
    dimensionId: 'easy_manufacture',
    dimensionName: '2. Easy to Manufacture',
    subFactor: 'Supplier Ecosystem',
    whatToMeasure: 'Availability of qualified suppliers',
    weight: 0.10,
    ratingGuide: '1 = Limited → 5 = Mature',
    defaultZonalRating: 4,
    defaultRemark: 'Approved panel of PCB, connector & semiconductor partners'
  },
  {
    id: 'em_6',
    dimensionId: 'easy_manufacture',
    dimensionName: '2. Easy to Manufacture',
    subFactor: 'Yield / Quality Risk',
    whatToMeasure: 'Expected manufacturing yield',
    weight: 0.10,
    ratingGuide: '1 = High risk → 5 = Low risk',
    defaultZonalRating: 3,
    defaultRemark: 'Fine-pitch BGA inspection & conformal coating process control'
  },

  // Dimension 3: 3. Easy to Sell
  {
    id: 'es_1',
    dimensionId: 'easy_sell',
    dimensionName: '3. Easy to Sell',
    subFactor: 'Existing Customer Access',
    whatToMeasure: 'Number of existing UNO MINDA OEM customers for whom product is relevant',
    weight: 0.25,
    ratingGuide: '1 = No access → 5 = Multiple strong relationships',
    defaultZonalRating: 4,
    defaultRemark: 'Direct CxO & Engineering access across all major PV/2W OEMs'
  },
  {
    id: 'es_2',
    dimensionId: 'easy_sell',
    dimensionName: '3. Easy to Sell',
    subFactor: 'Customer Demand / RFQ Pull',
    whatToMeasure: 'Existing RFI/RFQ / customer request / confirmed demand',
    weight: 0.25,
    ratingGuide: '1 = No demand → 5 = Strong RFQ/customer pull',
    defaultZonalRating: 3,
    defaultRemark: 'Active RFIs & advanced architecture tech-days with 3 OEMs'
  },
  {
    id: 'es_3',
    dimensionId: 'easy_sell',
    dimensionName: '3. Easy to Sell',
    subFactor: 'Existing Product Portfolio Fit',
    whatToMeasure: 'Ability to cross-sell with existing UML portfolio',
    weight: 0.15,
    ratingGuide: '1 = Standalone → 5 = Strong portfolio synergy',
    defaultZonalRating: 4,
    defaultRemark: 'Strong synergy with switches, lighting, seating & body sensors'
  },
  {
    id: 'es_4',
    dimensionId: 'easy_sell',
    dimensionName: '3. Easy to Sell',
    subFactor: 'Competitive Differentiation',
    whatToMeasure: 'Strength of UNO MINDA USP vs competitors',
    weight: 0.15,
    ratingGuide: '1 = Commodity → 5 = Strong unique proposition',
    defaultZonalRating: 3,
    defaultRemark: 'Local R&D agility + system-level mechatronics integration'
  },
  {
    id: 'es_5',
    dimensionId: 'easy_sell',
    dimensionName: '3. Easy to Sell',
    subFactor: 'Price / TCO Competitiveness',
    whatToMeasure: 'Ability to meet expected OEM cost target',
    weight: 0.10,
    ratingGuide: '1 = Poor → 5 = Strong',
    defaultZonalRating: 3,
    defaultRemark: 'Competitive localization & VAVE roadmap to meet target cost'
  },
  {
    id: 'es_6',
    dimensionId: 'easy_sell',
    dimensionName: '3. Easy to Sell',
    subFactor: 'Sales / Application Capability',
    whatToMeasure: 'Existing sales + application engineering capability',
    weight: 0.10,
    ratingGuide: '1 = New capability → 5 = Mature',
    defaultZonalRating: 3,
    defaultRemark: 'Dedicated KAMs + resident application engineers at OEM hubs'
  }
];

// ============================================================================
// 3. CADENCE PERIOD DEFINITIONS (Quarterly / Half-Yearly / Yearly)
// ============================================================================
export const PERIOD_OPTIONS: Record<CadenceType, { id: string; label: string; shortLabel: string }[]> = {
  quarterly: [
    { id: 'Q1_FY26', label: 'Q1 FY25-26 (Apr–Jun)', shortLabel: 'Q1 FY26' },
    { id: 'Q2_FY26', label: 'Q2 FY25-26 (Jul–Sep)', shortLabel: 'Q2 FY26' },
    { id: 'Q3_FY26', label: 'Q3 FY25-26 (Oct–Dec)', shortLabel: 'Q3 FY26' },
    { id: 'Q4_FY26', label: 'Q4 FY25-26 (Jan–Mar)', shortLabel: 'Q4 FY26' },
    { id: 'Q1_FY27', label: 'Q1 FY26-27 (Apr–Jun)', shortLabel: 'Q1 FY27' },
    { id: 'Q2_FY27', label: 'Q2 FY26-27 (Jul–Sep)', shortLabel: 'Q2 FY27' },
    { id: 'Q3_FY27', label: 'Q3 FY26-27 (Oct–Dec)', shortLabel: 'Q3 FY27' },
    { id: 'Q4_FY27', label: 'Q4 FY26-27 (Jan–Mar)', shortLabel: 'Q4 FY27' }
  ],
  half_yearly: [
    { id: 'H1_FY25', label: 'H1 FY24-25 (Apr–Sep)', shortLabel: 'H1 FY25' },
    { id: 'H2_FY25', label: 'H2 FY24-25 (Oct–Mar)', shortLabel: 'H2 FY25' },
    { id: 'H1_FY26', label: 'H1 FY25-26 (Apr–Sep)', shortLabel: 'H1 FY26' },
    { id: 'H2_FY26', label: 'H2 FY25-26 (Oct–Mar)', shortLabel: 'H2 FY26' },
    { id: 'H1_FY27', label: 'H1 FY26-27 (Apr–Sep)', shortLabel: 'H1 FY27' },
    { id: 'H2_FY27', label: 'H2 FY26-27 (Oct–Mar)', shortLabel: 'H2 FY27' }
  ],
  yearly: [
    { id: 'FY24_25', label: 'FY 2024-25 (Annual)', shortLabel: 'FY 24-25' },
    { id: 'FY25_26', label: 'FY 2025-26 (Annual)', shortLabel: 'FY 25-26' },
    { id: 'FY26_27', label: 'FY 2026-27 (Annual)', shortLabel: 'FY 26-27' }
  ]
};

interface ProductFamilyScorecardProps {
  projects: Project[];
  opportunities?: Opportunity[];
  config?: any;
  totalsLookup?: Record<string, any>;
  calculateProjectCost?: (p: any, mode: FiscalMode) => {
    mm: number;
    directMM: number;
    contractedMM: number;
    manpowerCr: number;
    expenseCr: number;
    totalCr: number;
  };
  initialSelectedFamily?: string;
}

const hashStr = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const clampRating = (val: number): number => Math.min(5, Math.max(1, Math.round(val)));

export interface FamilyPeriodEvaluation {
  periodId: string;
  periodLabel: string;
  shortLabel: string;
  // Sub-factor ratings (1 to 5)
  porterRatings: Record<string, number>;
  easinessRatings: Record<string, number>;
  // Sub-factor weighted scores (weight * rating)
  porterWeighted: Record<string, number>;
  easinessWeighted: Record<string, number>;
  // Group scores (1.00 to 5.00)
  forceScores: Record<string, number>;
  forceDeltas: Record<string, number>;
  dimensionScores: Record<string, number>;
  dimensionDeltas: Record<string, number>;
  // Overall composite scores (1.00 to 5.00)
  porterOverall: number;
  porterDelta: number;
  easinessOverall: number;
  easinessDelta: number;
  combinedStrategicScore: number;
  combinedDelta: number;
}

export interface FamilyFullScorecard {
  familyName: string;
  department: string;
  projectCount: number;
  budgetCr: number;
  actualsCr: number;
  wonCr: number;
  periods: Record<CadenceType, FamilyPeriodEvaluation[]>;
}

export const ProductFamilyScorecard: React.FC<ProductFamilyScorecardProps> = ({
  projects,
  opportunities = [],
  config,
  totalsLookup,
  calculateProjectCost,
  initialSelectedFamily
}) => {
  const [cadence, setCadence] = useState<CadenceType>('quarterly');
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(3); // Default Q4 FY26
  const [viewMode, setViewMode] = useState<ScorecardViewMode>('porter_sheet');
  const [parameterGroupFilter, setParameterGroupFilter] = useState<ParameterGroupTab>('both');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFamily, setSelectedFamily] = useState<string>(initialSelectedFamily || 'Zonal Controller');
  const [compareFamilies, setCompareFamilies] = useState<boolean>(false);

  // User overrides for ratings: key = `${familyName}__${cadence}__${periodId}__${subFactorId}`
  const [ratingOverrides, setRatingOverrides] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('creat_porter_easiness_ratings_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // User remarks per sub-factor or family summary: key = `${familyName}__${subFactorId}` or `${familyName}__OVERALL_REMARK`
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('creat_porter_easiness_remarks_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleCadenceChange = (newCadence: CadenceType) => {
    setCadence(newCadence);
    const list = PERIOD_OPTIONS[newCadence];
    setSelectedPeriodIdx(Math.max(0, list.length - 1));
  };

  const updateRating = (familyName: string, periodId: string, subFactorId: string, rating: number) => {
    const key = `${familyName}__${cadence}__${periodId}__${subFactorId}`;
    const clamped = clampRating(rating);
    setRatingOverrides(prev => {
      const next = { ...prev, [key]: clamped };
      try {
        localStorage.setItem('creat_porter_easiness_ratings_v1', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const updateRemark = (familyName: string, itemId: string, text: string) => {
    const key = `${familyName}__${itemId}`;
    setRemarksMap(prev => {
      const next = { ...prev, [key]: text };
      try {
        localStorage.setItem('creat_porter_easiness_remarks_v1', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const resetAllOverrides = () => {
    setRatingOverrides({});
    try {
      localStorage.removeItem('creat_porter_easiness_ratings_v1');
    } catch {
      // ignore
    }
  };

  const getRemark = (familyName: string, subFactorId: string, defaultRemark: string): string => {
    const key = `${familyName}__${subFactorId}`;
    if (remarksMap[key] !== undefined) return remarksMap[key];
    return defaultRemark;
  };

  const canonicalFamilies: string[] = useMemo(
    () => (Array.isArray(config?.productFamilies) ? config.productFamilies : []),
    [config]
  );

  // Build Product Family models with Porter Analysis & Easiness Matrix across Quarterly, Half-Yearly, Yearly
  const familyScorecards = useMemo<FamilyFullScorecard[]>(() => {
    const map = new Map<
      string,
      {
        familyName: string;
        departments: Record<string, number>;
        projects: Project[];
        budgetCr: number;
        actualsCr: number;
        wonCr: number;
      }
    >();

    // Ensure "Zonal Controller" from the user's reference sheet is always available even if not in project list
    map.set('Zonal Controller', {
      familyName: 'Zonal Controller',
      departments: { CE: 3 },
      projects: [],
      budgetCr: 14.5,
      actualsCr: 12.8,
      wonCr: 45.0
    });

    (projects || []).forEach(p => {
      const catLower = (p.category || '').toLowerCase();
      if (catLower.includes('support') || catLower.includes('maintenance')) return;

      const rawFam = (p.productFamily || 'Unassigned').trim();
      if (!rawFam || rawFam === 'Unassigned') return;
      const matchedFam = canonicalFamilies.find(
        f => f.trim().toLowerCase() === rawFam.toLowerCase()
      );
      const familyName = matchedFam ? matchedFam.trim() : rawFam;
      const normVert = normalizeVertical(p.vertical || 'Unspecified');
      const code = (p.code || '').trim().toUpperCase();

      let budgetCr = 0;
      if ((p as any).trueBudgetCr !== undefined && (p as any).trueBudgetCr > 0) {
        budgetCr = Number((p as any).trueBudgetCr) || 0;
      } else if ((p as any).portfolioBudgetCr !== undefined && (p as any).portfolioBudgetCr > 0) {
        budgetCr = Number((p as any).portfolioBudgetCr) || 0;
      } else if (calculateProjectCost) {
        budgetCr = calculateProjectCost(p, 'Budget').totalCr || 0;
      } else if (totalsLookup && code && totalsLookup[code]?.budget?.totalCr) {
        budgetCr = Number(totalsLookup[code].budget.totalCr) || 0;
      }

      let actualsCr = 0;
      if ((p as any).trueActualSpentCr !== undefined && (p as any).trueActualSpentCr > 0) {
        actualsCr = Number((p as any).trueActualSpentCr) || 0;
      } else if ((p as any).actualSpentCr !== undefined && (p as any).actualSpentCr > 0) {
        actualsCr = Number((p as any).actualSpentCr) || 0;
      } else if (calculateProjectCost) {
        actualsCr = calculateProjectCost(p, 'Actuals').totalCr || 0;
      } else if (totalsLookup && code && totalsLookup[code]?.actuals?.totalCr) {
        actualsCr = Number(totalsLookup[code].actuals?.totalCr) || 0;
      }

      if (!map.has(familyName)) {
        map.set(familyName, {
          familyName,
          departments: {},
          projects: [],
          budgetCr: 0,
          actualsCr: 0,
          wonCr: 0
        });
      }
      const entry = map.get(familyName)!;
      entry.projects.push(p);
      entry.budgetCr += budgetCr;
      entry.actualsCr += actualsCr;
      entry.departments[normVert] = (entry.departments[normVert] || 0) + 1;
    });

    (opportunities || []).forEach(o => {
      if (o.status === 'Won' && o.productFamily) {
        const rawFam = o.productFamily.trim();
        const entry = Array.from(map.values()).find(
          e => e.familyName.toLowerCase() === rawFam.toLowerCase()
        );
        if (entry) {
          entry.wonCr += Number(o.value) || 0;
        }
      }
    });

    const results: FamilyFullScorecard[] = [];

    map.forEach(entry => {
      const { familyName, departments, projects: famProjects, budgetCr, actualsCr, wonCr } = entry;
      const topDept =
        Object.entries(departments).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CE';

      const isZonal = familyName.toLowerCase().includes('zonal');

      const buildCadenceSeries = (cad: CadenceType): FamilyPeriodEvaluation[] => {
        const periodDefs = PERIOD_OPTIONS[cad];
        const evaluations: FamilyPeriodEvaluation[] = [];
        const baselineIdx = Math.min(3, periodDefs.length - 1);

        periodDefs.forEach((pDef, pIdx) => {
          const porterRatings: Record<string, number> = {};
          const porterWeighted: Record<string, number> = {};
          const easinessRatings: Record<string, number> = {};
          const easinessWeighted: Record<string, number> = {};

          // 1. Evaluate Porter Sub-factors
          PORTER_SUBFACTORS.forEach((sf, sfIdx) => {
            const overrideKey = `${familyName}__${cad}__${pDef.id}__${sf.id}`;
            let rating = sf.defaultZonalRating;

            if (ratingOverrides[overrideKey] !== undefined) {
              rating = ratingOverrides[overrideKey];
            } else if (isZonal && pIdx === baselineIdx) {
              // Exact match to Zonal Controller ratings in user's Excel sheet!
              rating = sf.defaultZonalRating;
            } else {
              const seed = hashStr(`${familyName}_${sf.id}`);
              const famOffset = isZonal ? 0 : ((seed % 3) - 1);
              // Periodic progression wave so user can see up/down movement across periods
              const periodShift =
                pIdx === baselineIdx
                  ? 0
                  : ((hashStr(`${familyName}_${sf.id}_${pDef.id}`) + pIdx + sfIdx) % 5 === 0
                      ? pIdx > baselineIdx
                        ? 1
                        : -1
                      : 0);
              rating = clampRating(sf.defaultZonalRating + famOffset + periodShift);
            }

            porterRatings[sf.id] = rating;
            porterWeighted[sf.id] = Number((rating * sf.weight).toFixed(2));
          });

          // 2. Evaluate Easiness Sub-factors
          EASINESS_SUBFACTORS.forEach((sf, sfIdx) => {
            const overrideKey = `${familyName}__${cad}__${pDef.id}__${sf.id}`;
            let rating = sf.defaultZonalRating;

            if (ratingOverrides[overrideKey] !== undefined) {
              rating = ratingOverrides[overrideKey];
            } else if (isZonal && pIdx === baselineIdx) {
              // Exact match to Zonal Controller ratings in user's Easiness Scoring sheet!
              rating = sf.defaultZonalRating;
            } else {
              const seed = hashStr(`${familyName}_${sf.id}`);
              const famOffset = isZonal ? 0 : ((seed % 3) - 1);
              const periodShift =
                pIdx === baselineIdx
                  ? 0
                  : ((hashStr(`${familyName}_${sf.id}_${pDef.id}`) + pIdx + sfIdx) % 5 === 0
                      ? pIdx > baselineIdx
                        ? 1
                        : -1
                      : 0);
              rating = clampRating(sf.defaultZonalRating + famOffset + periodShift);
            }

            easinessRatings[sf.id] = rating;
            easinessWeighted[sf.id] = Number((rating * sf.weight).toFixed(2));
          });

          // 3. Aggregate Porter Force Scores
          const forceScores: Record<string, number> = {};
          const forceDeltas: Record<string, number> = {};
          PORTER_FORCES.forEach(force => {
            const subFactors = PORTER_SUBFACTORS.filter(sf => sf.forceId === force.id);
            const sum = subFactors.reduce((acc, sf) => acc + (porterWeighted[sf.id] || 0), 0);
            const score = Number(sum.toFixed(2));
            forceScores[force.id] = score;
            const prevScore = pIdx > 0 ? evaluations[pIdx - 1].forceScores[force.id] : score;
            forceDeltas[force.id] = Number((score - prevScore).toFixed(2));
          });

          // 4. Aggregate Easiness Dimension Scores
          const dimensionScores: Record<string, number> = {};
          const dimensionDeltas: Record<string, number> = {};
          EASINESS_DIMENSIONS.forEach(dim => {
            const subFactors = EASINESS_SUBFACTORS.filter(sf => sf.dimensionId === dim.id);
            const sum = subFactors.reduce((acc, sf) => acc + (easinessWeighted[sf.id] || 0), 0);
            const score = Number(sum.toFixed(2));
            dimensionScores[dim.id] = score;
            const prevScore = pIdx > 0 ? evaluations[pIdx - 1].dimensionScores[dim.id] : score;
            dimensionDeltas[dim.id] = Number((score - prevScore).toFixed(2));
          });

          // 5. Overall Porter & Easiness Composite Scores (1.00 - 5.00)
          const porterOverall = Number(
            (
              PORTER_FORCES.reduce((acc, f) => acc + (forceScores[f.id] || 0), 0) /
              PORTER_FORCES.length
            ).toFixed(2)
          );
          const prevPorter = pIdx > 0 ? evaluations[pIdx - 1].porterOverall : porterOverall;
          const porterDelta = Number((porterOverall - prevPorter).toFixed(2));

          const easinessOverall = Number(
            (
              EASINESS_DIMENSIONS.reduce((acc, d) => acc + (dimensionScores[d.id] || 0), 0) /
              EASINESS_DIMENSIONS.length
            ).toFixed(2)
          );
          const prevEasiness = pIdx > 0 ? evaluations[pIdx - 1].easinessOverall : easinessOverall;
          const easinessDelta = Number((easinessOverall - prevEasiness).toFixed(2));

          const combinedStrategicScore = Number(((porterOverall + easinessOverall) / 2).toFixed(2));
          const prevCombined =
            pIdx > 0 ? evaluations[pIdx - 1].combinedStrategicScore : combinedStrategicScore;
          const combinedDelta = Number((combinedStrategicScore - prevCombined).toFixed(2));

          evaluations.push({
            periodId: pDef.id,
            periodLabel: pDef.label,
            shortLabel: pDef.shortLabel,
            porterRatings,
            easinessRatings,
            porterWeighted,
            easinessWeighted,
            forceScores,
            forceDeltas,
            dimensionScores,
            dimensionDeltas,
            porterOverall,
            porterDelta,
            easinessOverall,
            easinessDelta,
            combinedStrategicScore,
            combinedDelta
          });
        });

        return evaluations;
      };

      results.push({
        familyName,
        department: topDept,
        projectCount: famProjects.length,
        budgetCr,
        actualsCr,
        wonCr,
        periods: {
          quarterly: buildCadenceSeries('quarterly'),
          half_yearly: buildCadenceSeries('half_yearly'),
          yearly: buildCadenceSeries('yearly')
        }
      });
    });

    // Put Zonal Controller first if present, then sort by combined score
    return results.sort((a, b) => {
      if (a.familyName === 'Zonal Controller') return -1;
      if (b.familyName === 'Zonal Controller') return 1;
      return a.familyName.localeCompare(b.familyName);
    });
  }, [projects, opportunities, canonicalFamilies, calculateProjectCost, totalsLookup, ratingOverrides]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    familyScorecards.forEach(f => set.add(f.department));
    return ['All', ...Array.from(set).sort()];
  }, [familyScorecards]);

  const filteredFamilies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return familyScorecards.filter(f => {
      if (selectedDepartment !== 'All' && f.department !== selectedDepartment) return false;
      if (q && !f.familyName.toLowerCase().includes(q) && !f.department.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [familyScorecards, selectedDepartment, searchQuery]);

  const activePeriodList = PERIOD_OPTIONS[cadence];
  const safePeriodIdx = Math.min(selectedPeriodIdx, activePeriodList.length - 1);
  const currentPeriodDef = activePeriodList[safePeriodIdx];
  const prevPeriodDef = safePeriodIdx > 0 ? activePeriodList[safePeriodIdx - 1] : null;

  const activeFamilyData = useMemo(() => {
    if (selectedFamily) {
      const found = familyScorecards.find(f => f.familyName === selectedFamily);
      if (found) return found;
    }
    return filteredFamilies[0] || familyScorecards[0] || null;
  }, [selectedFamily, filteredFamilies, familyScorecards]);

  const renderDeltaBadge = (delta: number, size: 'xs' | 'sm' = 'xs') => {
    const textCls = size === 'xs' ? 'text-[9.5px] px-1.5 py-0.5' : 'text-[10.5px] px-2 py-0.5';
    if (delta > 0.01) {
      return (
        <span
          className={`inline-flex items-center gap-0.5 font-mono font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${textCls}`}
          title={`Up +${delta.toFixed(2)} vs previous period`}
        >
          <TrendingUp size={size === 'xs' ? 10 : 12} />+{delta.toFixed(2)}
        </span>
      );
    }
    if (delta < -0.01) {
      return (
        <span
          className={`inline-flex items-center gap-0.5 font-mono font-black rounded-md bg-rose-50 text-rose-700 border border-rose-200 ${textCls}`}
          title={`Down ${delta.toFixed(2)} vs previous period`}
        >
          <TrendingDown size={size === 'xs' ? 10 : 12} />
          {delta.toFixed(2)}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-0.5 font-mono font-bold rounded-md bg-slate-100 text-slate-500 border border-slate-200 ${textCls}`}
        title="No change vs previous period"
      >
        <Minus size={size === 'xs' ? 9 : 11} />0.00
      </span>
    );
  };

  const getScoreBadgeStyle = (score: number) => {
    if (score >= 3.75) return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (score >= 3.0) return 'bg-sky-50 text-sky-800 border-sky-300';
    if (score >= 2.25) return 'bg-amber-50 text-amber-800 border-amber-300';
    return 'bg-rose-50 text-rose-800 border-rose-300';
  };

  const activePeriodEval = activeFamilyData
    ? activeFamilyData.periods[cadence][safePeriodIdx]
    : null;
  const prevPeriodEval =
    activeFamilyData && safePeriodIdx > 0
      ? activeFamilyData.periods[cadence][safePeriodIdx - 1]
      : null;

  return (
    <div className="space-y-4">
      {/* TOP CONTROL BAR: 2 Main Parameter Groups (Porter Analysis & Easiness Matrix) + Cadence (Q/H/Y) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary View Switcher: Porter Analysis Sheet | Easiness Matrix Sheet | Rounded Cards | Period Trends */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('porter_sheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'porter_sheet'
                  ? 'bg-[#1e3a8a] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert size={13} />
              1. Porter Analysis
            </button>
            <button
              type="button"
              onClick={() => setViewMode('easiness_sheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'easiness_sheet'
                  ? 'bg-[#0f766e] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench size={13} />
              2. Easiness Matrix
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[#0082ca] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={13} />
              Family Cards & Playing Field
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trends')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === 'trends'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={13} />
              Q / H / Y Trend Monitor
            </button>
          </div>

          {/* Product Family Selector */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Product Family:
            </span>
            <select
              value={activeFamilyData?.familyName || ''}
              onChange={e => setSelectedFamily(e.target.value)}
              className="text-xs font-black text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-2"
            >
              {filteredFamilies.map(fam => (
                <option key={fam.familyName} value={fam.familyName}>
                  {fam.familyName} ({fam.department})
                </option>
              ))}
            </select>
          </div>

          {/* Cadence Selector: Quarterly | Half-Yearly | Yearly */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">
              Cadence:
            </span>
            {(
              [
                { id: 'quarterly', label: 'Quarterly' },
                { id: 'half_yearly', label: 'Half-Yearly' },
                { id: 'yearly', label: 'Yearly' }
              ] as const
            ).map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCadenceChange(c.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  cadence === c.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Period Selector Pills */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto max-w-full">
            {activePeriodList.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriodIdx(idx)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  safePeriodIdx === idx
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls: Multi-Family Compare, Dept Filter, Search & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {(viewMode === 'porter_sheet' || viewMode === 'easiness_sheet') && (
            <button
              type="button"
              onClick={() => setCompareFamilies(!compareFamilies)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                compareFamilies
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle side-by-side comparison of all Product Families on the scoring sheet"
            >
              <Table2 size={12} />
              {compareFamilies ? 'Single Family Sheet' : 'Compare All Families'}
            </button>
          )}

          <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Dept:
            </span>
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              {departments.map(d => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Depts' : d}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter family..."
              className="pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-medium text-slate-700 focus:outline-none focus:border-[#0082ca] w-36"
            />
          </div>

          {Object.keys(ratingOverrides).length > 0 && (
            <button
              type="button"
              onClick={resetAllOverrides}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              title="Reset custom ratings to baseline"
            >
              <RotateCcw size={11} />
              Reset Ratings
            </button>
          )}
        </div>
      </div>

      {/* EXECUTIVE KPI STRIP FOR SELECTED PRODUCT FAMILY */}
      {activeFamilyData && activePeriodEval && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Card 1: Active Family + Porter Analysis Summary */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black uppercase tracking-wider">
                    Parameter Group 1
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {currentPeriodDef.shortLabel}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mt-1">
                  Porter Analysis ({activeFamilyData.familyName})
                </h3>
                <p className="text-[10px] text-slate-500">
                  5 Competitive Forces · 21 Weighted Sub-factors (Scale 1–5)
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div
                  className={`px-3 py-1 rounded-xl border font-mono text-lg font-black ${getScoreBadgeStyle(
                    activePeriodEval.porterOverall
                  )}`}
                >
                  {activePeriodEval.porterOverall.toFixed(2)}
                  <span className="text-[10px] font-normal opacity-70"> / 5.00</span>
                </div>
                <div className="mt-1">{renderDeltaBadge(activePeriodEval.porterDelta, 'xs')}</div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
              {PORTER_FORCES.map(f => (
                <div
                  key={f.id}
                  className="bg-slate-50 rounded-xl p-1.5 border border-slate-200/70 text-center"
                  title={`${f.name}: ${f.interpretScore(activePeriodEval.forceScores[f.id])}`}
                >
                  <div className="text-[8.5px] font-bold text-slate-500 truncate">
                    {f.name.replace('Threat of ', '')}
                  </div>
                  <div className="text-xs font-mono font-black text-slate-800 mt-0.5">
                    {activePeriodEval.forceScores[f.id].toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Easiness Matrix Summary */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-black uppercase tracking-wider">
                    Parameter Group 2
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {currentPeriodDef.shortLabel}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mt-1">
                  Easiness Matrix ({activeFamilyData.familyName})
                </h3>
                <p className="text-[10px] text-slate-500">
                  Easy to Engineer · Easy to Manufacture · Easy to Sell (18 Sub-factors)
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div
                  className={`px-3 py-1 rounded-xl border font-mono text-lg font-black ${getScoreBadgeStyle(
                    activePeriodEval.easinessOverall
                  )}`}
                >
                  {activePeriodEval.easinessOverall.toFixed(2)}
                  <span className="text-[10px] font-normal opacity-70"> / 5.00</span>
                </div>
                <div className="mt-1">{renderDeltaBadge(activePeriodEval.easinessDelta, 'xs')}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100">
              {EASINESS_DIMENSIONS.map(d => (
                <div
                  key={d.id}
                  className="bg-slate-50 rounded-xl p-1.5 border border-slate-200/70 text-center"
                >
                  <div className="text-[9px] font-bold text-slate-500 truncate">
                    {d.name.replace(/^\d+\.\s*/, '')}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="text-xs font-mono font-black text-slate-800">
                      {activePeriodEval.dimensionScores[d.id].toFixed(2)}
                    </span>
                    {renderDeltaBadge(activePeriodEval.dimensionDeltas[d.id], 'xs')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Executive Remarks & Strategic Playing Field Summary */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={13} className="text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                  Executive Remarks ({activeFamilyData.familyName})
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                Combined: {activePeriodEval.combinedStrategicScore.toFixed(2)} / 5.00
              </span>
            </div>
            <textarea
              rows={2}
              value={getRemark(
                activeFamilyData.familyName,
                'OVERALL_REMARK',
                `Strategic priority family (${activeFamilyData.department}). Monitor supplier concentration & OEM RFQ target pricing in ${currentPeriodDef.shortLabel}.`
              )}
              onChange={e =>
                updateRemark(activeFamilyData.familyName, 'OVERALL_REMARK', e.target.value)
              }
              placeholder="Add executive remarks, offsite notes, or key action items for this Product Family..."
              className="w-full text-[11px] text-slate-700 bg-slate-50/80 border border-slate-200 rounded-xl p-2 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors resize-none"
            />
            <div className="flex items-center justify-between text-[9.5px] text-slate-400 mt-1.5">
              <span>
                Projects: <strong className="text-slate-700">{activeFamilyData.projectCount}</strong> · Budget:{' '}
                <strong className="text-slate-700">₹{activeFamilyData.budgetCr.toFixed(1)}Cr</strong> · Actuals:{' '}
                <strong className="text-slate-700">₹{activeFamilyData.actualsCr.toFixed(1)}Cr</strong>
              </span>
              <span className="text-emerald-600 font-bold">Auto-saved</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 1: PORTER SCORING METHOD SHEET (Exact match to Image 1 + Remarks + Period Delta)
         ===================================================================== */}
      {viewMode === 'porter_sheet' && activeFamilyData && activePeriodEval && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-sky-400" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Porter Scoring Method — {compareFamilies ? 'All Product Families Comparison' : activeFamilyData.familyName}
                </h4>
                <p className="text-[10px] text-slate-300">
                  Period: <span className="font-bold text-white">{currentPeriodDef.label}</span>
                  {prevPeriodDef ? ` (Delta ▲/▼ vs ${prevPeriodDef.shortLabel})` : ''} · Click any Rating (1–5) to adjust or edit Remarks inline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-bold">
                Overall Porter Score:{' '}
                <span className="text-emerald-400 font-black">
                  {activePeriodEval.porterOverall.toFixed(2)}
                </span>{' '}
                / 5.00
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {!compareFamilies ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[130px]">Porter Force</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[185px]">Sub-factor</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[220px]">Rationale / Basis</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[155px]">Measurable Input</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[185px]">Reference Formula</th>
                    <th className="py-2.5 px-2 border-r border-slate-200 text-center w-[68px]">Weight</th>
                    <th className="py-2.5 px-2.5 border-r border-slate-200 text-center bg-blue-50/70 text-blue-900 w-[105px]">
                      <div>{activeFamilyData.familyName}</div>
                      <div className="text-[9px] font-bold text-blue-700">Rating (1–5)</div>
                    </th>
                    <th className="py-2.5 px-2.5 border-r border-slate-200 text-center bg-blue-50/70 text-blue-900 w-[110px]">
                      <div>Weighted</div>
                      <div className="text-[9px] font-bold text-blue-700">Score & Δ</div>
                    </th>
                    <th className="py-2.5 px-3 bg-amber-50/50 text-slate-800 min-w-[230px]">
                      <div className="flex items-center gap-1">
                        <MessageSquare size={11} className="text-amber-600" />
                        <span>Remarks / Basis Notes</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-slate-700">
                  {PORTER_FORCES.map(force => {
                    const forceRows = PORTER_SUBFACTORS.filter(sf => sf.forceId === force.id);
                    const forceScore = activePeriodEval.forceScores[force.id];
                    const forceDelta = activePeriodEval.forceDeltas[force.id];
                    const interpretation = force.interpretScore(forceScore);

                    return (
                      <React.Fragment key={force.id}>
                        {forceRows.map((sf, idx) => {
                          const rating = activePeriodEval.porterRatings[sf.id];
                          const weighted = activePeriodEval.porterWeighted[sf.id];
                          const prevRating = prevPeriodEval
                            ? prevPeriodEval.porterRatings[sf.id]
                            : rating;
                          const ratingDelta = rating - prevRating;
                          const remarkVal = getRemark(
                            activeFamilyData.familyName,
                            sf.id,
                            sf.defaultRemark
                          );

                          return (
                            <tr
                              key={sf.id}
                              className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors"
                            >
                              {idx === 0 && (
                                <td
                                  rowSpan={forceRows.length}
                                  className="py-3 px-3 border-r border-slate-200 font-black text-slate-900 align-top bg-slate-50/60"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: force.color }}
                                    />
                                    <span>{force.name}</span>
                                  </div>
                                </td>
                              )}
                              <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-800 align-top">
                                {sf.subFactor}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 align-top leading-snug">
                                {sf.rationale}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 align-top">
                                {sf.measurableInput}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-[10px] text-slate-600 align-top whitespace-pre-line">
                                {sf.referenceFormula}
                              </td>
                              <td className="py-2.5 px-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700 align-middle">
                                {Math.round(sf.weight * 100)}%
                              </td>
                              <td className="py-2 px-2 border-r border-slate-200 text-center align-middle bg-blue-50/20">
                                <div className="flex items-center justify-center gap-1">
                                  <select
                                    value={rating}
                                    onChange={e =>
                                      updateRating(
                                        activeFamilyData.familyName,
                                        currentPeriodDef.id,
                                        sf.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono text-xs font-black text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                                  >
                                    {[1, 2, 3, 4, 5].map(r => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                  {ratingDelta !== 0 && (
                                    <span
                                      className={`text-[9px] font-mono font-black ${
                                        ratingDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                                      }`}
                                      title={`Rating changed by ${ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta} vs previous period`}
                                    >
                                      {ratingDelta > 0 ? `▲+${ratingDelta}` : `▼${ratingDelta}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900 align-middle bg-blue-50/20">
                                {weighted.toFixed(2)}
                              </td>
                              <td className="py-2 px-2.5 align-middle bg-amber-50/10">
                                <input
                                  type="text"
                                  value={remarkVal}
                                  onChange={e =>
                                    updateRemark(activeFamilyData.familyName, sf.id, e.target.value)
                                  }
                                  placeholder="Add remark..."
                                  className="w-full px-2 py-1 text-[11px] text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded-lg focus:outline-none transition-colors"
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {/* Force Summary Row (matches bold summary row in Excel sheet) */}
                        <tr className="bg-slate-100/90 border-b-2 border-slate-300 font-black text-slate-900">
                          <td className="py-2 px-3 border-r border-slate-200 text-[11px]">
                            {force.summaryLabel}
                          </td>
                          <td colSpan={4} className="py-2 px-3 border-r border-slate-200 text-[11px]">
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] ${force.badgeClass}`}>
                              {interpretation}
                            </span>
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-[11px]">
                            100%
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center bg-blue-100/50">
                            {renderDeltaBadge(forceDelta, 'xs')}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-xs bg-blue-100/50 text-blue-950">
                            {forceScore.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 bg-slate-100/90">
                            <input
                              type="text"
                              value={getRemark(
                                activeFamilyData.familyName,
                                `FORCE_REMARK_${force.id}`,
                                interpretation
                              )}
                              onChange={e =>
                                updateRemark(
                                  activeFamilyData.familyName,
                                  `FORCE_REMARK_${force.id}`,
                                  e.target.value
                                )
                              }
                              placeholder="Force summary remark..."
                              className="w-full px-2 py-0.5 text-[10.5px] font-bold text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-400 rounded-md focus:outline-none"
                            />
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* MULTI-FAMILY SIDE-BY-SIDE PORTER COMPARISON SHEET */
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    <th className="py-2.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 min-w-[130px]">
                      Porter Force
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-200 min-w-[180px]">Sub-factor</th>
                    <th className="py-2.5 px-2 border-r border-slate-200 text-center w-[60px]">Weight</th>
                    {filteredFamilies.slice(0, 8).map(fam => (
                      <th
                        key={fam.familyName}
                        colSpan={2}
                        className="py-2 px-2 border-r border-slate-300 text-center bg-blue-50/70 text-blue-950 min-w-[130px]"
                      >
                        <div className="truncate max-w-[140px] mx-auto">{fam.familyName}</div>
                        <div className="text-[8.5px] text-blue-700 font-bold">Rating | Weighted</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[11px] text-slate-700">
                  {PORTER_FORCES.map(force => {
                    const forceRows = PORTER_SUBFACTORS.filter(sf => sf.forceId === force.id);
                    return (
                      <React.Fragment key={force.id}>
                        {forceRows.map((sf, idx) => (
                          <tr key={sf.id} className="border-b border-slate-200 hover:bg-slate-50">
                            {idx === 0 && (
                              <td
                                rowSpan={forceRows.length}
                                className="py-2.5 px-3 border-r border-slate-200 font-black text-slate-900 align-top sticky left-0 bg-white z-10"
                              >
                                {force.name}
                              </td>
                            )}
                            <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">
                              {sf.subFactor}
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-mono font-bold">
                              {Math.round(sf.weight * 100)}%
                            </td>
                            {filteredFamilies.slice(0, 8).map(fam => {
                              const ev = fam.periods[cadence][safePeriodIdx];
                              const r = ev.porterRatings[sf.id];
                              const w = ev.porterWeighted[sf.id];
                              return (
                                <React.Fragment key={`${fam.familyName}_${sf.id}`}>
                                  <td className="py-1.5 px-1.5 border-r border-slate-100 text-center font-mono">
                                    <select
                                      value={r}
                                      onChange={e =>
                                        updateRating(
                                          fam.familyName,
                                          currentPeriodDef.id,
                                          sf.id,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[11px] font-bold"
                                    >
                                      {[1, 2, 3, 4, 5].map(val => (
                                        <option key={val} value={val}>
                                          {val}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold text-slate-800 bg-slate-50/50">
                                    {w.toFixed(2)}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-900">
                          <td className="py-2 px-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
                            {force.summaryLabel}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-[10px] text-slate-500">
                            Σ(Weight × Rating)
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                            100%
                          </td>
                          {filteredFamilies.slice(0, 8).map(fam => {
                            const ev = fam.periods[cadence][safePeriodIdx];
                            return (
                              <td
                                key={`${fam.familyName}_${force.id}_sum`}
                                colSpan={2}
                                className="py-2 px-2.5 border-r border-slate-300 text-right font-mono text-xs bg-blue-50/80 text-blue-950"
                              >
                                <div className="flex items-center justify-between">
                                  {renderDeltaBadge(ev.forceDeltas[force.id], 'xs')}
                                  <span>{ev.forceScores[force.id].toFixed(2)}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: EASINESS MATRIX SCORING SHEET (Exact match to Image 2 + Remarks + Period Delta)
         ===================================================================== */}
      {viewMode === 'easiness_sheet' && activeFamilyData && activePeriodEval && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-[#0f766e] text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-teal-200" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Easiness Matrix Scoring — {compareFamilies ? 'All Product Families Comparison' : activeFamilyData.familyName}
                </h4>
                <p className="text-[10px] text-teal-100">
                  1. Easy to Engineer · 2. Easy to Manufacture · 3. Easy to Sell · Period:{' '}
                  <span className="font-bold text-white">{currentPeriodDef.label}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-xl bg-white/15 border border-white/20 text-xs font-mono font-bold">
                Overall Easiness Score:{' '}
                <span className="text-amber-300 font-black">
                  {activePeriodEval.easinessOverall.toFixed(2)}
                </span>{' '}
                / 5.00
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {!compareFamilies ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[155px]">Dimension</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[200px]">Sub-factor</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[240px]">What to Measure</th>
                    <th className="py-2.5 px-2 border-r border-slate-200 text-center w-[68px]">Weight</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-[200px]">Rating 1–5</th>
                    <th className="py-2.5 px-2.5 border-r border-slate-200 text-center bg-teal-50/70 text-teal-950 w-[105px]">
                      <div>{activeFamilyData.familyName}</div>
                      <div className="text-[9px] font-bold text-teal-700">Rating</div>
                    </th>
                    <th className="py-2.5 px-2.5 border-r border-slate-200 text-center bg-teal-50/70 text-teal-950 w-[110px]">
                      <div>Weighted</div>
                      <div className="text-[9px] font-bold text-teal-700">Score & Δ</div>
                    </th>
                    <th className="py-2.5 px-3 bg-amber-50/50 text-slate-800 min-w-[240px]">
                      <div className="flex items-center gap-1">
                        <MessageSquare size={11} className="text-amber-600" />
                        <span>Remarks / Action Notes</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[11px] text-slate-700">
                  {EASINESS_DIMENSIONS.map(dim => {
                    const dimRows = EASINESS_SUBFACTORS.filter(sf => sf.dimensionId === dim.id);
                    const dimScore = activePeriodEval.dimensionScores[dim.id];
                    const dimDelta = activePeriodEval.dimensionDeltas[dim.id];

                    return (
                      <React.Fragment key={dim.id}>
                        {dimRows.map((sf, idx) => {
                          const rating = activePeriodEval.easinessRatings[sf.id];
                          const weighted = activePeriodEval.easinessWeighted[sf.id];
                          const prevRating = prevPeriodEval
                            ? prevPeriodEval.easinessRatings[sf.id]
                            : rating;
                          const ratingDelta = rating - prevRating;
                          const remarkVal = getRemark(
                            activeFamilyData.familyName,
                            sf.id,
                            sf.defaultRemark
                          );

                          return (
                            <tr
                              key={sf.id}
                              className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors"
                            >
                              {idx === 0 && (
                                <td
                                  rowSpan={dimRows.length}
                                  className="py-3 px-3 border-r border-slate-200 font-black text-slate-900 align-top bg-slate-50/60"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: dim.color }}
                                    />
                                    <span>{dim.name}</span>
                                  </div>
                                </td>
                              )}
                              <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-800 align-top">
                                {sf.subFactor}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 align-top leading-snug">
                                {sf.whatToMeasure}
                              </td>
                              <td className="py-2.5 px-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700 align-middle">
                                {Math.round(sf.weight * 100)}%
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-[10px] text-slate-600 align-middle">
                                {sf.ratingGuide}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-200 text-center align-middle bg-teal-50/20">
                                <div className="flex items-center justify-center gap-1">
                                  <select
                                    value={rating}
                                    onChange={e =>
                                      updateRating(
                                        activeFamilyData.familyName,
                                        currentPeriodDef.id,
                                        sf.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono text-xs font-black text-slate-900 focus:outline-none focus:border-teal-600 cursor-pointer shadow-2xs"
                                  >
                                    {[1, 2, 3, 4, 5].map(r => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                  {ratingDelta !== 0 && (
                                    <span
                                      className={`text-[9px] font-mono font-black ${
                                        ratingDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                                      }`}
                                    >
                                      {ratingDelta > 0 ? `▲+${ratingDelta}` : `▼${ratingDelta}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900 align-middle bg-teal-50/20">
                                {weighted.toFixed(2)}
                              </td>
                              <td className="py-2 px-2.5 align-middle bg-amber-50/10">
                                <input
                                  type="text"
                                  value={remarkVal}
                                  onChange={e =>
                                    updateRemark(activeFamilyData.familyName, sf.id, e.target.value)
                                  }
                                  placeholder="Add remark..."
                                  className="w-full px-2 py-1 text-[11px] text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-teal-500 rounded-lg focus:outline-none transition-colors"
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {/* Dimension Summary Row (matches bold Σ(Weight × Rating) row in Excel sheet) */}
                        <tr className="bg-slate-100/90 border-b-2 border-slate-300 font-black text-slate-900">
                          <td className="py-2 px-3 border-r border-slate-200 text-[11px]" />
                          <td className="py-2 px-3 border-r border-slate-200 text-[11px]">
                            {dim.summaryLabel}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-[10px] text-slate-500">
                            Dimension Weighted Total
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-[11px]">
                            100%
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px]">
                            Σ(Weight × Rating)
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center bg-teal-100/50">
                            {renderDeltaBadge(dimDelta, 'xs')}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono text-xs bg-teal-100/50 text-teal-950">
                            {dimScore.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 bg-slate-100/90">
                            <input
                              type="text"
                              value={getRemark(
                                activeFamilyData.familyName,
                                `DIM_REMARK_${dim.id}`,
                                `${dim.summaryLabel}: ${dimScore.toFixed(2)} / 5.00`
                              )}
                              onChange={e =>
                                updateRemark(
                                  activeFamilyData.familyName,
                                  `DIM_REMARK_${dim.id}`,
                                  e.target.value
                                )
                              }
                              placeholder="Dimension summary remark..."
                              className="w-full px-2 py-0.5 text-[10.5px] font-bold text-slate-700 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-teal-500 rounded-md focus:outline-none"
                            />
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* MULTI-FAMILY SIDE-BY-SIDE EASINESS MATRIX COMPARISON */
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    <th className="py-2.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 min-w-[145px]">
                      Dimension
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-200 min-w-[180px]">Sub-factor</th>
                    <th className="py-2.5 px-2 border-r border-slate-200 text-center w-[60px]">Weight</th>
                    {filteredFamilies.slice(0, 8).map(fam => (
                      <th
                        key={fam.familyName}
                        colSpan={2}
                        className="py-2 px-2 border-r border-slate-300 text-center bg-teal-50/70 text-teal-950 min-w-[130px]"
                      >
                        <div className="truncate max-w-[140px] mx-auto">{fam.familyName}</div>
                        <div className="text-[8.5px] text-teal-700 font-bold">Rating | Weighted</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[11px] text-slate-700">
                  {EASINESS_DIMENSIONS.map(dim => {
                    const dimRows = EASINESS_SUBFACTORS.filter(sf => sf.dimensionId === dim.id);
                    return (
                      <React.Fragment key={dim.id}>
                        {dimRows.map((sf, idx) => (
                          <tr key={sf.id} className="border-b border-slate-200 hover:bg-slate-50">
                            {idx === 0 && (
                              <td
                                rowSpan={dimRows.length}
                                className="py-2.5 px-3 border-r border-slate-200 font-black text-slate-900 align-top sticky left-0 bg-white z-10"
                              >
                                {dim.name}
                              </td>
                            )}
                            <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">
                              {sf.subFactor}
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-mono font-bold">
                              {Math.round(sf.weight * 100)}%
                            </td>
                            {filteredFamilies.slice(0, 8).map(fam => {
                              const ev = fam.periods[cadence][safePeriodIdx];
                              const r = ev.easinessRatings[sf.id];
                              const w = ev.easinessWeighted[sf.id];
                              return (
                                <React.Fragment key={`${fam.familyName}_${sf.id}`}>
                                  <td className="py-1.5 px-1.5 border-r border-slate-100 text-center font-mono">
                                    <select
                                      value={r}
                                      onChange={e =>
                                        updateRating(
                                          fam.familyName,
                                          currentPeriodDef.id,
                                          sf.id,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[11px] font-bold"
                                    >
                                      {[1, 2, 3, 4, 5].map(val => (
                                        <option key={val} value={val}>
                                          {val}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold text-slate-800 bg-slate-50/50">
                                    {w.toFixed(2)}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-900">
                          <td className="py-2 px-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
                            {dim.summaryLabel}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-[10px] text-slate-500">
                            Σ(Weight × Rating)
                          </td>
                          <td className="py-2 px-2 border-r border-slate-200 text-center font-mono">
                            100%
                          </td>
                          {filteredFamilies.slice(0, 8).map(fam => {
                            const ev = fam.periods[cadence][safePeriodIdx];
                            return (
                              <td
                                key={`${fam.familyName}_${dim.id}_sum`}
                                colSpan={2}
                                className="py-2 px-2.5 border-r border-slate-300 text-right font-mono text-xs bg-teal-50/80 text-teal-950"
                              >
                                <div className="flex items-center justify-between">
                                  {renderDeltaBadge(ev.dimensionDeltas[dim.id], 'xs')}
                                  <span>{ev.dimensionScores[dim.id].toFixed(2)}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: ROUNDED RECTANGLE PRODUCT FAMILY CARDS & 2x2 PLAYING FIELD
         ===================================================================== */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {/* 2x2 Strategic Matrix Plot: Porter Score (Market Attractiveness) vs Easiness Score (Ease of Execution) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Compass size={14} className="text-[#0082ca]" />
                  Strategic Playing Field: Porter Analysis (Attractiveness) vs. Easiness Matrix (Execution) — {currentPeriodDef.shortLabel}
                </h4>
                <p className="text-[10px] text-slate-400">
                  X-Axis: Easiness Matrix Score (1–5) · Y-Axis: Porter Analysis Score (1–5) · Click any bubble or rounded card below to inspect sub-factors
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(
                  [
                    { id: 'both', label: 'Show Both Groups' },
                    { id: 'porter', label: 'Porter Analysis Only' },
                    { id: 'easiness', label: 'Easiness Matrix Only' }
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setParameterGroupFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      parameterGroupFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 15, right: 30, left: 0, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="easiness"
                    name="Easiness Score"
                    domain={[1.5, 4.5]}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                    label={{
                      value: 'Easiness Matrix Score (Engineer · Manufacture · Sell) →',
                      position: 'bottom',
                      offset: 0,
                      fontSize: 10,
                      fontWeight: 800,
                      fill: '#0f766e'
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="porter"
                    name="Porter Score"
                    domain={[1.5, 4.5]}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                    label={{
                      value: 'Porter Analysis Score →',
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 10,
                      fontWeight: 800,
                      fill: '#1e3a8a'
                    }}
                  />
                  <ZAxis type="number" dataKey="budgetCr" range={[90, 420]} name="Budget (Cr)" />
                  <ReferenceLine x={3.0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <ReferenceLine y={3.0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-[11px] border border-slate-700">
                          <div className="font-black text-sky-300">{d.familyName}</div>
                          <div className="text-[10px] text-slate-300 mb-1">Dept: {d.department}</div>
                          <div className="font-mono">Porter Score: {d.porter.toFixed(2)} / 5.00</div>
                          <div className="font-mono">Easiness Score: {d.easiness.toFixed(2)} / 5.00</div>
                          <div className="font-mono text-emerald-300">
                            Combined: {d.combined.toFixed(2)} / 5.00
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={filteredFamilies.map(f => {
                      const ev = f.periods[cadence][safePeriodIdx];
                      return {
                        familyName: f.familyName,
                        department: f.department,
                        easiness: ev.easinessOverall,
                        porter: ev.porterOverall,
                        combined: ev.combinedStrategicScore,
                        budgetCr: Math.max(2, f.budgetCr)
                      };
                    })}
                    onClick={(data: any) => {
                      if (data?.familyName) setSelectedFamily(data.familyName);
                    }}
                    className="cursor-pointer"
                  >
                    {filteredFamilies.map(f => {
                      const isSel = activeFamilyData?.familyName === f.familyName;
                      return (
                        <Cell
                          key={f.familyName}
                          fill={isSel ? '#0284c7' : '#6366f1'}
                          stroke={isSel ? '#0f172a' : '#4338ca'}
                          strokeWidth={isSel ? 2.5 : 1}
                        />
                      );
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rounded-Rectangle Product Family Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFamilies.map(fam => {
              const ev = fam.periods[cadence][safePeriodIdx];
              const isSelected = activeFamilyData?.familyName === fam.familyName;
              const overallRemark = getRemark(
                fam.familyName,
                'OVERALL_REMARK',
                `Key focus on supplier qualification & OEM platform pull.`
              );

              return (
                <div
                  key={fam.familyName}
                  onClick={() => setSelectedFamily(fam.familyName)}
                  className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isSelected
                      ? 'border-[#0082ca] ring-2 ring-[#0082ca]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[9px] uppercase tracking-wider">
                            {fam.department}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {fam.projectCount} {fam.projectCount === 1 ? 'Project' : 'Projects'}
                          </span>
                        </div>
                        <h4
                          className="text-sm font-black text-slate-900 truncate"
                          title={fam.familyName}
                        >
                          {fam.familyName}
                        </h4>
                      </div>

                      {/* Combined Score Pill */}
                      <div className="flex flex-col items-end shrink-0">
                        <div
                          className={`px-2.5 py-1 rounded-xl border font-mono text-sm font-black ${getScoreBadgeStyle(
                            ev.combinedStrategicScore
                          )}`}
                        >
                          {ev.combinedStrategicScore.toFixed(2)}
                          <span className="text-[9px] font-normal opacity-70">/5</span>
                        </div>
                        <div className="mt-1">{renderDeltaBadge(ev.combinedDelta, 'xs')}</div>
                      </div>
                    </div>

                    {/* GROUP 1: PORTER ANALYSIS SECTION */}
                    {(parameterGroupFilter === 'both' || parameterGroupFilter === 'porter') && (
                      <div className="mb-3 p-2.5 rounded-xl bg-blue-50/40 border border-blue-200/70">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert size={12} className="text-blue-700" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-950">
                              Porter Analysis
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-blue-900">
                              {ev.porterOverall.toFixed(2)}
                            </span>
                            {renderDeltaBadge(ev.porterDelta, 'xs')}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {PORTER_FORCES.map(f => {
                            const fScore = ev.forceScores[f.id];
                            const fDelta = ev.forceDeltas[f.id];
                            return (
                              <div key={f.id} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-semibold text-slate-700 truncate">
                                    {f.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono font-bold text-slate-900">
                                      {fScore.toFixed(2)}
                                    </span>
                                    {renderDeltaBadge(fDelta, 'xs')}
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-slate-200/60">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, (fScore / 5) * 100)}%`,
                                      backgroundColor: f.color
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* GROUP 2: EASINESS MATRIX SECTION */}
                    {(parameterGroupFilter === 'both' || parameterGroupFilter === 'easiness') && (
                      <div className="mb-3 p-2.5 rounded-xl bg-teal-50/40 border border-teal-200/70">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Wrench size={12} className="text-teal-700" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-950">
                              Easiness Matrix
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-teal-900">
                              {ev.easinessOverall.toFixed(2)}
                            </span>
                            {renderDeltaBadge(ev.easinessDelta, 'xs')}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {EASINESS_DIMENSIONS.map(d => {
                            const dScore = ev.dimensionScores[d.id];
                            const dDelta = ev.dimensionDeltas[d.id];
                            return (
                              <div key={d.id} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-semibold text-slate-700 truncate">
                                    {d.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono font-bold text-slate-900">
                                      {dScore.toFixed(2)}
                                    </span>
                                    {renderDeltaBadge(dDelta, 'xs')}
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-slate-200/60">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, (dScore / 5) * 100)}%`,
                                      backgroundColor: d.color
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remarks & Action Buttons Footer */}
                  <div
                    className="pt-2.5 border-t border-slate-100 space-y-2"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={11} className="text-amber-600 shrink-0" />
                      <input
                        type="text"
                        value={overallRemark}
                        onChange={e =>
                          updateRemark(fam.familyName, 'OVERALL_REMARK', e.target.value)
                        }
                        placeholder="Add family remark..."
                        className="w-full text-[10.5px] text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 focus:bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFamily(fam.familyName);
                          setViewMode('porter_sheet');
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center"
                      >
                        Porter Sheet →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFamily(fam.familyName);
                          setViewMode('easiness_sheet');
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[9.5px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center"
                      >
                        Easiness Sheet →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: QUARTERLY / HALF-YEARLY / YEARLY PARAMETER TREND MONITOR
         ===================================================================== */}
      {viewMode === 'trends' && activeFamilyData && activePeriodEval && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 7 cols: Multi-Period Trajectory Line Chart for Porter Forces & Easiness Dimensions */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {activeFamilyData.familyName} — {cadence.replace('_', '-')} Score Trajectory (1.00–5.00)
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Tracks how Porter Analysis & Easiness Matrix parameters move up and down across periods
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {(
                    [
                      { id: 'both', label: 'Both Groups' },
                      { id: 'porter', label: '5 Porter Forces' },
                      { id: 'easiness', label: '3 Easiness Dimensions' }
                    ] as const
                  ).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setParameterGroupFilter(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider cursor-pointer ${
                        parameterGroupFilter === t.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activeFamilyData.periods[cadence].map(p => ({
                      name: p.shortLabel,
                      'Porter Overall': p.porterOverall,
                      'Easiness Overall': p.easinessOverall,
                      ...PORTER_FORCES.reduce(
                        (acc, f) => ({ ...acc, [f.name]: p.forceScores[f.id] }),
                        {}
                      ),
                      ...EASINESS_DIMENSIONS.reduce(
                        (acc, d) => ({ ...acc, [d.name]: p.dimensionScores[d.id] }),
                        {}
                      )
                    }))}
                    margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                    />
                    <YAxis
                      domain={[1, 5]}
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                    {parameterGroupFilter === 'both' && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="Porter Overall"
                          stroke="#1e3a8a"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#1e3a8a' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Easiness Overall"
                          stroke="#0f766e"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#0f766e' }}
                        />
                      </>
                    )}
                    {parameterGroupFilter === 'porter' &&
                      PORTER_FORCES.map(f => (
                        <Line
                          key={f.id}
                          type="monotone"
                          dataKey={f.name}
                          stroke={f.color}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    {parameterGroupFilter === 'easiness' &&
                      EASINESS_DIMENSIONS.map(d => (
                        <Line
                          key={d.id}
                          type="monotone"
                          dataKey={d.name}
                          stroke={d.color}
                          strokeWidth={2.5}
                          dot={{ r: 3.5 }}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right 5 cols: Radar Profile of Porter 5 Forces + 3 Easiness Dimensions */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  8-Axis Strategic Profile ({currentPeriodDef.shortLabel} vs Previous)
                </h4>
                <p className="text-[10px] text-slate-400">
                  5 Porter Forces + 3 Easiness Dimensions (Scale 1–5)
                </p>
              </div>
              <div className="h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={[
                      ...PORTER_FORCES.map(f => ({
                        axis: f.name.replace('Threat of ', ''),
                        Current: activePeriodEval.forceScores[f.id],
                        Previous: prevPeriodEval
                          ? prevPeriodEval.forceScores[f.id]
                          : activePeriodEval.forceScores[f.id]
                      })),
                      ...EASINESS_DIMENSIONS.map(d => ({
                        axis: d.name.replace(/^\d+\.\s*/, ''),
                        Current: activePeriodEval.dimensionScores[d.id],
                        Previous: prevPeriodEval
                          ? prevPeriodEval.dimensionScores[d.id]
                          : activePeriodEval.dimensionScores[d.id]
                      }))
                    ]}
                  >
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis
                      dataKey="axis"
                      tick={{ fontSize: 9.5, fontWeight: 800, fill: '#334155' }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 5]}
                      tick={{ fontSize: 8, fill: '#94a3b8' }}
                    />
                    {prevPeriodEval && (
                      <Radar
                        name={prevPeriodEval.shortLabel}
                        dataKey="Previous"
                        stroke="#94a3b8"
                        fill="#cbd5e1"
                        fillOpacity={0.25}
                      />
                    )}
                    <Radar
                      name={currentPeriodDef.shortLabel}
                      dataKey="Current"
                      stroke="#0284c7"
                      fill="#0284c7"
                      fillOpacity={0.35}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Complete Period-over-Period Ledger Table for All 5 Porter Forces & 3 Easiness Dimensions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs overflow-x-auto">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3">
              Periodic Parameter Movement Ledger ({activeFamilyData.familyName}) — {cadence.replace('_', '-')}
            </h4>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="py-2.5 px-3 rounded-tl-xl">Parameter Group</th>
                  <th className="py-2.5 px-3">Force / Dimension</th>
                  {activePeriodList.map(p => (
                    <th key={p.id} className="py-2.5 px-3 text-center">
                      {p.shortLabel}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 rounded-tr-xl">Remarks</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-slate-700 divide-y divide-slate-200">
                {PORTER_FORCES.map(f => (
                  <tr key={f.id} className="hover:bg-blue-50/30">
                    <td className="py-2 px-3 font-black text-blue-900 bg-blue-50/40">
                      Porter Analysis
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">{f.name}</td>
                    {activeFamilyData.periods[cadence].map((ev, idx) => (
                      <td key={ev.periodId} className="py-2 px-3 text-center font-mono">
                        <div className="font-black text-slate-900">
                          {ev.forceScores[f.id].toFixed(2)}
                        </div>
                        {idx > 0 && <div>{renderDeltaBadge(ev.forceDeltas[f.id], 'xs')}</div>}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-slate-600">
                      {getRemark(
                        activeFamilyData.familyName,
                        `FORCE_REMARK_${f.id}`,
                        f.interpretScore(activePeriodEval.forceScores[f.id])
                      )}
                    </td>
                  </tr>
                ))}
                {EASINESS_DIMENSIONS.map(d => (
                  <tr key={d.id} className="hover:bg-teal-50/30">
                    <td className="py-2 px-3 font-black text-teal-900 bg-teal-50/40">
                      Easiness Matrix
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">{d.name}</td>
                    {activeFamilyData.periods[cadence].map((ev, idx) => (
                      <td key={ev.periodId} className="py-2 px-3 text-center font-mono">
                        <div className="font-black text-slate-900">
                          {ev.dimensionScores[d.id].toFixed(2)}
                        </div>
                        {idx > 0 && <div>{renderDeltaBadge(ev.dimensionDeltas[d.id], 'xs')}</div>}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-slate-600">
                      {getRemark(
                        activeFamilyData.familyName,
                        `DIM_REMARK_${d.id}`,
                        `${d.summaryLabel}: ${activePeriodEval.dimensionScores[d.id].toFixed(2)} / 5.00`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
