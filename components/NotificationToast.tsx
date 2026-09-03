
import React from 'react';

export const NotificationToast: React.FC<{ 
  notification: { message: string, type: 'success' | 'error' | 'info' | 'conflict' } | null, 
  onClose: () => void, 
  onResolve?: () => void
}> = ({ notification, onClose, onResolve }) => {
  if (!notification) return null;
  const colors = { success: 'bg-emerald-600 text-white', error: 'bg-red-600 text-white', info: 'bg-indigo-600 text-white', conflict: 'bg-amber-600 text-white' };
  return (
    <div className="fixed bottom-8 left-4 right-4 sm:left-auto sm:right-8 z-[5000] animate-fadeIn">
      <div className={`${colors[notification.type]} px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 w-full sm:min-w-[350px]`}>
        <div className="flex-grow">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{notification.type}</p>
          <p className="text-xs font-bold leading-tight uppercase tracking-tight">{notification.message}</p>
          {notification.type === 'conflict' && <button onClick={onResolve} className="mt-3 bg-white text-amber-700 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-amber-50 transition-all">Merge with Cloud</button>}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-black/20 rounded-full transition-colors shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
    </div>
  );
};
