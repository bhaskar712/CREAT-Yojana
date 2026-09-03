
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg', onClick?: () => void }> = ({ size = 'md', onClick }) => {
  const navigate = useNavigate();
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/');
    }
  };

  return (
    <div onClick={handleClick} className={`${isLarge ? 'flex flex-col items-center' : 'flex items-center space-x-2'} select-none transition-all cursor-pointer hover:opacity-80`}>
      <div className={`${isLarge ? 'w-24 h-24 mb-6' : isSmall ? 'w-6 h-6' : 'w-7 h-7'} relative shrink-0`}>
        <div className="absolute inset-0 bg-[#001e3c] rounded-[1.25rem] shadow-2xl flex items-center justify-center overflow-hidden border border-white/10">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4/5 h-4/5">
            <rect x="25" y="55" width="7" height="20" fill="white" opacity="0.2" />
            <rect x="37" y="45" width="7" height="30" fill="white" opacity="0.2" />
            <rect x="49" y="55" width="7" height="20" fill="white" opacity="0.2" />
            <path d="M72 25L84 37M72 25L60 37M72 25V75" stroke="#f97316" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className={`${isLarge ? 'flex flex-col items-center' : 'flex items-center'} leading-none`}>
        <div className="flex items-center">
          <span className={`${isLarge ? 'text-5xl' : 'text-base'} font-black text-[#1a1a1a] tracking-tighter uppercase`}>CREAT</span>
          <span className={`${isLarge ? 'text-5xl' : 'text-base'} font-black text-[#f97316] tracking-tighter uppercase ml-1`}>YOJANA</span>
        </div>
        {isLarge && (
          <div className="mt-4 space-y-2 text-center">
            <p className="text-[14px] font-black text-slate-400 tracking-[0.3em] uppercase">AI-ASSISTED R&D PLANNING PLATFORM</p>
            <p className="text-[12px] font-black text-[#f97316] tracking-widest uppercase">CO-CREATED WITH AI</p>
          </div>
        )}
      </div>
    </div>
  );
};
