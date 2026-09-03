
import React, { useState } from 'react';
import { MasterConfigState, ProjectStatus, PROJECT_STATUS_OPTIONS } from '../types';
import { ModalLabel, ModalInput, ModalSelect } from './ModalUtils';

export const AddProjectModal = ({ isOpen, onClose, onConfirm, config, allowedVerticals, months }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (p: any) => void, 
  config: MasterConfigState, 
  allowedVerticals: string[],
  months: string[]
}) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    vertical: allowedVerticals?.[0] || '',
    productFamily: config.productFamilies?.[0] || 'NA',
    category: config.projectCategories?.[0] || 'New',
    buDomain: config.buDomains?.[0] || 'ACS',
    businessUnit: config.businessUnits?.[0] || 'NA',
    projectType: config.projectTypes?.[0] || 'NA',
    pace: config.paces?.[0] || 'NA',
    segment: config.segments?.[0] || 'NA',
    customer: '',
    pdh: '',
    sopMonth: months?.[0] || 'Apr',
    sopFyYear: 'FY 25',
    status: '-' as ProjectStatus,
    currentGate: 'TBD'
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col my-8">
        <div className="bg-indigo-600 px-6 sm:px-10 py-6 sm:py-8 text-white flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight">ADD PROJECT</h3>
            <p className="text-[10px] font-black opacity-70 uppercase mt-1 tracking-widest">INITIALIZE NEW REGISTRY PROJECT</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3.5"/></svg>
          </button>
        </div>
        
        <div className="p-6 sm:p-10 space-y-6 flex-grow bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <ModalLabel required>PROJECT ID</ModalLabel>
              <ModalInput value={formData.code} onChange={(e: any) => setFormData({...formData, code: e.target.value})} placeholder="E.G. UMD-207" />
            </div>
            <div className="space-y-1">
              <ModalLabel required>PROJECT NAME</ModalLabel>
              <ModalInput value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} placeholder="ENTER PROJECT NAME" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <ModalLabel required>VERTICAL</ModalLabel>
              <ModalSelect value={formData.vertical} onChange={(e: any) => setFormData({...formData, vertical: e.target.value})}>
                {allowedVerticals?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>CATEGORY</ModalLabel>
              <ModalSelect value={formData.category} onChange={(e: any) => setFormData({...formData, category: e.target.value})}>
                {config.projectCategories?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>PRODUCT FAMILY</ModalLabel>
              <ModalSelect value={formData.productFamily} onChange={(e: any) => setFormData({...formData, productFamily: e.target.value})}>
                {config.productFamilies?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <ModalLabel>DOMAIN</ModalLabel>
              <ModalSelect value={formData.buDomain} onChange={(e: any) => setFormData({...formData, buDomain: e.target.value})}>
                {config.buDomains?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>BUSINESS UNIT</ModalLabel>
              <ModalSelect value={formData.businessUnit} onChange={(e: any) => setFormData({...formData, businessUnit: e.target.value})}>
                {config.businessUnits?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>PDH</ModalLabel>
              <ModalInput value={formData.pdh} onChange={(e: any) => setFormData({...formData, pdh: e.target.value})} placeholder="ENTER PDH NAME" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <ModalLabel>TYPE</ModalLabel>
              <ModalSelect value={formData.projectType} onChange={(e: any) => setFormData({...formData, projectType: e.target.value})}>
                {config.projectTypes?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>CUSTOMER</ModalLabel>
              <div className="relative">
                <input list="customer-list" className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs placeholder:text-slate-300" value={formData.customer} onChange={(e: any) => setFormData({...formData, customer: e.target.value})} placeholder="SEARCH CUSTOMER" />
                <datalist id="customer-list">
                  {config.customers?.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <ModalLabel>PACE</ModalLabel>
              <ModalSelect value={formData.pace} onChange={(e: any) => setFormData({...formData, pace: e.target.value})}>
                {config.paces?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>SEGMENT</ModalLabel>
              <ModalSelect value={formData.segment} onChange={(e: any) => setFormData({...formData, segment: e.target.value})}>
                {config.segments?.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </ModalSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <ModalLabel>SOP MONTH</ModalLabel>
              <ModalSelect value={formData.sopMonth} onChange={(e: any) => setFormData({...formData, sopMonth: e.target.value})}>
                {Array.from(new Set(months?.map(m => m.split('-')[0]) || [])).map(m => <option key={m} value={m}>{m}</option>)}
              </ModalSelect>
            </div>
            <div className="space-y-1">
              <ModalLabel>SOP YEAR</ModalLabel>
              <ModalInput value={formData.sopFyYear} onChange={(e: any) => setFormData({...formData, sopFyYear: e.target.value})} placeholder="FY 25" />
            </div>
            <div className="space-y-1">
              <ModalLabel>STATUS</ModalLabel>
              <ModalSelect value={formData.status} onChange={(e: any) => setFormData({...formData, status: e.target.value})}>
                {PROJECT_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </ModalSelect>
            </div>
          </div>
        </div>
        
        <div className="p-6 sm:p-10 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4 shrink-0">
          <button onClick={onClose} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">CANCEL</button>
          <button 
            onClick={() => onConfirm(formData)} 
            className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            CONFIRM INITIALIZATION
          </button>
        </div>
      </div>
    </div>
  );
};
