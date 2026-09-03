
import React from 'react';
import { Logo } from './Logo';
import { Footer } from './Footer';
import { User } from '../types';

interface LoginViewProps {
  loginForm: any;
  setLoginForm: (form: any) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  loginError: string | null;
  isLoginLoading: boolean;
  onSubmit: (username?: string, password?: string, rememberMe?: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (remember: boolean) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  loginForm,
  setLoginForm,
  showPassword,
  setShowPassword,
  loginError,
  isLoginLoading,
  onSubmit,
  rememberMe,
  setRememberMe
}) => {
  const [localUsername, setLocalUsername] = React.useState(loginForm.username || '');
  const [localPassword, setLocalPassword] = React.useState(loginForm.password || '');
  const [localRememberMe, setLocalRememberMe] = React.useState(rememberMe);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(localUsername, localPassword, localRememberMe);
  };

  return (
    <div className="h-screen w-screen bg-white flex flex-col font-['Inter'] overflow-hidden">
      <div className="flex-grow flex flex-col lg:flex-row h-full">
        <div className="lg:w-1/2 flex flex-col items-center justify-center p-12 text-center lg:border-r border-slate-50">
          <Logo size="lg" />
        </div>
        
        <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
          <div className="w-full max-md px-6">
            <form onSubmit={handleSubmit} className="space-y-10">
              
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-[0.2em] ml-1">USERNAME</label>
                <div className="relative group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2" /></svg>
                  </span>
                  <input 
                    type="text" 
                    placeholder="xyz@unominda.com" 
                    className="w-full bg-[#f0f7ff] border-none rounded-[1rem] py-4 pl-14 pr-8 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-[#94a3b8]/70" 
                    value={localUsername} 
                    onChange={e => setLocalUsername(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-[0.2em] ml-1">PASSWORD</label>
                <div className="relative group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2" /></svg>
                  </span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    className="w-full bg-[#f0f7ff] border-none rounded-[1rem] py-4 pl-14 pr-14 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-[#94a3b8]/70" 
                    value={localPassword} 
                    onChange={e => setLocalPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#001e3c] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L4.573 4.574m14.854 14.854L14.12 14.12M17.999 12a9.456 9.456 0 00-1.557-3.237m1.874 4.634c.496-1.017.776-2.14.776-3.397 0-4.478-3.79-7.523-8.268-7.523-1.32 0-2.585.31-3.702.86" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z M12 9a3 3 0 100 6 3 3 0 000-6z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-3 animate-shake">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2"/></svg>
                  <span>{loginError}</span>
                </div>
              )}

              <div className="flex items-center space-x-3 ml-1">
                <input 
                  type="checkbox" 
                  id="rememberMe" 
                  checked={localRememberMe} 
                  onChange={e => setLocalRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="rememberMe" className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">Remember Me</label>
              </div>

              <button 
                type="submit" 
                disabled={isLoginLoading} 
                className="w-full bg-[#111111] text-white py-5 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoginLoading ? 'AUTHENTICATING...' : 'LOGIN TO PORTAL'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};
