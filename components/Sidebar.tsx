import React from 'react';
import { Home, LayoutGrid, IndianRupee, Activity, Users, Settings, Info, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { AppTab } from '../types';
import { Logo } from './Logo';

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  activeTab: AppTab;
  updateContext: (tab: AppTab, mode?: any) => void;
  isAdmin: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onToggle, activeTab, updateContext, isAdmin }) => {
  const menuItems = [
    { id: AppTab.HOME, label: 'Home', icon: Home, desc: 'Enterprise Portal' },
    { id: AppTab.DCBA_PORTAL, label: 'DCBA Portal', icon: LayoutGrid, desc: 'Opportunity Tracker' },
    { id: AppTab.ENTRY, label: 'Budget', icon: IndianRupee, desc: 'Financial Planning', mode: 'Budget' },
    { id: AppTab.PMO, label: 'PMO', icon: Activity, desc: 'Actuals Sync Engine' },
    { id: AppTab.MASTER_PROJECTS, label: 'Master Projects', icon: List, desc: 'Project Registry' },
    { id: AppTab.HR_RESOURCES, label: 'Resources', icon: Users, desc: 'Org Inventory' },
    { id: AppTab.SEAT_ALLOCATION, label: 'Seat Allocation', icon: LayoutGrid, desc: 'Deskify Tool' },
    { id: AppTab.CONFIG, label: 'Configuration', icon: Settings, desc: 'System Settings', visible: isAdmin },
    { id: AppTab.ABOUT, label: 'About', icon: Info, desc: 'Portal Info' }
  ];

  return (
    <div className={`bg-white border-r border-slate-200 transition-all duration-300 h-screen flex flex-col ${isExpanded ? 'w-64' : 'w-20'}`}>
        <div className="h-6 shrink-0" />

        <nav className="flex-1 py-4 flex flex-col gap-2">
            {menuItems.filter(item => item.visible !== false).map(item => (
                <button
                    key={item.id}
                    onClick={() => updateContext(item.id, item.mode)}
                    className={`flex items-center px-6 py-4 hover:bg-indigo-50 transition-colors group ${activeTab === item.id ? 'bg-indigo-50 border-r-4 border-indigo-600' : ''}`}
                    title={!isExpanded ? item.label : undefined}
                >
                    <item.icon className={`w-6 h-6 shrink-0 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-500 group-hover:text-indigo-600'}`} />
                    {isExpanded && (
                        <div className="ml-4 flex flex-col items-start min-w-0 flex-1 overflow-hidden text-left">
                            <span className={`text-[12px] font-black uppercase tracking-widest truncate w-full ${activeTab === item.id ? 'text-indigo-700' : 'text-slate-800'}`}>{item.label}</span>
                            <span className="text-[10px] font-bold text-slate-400 capitalize truncate w-full">{item.desc}</span>
                        </div>
                    )}
                </button>
            ))}
        </nav>

        <button onClick={onToggle} className="h-16 border-t border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            {isExpanded ? <ChevronLeft className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
        </button>
    </div>
  );
};
