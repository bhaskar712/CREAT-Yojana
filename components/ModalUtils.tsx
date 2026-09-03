
import React from 'react';

export const ModalLabel = ({ children, required }: { children?: React.ReactNode, required?: boolean }) => (
  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

export const ModalInput = (props: any) => (
  <input {...props} className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs placeholder:text-slate-300" />
);

export const ModalSelect = (props: any) => (
  <select {...props} className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs" />
);
