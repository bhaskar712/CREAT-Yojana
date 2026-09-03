
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-3 px-6 mt-auto shrink-0 w-full relative z-[1001]">
      <div className="w-full flex items-center justify-between">
        <div className="flex-1"></div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
          © 2026 CREAT YOJANA PORTAL | AN INITIATIVE OF CREAT BMMC | CO-CREATED WITH AI
        </p>
        <div className="flex-1 flex justify-end">
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100 shadow-xs">
            v1.4.1
          </span>
        </div>
      </div>
    </footer>
  );
};
