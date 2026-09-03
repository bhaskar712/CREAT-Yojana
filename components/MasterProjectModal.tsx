import React, { useState } from 'react';
import { MasterConfigState, ProjectStatus, PROJECT_STATUS_OPTIONS, MasterProject, FiscalYear } from '../types';
import { ModalLabel, ModalInput, ModalSelect } from './ModalUtils';

export const MasterProjectModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  config, 
  allowedVerticals,
  project 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (p: any) => void, 
  config: MasterConfigState, 
  allowedVerticals: string[],
  project?: MasterProject
}) => {
  const [formData, setFormData] = useState(project || {
    id: '',
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
    status: '-' as ProjectStatus,
    startDate: '',
    applicableFYs: [] as FiscalYear[]
  });

  React.useEffect(() => {
    if (project) {
        setFormData(project);
    } else {
        setFormData({
            id: '',
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
            status: '-' as ProjectStatus,
            startDate: '',
            applicableFYs: [] as FiscalYear[]
        });
    }
  }, [project, allowedVerticals, config]);

  if (!isOpen) return null;

  const fyOptions: FiscalYear[] = [
    'FY 19-20', 'FY 20-21', 'FY 21-22', 'FY 22-23', 'FY 23-24', 
    'FY 24-25', 'FY 25-26', 'FY 26-27', 'FY 27-28', 'FY 28-29', 'FY 29-30', 'FY 30-31'
  ];

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col my-8">
        <div className="bg-indigo-600 px-6 sm:px-10 py-6 sm:py-8 text-white flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight">{project ? 'EDIT PROJECT' : 'ADD PROJECT'}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3.5"/></svg>
          </button>
        </div>
        
        <div className="p-6 sm:p-10 space-y-6 flex-grow bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1"> <ModalLabel required>PROJECT CODE</ModalLabel> <ModalInput value={formData.code} onChange={(e: any) => setFormData({...formData, code: e.target.value})} /> </div>
            <div className="space-y-1"> <ModalLabel required>PROJECT NAME</ModalLabel> <ModalInput value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} /> </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1"> <ModalLabel>PRODUCT FAMILY</ModalLabel> <ModalSelect value={formData.productFamily} onChange={(e: any) => setFormData({...formData, productFamily: e.target.value})}> {config.productFamilies?.map(v => <option key={v} value={v}>{v}</option>)} </ModalSelect> </div>
            <div className="space-y-1"> <ModalLabel>DOMAIN</ModalLabel> <ModalSelect value={formData.buDomain} onChange={(e: any) => setFormData({...formData, buDomain: e.target.value})}> {config.buDomains?.map(v => <option key={v} value={v}>{v}</option>)} </ModalSelect> </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1"> <ModalLabel>VERTICAL</ModalLabel> <ModalSelect value={formData.vertical} onChange={(e: any) => setFormData({...formData, vertical: e.target.value})}> {allowedVerticals.map(v => <option key={v} value={v}>{v}</option>)} </ModalSelect> </div>
            <div className="space-y-1"> <ModalLabel>TYPE</ModalLabel> <ModalSelect value={formData.projectType} onChange={(e: any) => setFormData({...formData, projectType: e.target.value})}> {config.projectTypes?.map(v => <option key={v} value={v}>{v}</option>)} </ModalSelect> </div>
            <div className="space-y-1"> <ModalLabel>PACE</ModalLabel> <ModalSelect value={formData.pace} onChange={(e: any) => setFormData({...formData, pace: e.target.value})}> {config.paces?.map(v => <option key={v} value={v}>{v}</option>)} </ModalSelect> </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1"> <ModalLabel>STATUS</ModalLabel> <ModalSelect value={formData.status} onChange={(e: any) => setFormData({...formData, status: e.target.value})}> {PROJECT_STATUS_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)} </ModalSelect> </div>
            <div className="space-y-1"> <ModalLabel>START DATE</ModalLabel> <ModalInput type="date" value={formData.startDate} onChange={(e: any) => setFormData({...formData, startDate: e.target.value})} /> </div>
          </div>
           <div className="space-y-1">
            <ModalLabel>APPLICABLE FYs</ModalLabel>
            <div className="flex flex-wrap gap-2">
              {fyOptions.map(fy => (
                <button 
                  key={fy} 
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev, 
                    applicableFYs: prev.applicableFYs.includes(fy) ? prev.applicableFYs.filter(f => f !== fy) : [...prev.applicableFYs, fy]
                  }))}
                  className={`px-3 py-1 text-xs rounded ${formData.applicableFYs.includes(fy) ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}
                >
                  {fy}
                </button>
              ))}
            </div>
           </div>
        </div>
        
        <div className="p-6 sm:p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
          <button onClick={onClose} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">CANCEL</button>
          <button onClick={() => onConfirm(formData)} className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">CONFIRM</button>
        </div>
      </div>
    </div>
  );
};
