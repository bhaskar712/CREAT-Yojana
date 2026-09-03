
import React from 'react';
import { DeletionTarget } from '../types';

export const DeletionConfirmationModal = ({ target, onClose, onConfirm }: { 
  target: DeletionTarget | null, 
  onClose: () => void, 
  onConfirm: () => void 
}) => {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col">
        <div className="bg-[#e31e24] px-8 py-5 text-white shrink-0">
          <h3 className="text-lg font-black uppercase tracking-tight leading-none">Confirm Deletion</h3>
          <p className="text-[9px] font-black opacity-80 uppercase mt-1.5 tracking-[0.2em]">Permanent System Purge</p>
        </div>
        <div className="px-8 py-10 bg-white">
          <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight">
            {target.type === 'projects' ? (
              <>Are you sure you want to <span className="text-[#e31e24] font-black">PURGE ALL PROJECTS</span> from the registry? This action is irreversible and will wipe all data.</>
            ) : target.type === 'employees' ? (
              <>Are you sure you want to <span className="text-[#e31e24] font-black">PURGE ALL RESOURCES</span> from the inventory? This action is irreversible.</>
            ) : (
              <>Are you sure you want to delete the {target.type} <span className="text-[#e31e24] font-black">"{target.name}"</span>? This action is irreversible.</>
            )}
          </p>
        </div>
        <div className="px-8 py-5 bg-[#f8fafc] border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <button onClick={onClose} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors order-2 sm:order-1">Abort</button>
          <button 
            onClick={onConfirm} 
            className="w-full sm:w-auto bg-[#e31e24] text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all order-1 sm:order-2"
          >
            Confirm Purge
          </button>
        </div>
      </div>
    </div>
  );
};
