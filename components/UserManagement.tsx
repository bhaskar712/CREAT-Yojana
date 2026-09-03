
import React, { useState } from 'react';
import { User, UserRole, VERTICALS, AccessLevel, generateUUID } from '../types';

interface UserManagementProps {
  users: User[];
  onUpdate: (users: User[]) => void;
  onDelete: (id: string, name: string) => void;
  onlineUserIds: string[];
}

const ROLE_OPTIONS: { value: UserRole, label: string }[] = [
  { value: 'Super Admin', label: 'Super Admin (System Owner)' },
  { value: 'Admin', label: 'Admin (Regional Controller)' },
  { value: 'NA', label: 'NA (Vertical Associate)' }
];

const ACCESS_LEVELS: AccessLevel[] = ['None', 'Viewer', 'Editor'];

const UserManagement: React.FC<UserManagementProps> = ({ users, onUpdate, onDelete, onlineUserIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = () => {
    if (!editingUser?.username || !editingUser?.role) return alert("Missing required fields");
    
    const perms = editingUser.verticalPermissions || { 'Global': 'None' };

    if (editingUser.id) {
      const originalUser = users.find(u => u.id === editingUser.id);
      const finalPassword = editingUser.password || originalUser?.password;
      
      onUpdate(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        ...(editingUser as User), 
        password: finalPassword,
        verticalPermissions: perms,
        status: editingUser.status || 'Active'
      } : u));
    } else {
      if (!editingUser.password) return alert("A security key is required for new users.");
      
      const newUser: User = {
        ...(editingUser as User),
        id: generateUUID(),
        status: editingUser.status || 'Active',
        lastLogin: 'Never',
        assignedVerticals: [], 
        verticalPermissions: perms,
        email: editingUser.email || `${editingUser.username}@company.com`
      };
      onUpdate([...users, newUser]);
    }
    setIsModalOpen(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const updatePermission = (v: string, level: AccessLevel) => {
    const current = { ...(editingUser?.verticalPermissions || {}) };
    current[v] = level;
    
    if (v === 'Global') {
      if (level === 'Editor') {
        VERTICALS.forEach(vert => current[vert] = 'Editor');
      } else if (level === 'Viewer') {
        VERTICALS.forEach(vert => {
          if (!current[vert] || current[vert] === 'None') current[vert] = 'Viewer';
        });
      } else if (level === 'None') {
        VERTICALS.forEach(vert => current[vert] = 'None');
      }
    }

    setEditingUser({ ...editingUser, verticalPermissions: current });
  };

  const getPermissionSummary = (user: User) => {
    if (user.role === 'Super Admin' || user.role === 'Admin') return 'SYSTEM-WIDE ACCESS';
    const globalPerm = user.verticalPermissions?.['Global'] || 'None';
    if (globalPerm !== 'None') return `GLOBAL ${globalPerm.toUpperCase()}`;
    const activeVerts = Object.entries(user.verticalPermissions || {})
      .filter(([key, val]) => key !== 'Global' && val !== 'None');
    if (activeVerts.length === 0) return 'NO ACCESS';
    if (activeVerts.length === 1 && activeVerts[0]) return activeVerts[0][0].toUpperCase();
    return `${activeVerts.length} VERTICALS ACTIVE`;
  };

  const isUserOnline = (user: User) => onlineUserIds.includes(user.id);
  const activeNowCount = onlineUserIds.length;
  const isFullAdmin = editingUser?.role === 'Super Admin' || editingUser?.role === 'Admin';

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase">Identity Governance</h2>
            <div className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-sm">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">{activeNowCount} ACTIVE NOW</span>
            </div>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Manage System Profiles & Permissions</p>
        </div>
        <button 
          onClick={() => { setEditingUser({ role: 'NA', status: 'Active', verticalPermissions: { 'Global': 'None' }, password: '', hasResourceAccess: false }); setIsModalOpen(true); }}
          className="bg-[#1a1a1a] text-white text-[10px] font-black uppercase px-10 py-4 rounded-[1.25rem] shadow-2xl hover:bg-black transition-all"
        >
          Create New Identity
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-6 border-b border-slate-100">Operational Identity</th>
                <th className="px-8 py-6 border-b border-slate-100">Profile Role</th>
                <th className="px-8 py-6 border-b border-slate-100">Access Protocol</th>
                <th className="px-8 py-6 border-b border-slate-100 text-center">Status</th>
                <th className="px-8 py-6 border-b border-slate-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(user => {
                const online = isUserOnline(user);
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group h-20">
                    <td className="px-8 py-2">
                      <div className="flex items-center space-x-4">
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${user.status === 'Active' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          {online && (
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-black leading-tight truncate ${user.status === 'Inactive' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{user.username}</span>
                            {online && <span className="text-[7px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-xs">Online</span>}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-2">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider whitespace-nowrap leading-none ${
                          user.role === 'Super Admin' ? 'bg-slate-900 text-white shadow-sm' : 
                          user.role === 'Admin' ? 'bg-[#001e3c] text-blue-100 shadow-sm' : 
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {user.role === 'NA' ? 'ASSOCIATE' : user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-2">
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase ${
                          user.role.includes('Admin') ? 'text-indigo-600' : 
                          getPermissionSummary(user).includes('NO ACCESS') ? 'text-slate-300' : 'text-indigo-500'
                        }`}>
                          {getPermissionSummary(user)}
                        </span>
                        {user.hasResourceAccess && (
                          <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter mt-0.5">HR/RESOURCES ENABLED</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-2">
                      <div className="flex items-center justify-center">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                          user.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100 opacity-60'
                        }`}>
                          {user.status === 'Active' ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-2 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => { setEditingUser({ ...user }); setIsModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5" /></svg></button>
                        <button onClick={() => onDelete(user.id, user.username)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" strokeWidth="2.5" /></svg></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-fadeIn overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-10 pt-10 pb-6 shrink-0 bg-slate-50 border-b border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Entity Protocol Setup</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure structural role & domain access matrix</p>
                </div>
                <button onClick={() => { setIsModalOpen(false); setShowPassword(false); }} className="p-2 text-slate-300 hover:text-slate-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg></button>
              </div>
            </div>
            
            <div className="px-10 py-8 space-y-8 overflow-y-auto no-scrollbar flex-grow">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Authentication Identity</h4>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Username (Email/ID)</label>
                    <input type="text" placeholder="e.g. bpaul" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={editingUser?.username || ''} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Key (Security)</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} placeholder="••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 pr-12 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={editingUser?.password || ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} />
                      <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L4.573 4.574m14.854 14.854L14.12 14.12M17.999 12a9.456 9.456 0 00-1.557-3.237m1.874 4.634c.496-1.017.776-2.14.776-3.397 0-4.478-3.79-7.523-8.268-7.523-1.32 0-2.585.31-3.702.86" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Profile Role</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={editingUser?.role || 'NA'} onChange={e => {
                      const role = e.target.value as UserRole;
                      const hasAccess = (role === 'Super Admin' || role === 'Admin');
                      setEditingUser({ ...editingUser, role, hasResourceAccess: hasAccess });
                    }}>
                      {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Status</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={editingUser?.status || 'Active'} onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })}>
                      <option value="Active">Operational (Active)</option>
                      <option value="Inactive">Deactivated (Locked)</option>
                    </select>
                  </div>
                </div>
                {/* New Resource Access Toggle */}
                <div className="pt-2">
                  <label className="flex items-center space-x-3 cursor-pointer group w-fit">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={editingUser?.hasResourceAccess || false}
                        onChange={(e) => setEditingUser({ ...editingUser, hasResourceAccess: e.target.checked })}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${editingUser?.hasResourceAccess ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${editingUser?.hasResourceAccess ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Resource Inventory Access</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Enable HR Management & Org Tree visibility</span>
                    </div>
                  </label>
                </div>
              </div>

              {!isFullAdmin && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Domain Access Matrix</h4>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-[10px] font-black text-slate-900 uppercase">Global Clearance Level</span>
                      <div className="flex space-x-1">
                        {ACCESS_LEVELS.map(level => (
                          <button key={level} onClick={() => updatePermission('Global', level)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${editingUser?.verticalPermissions?.['Global'] === level ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200'}`}>{level}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {VERTICALS.map(v => (
                        <div key={v} className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-500 uppercase">{v}</span>
                          <div className="flex space-x-1">
                            {ACCESS_LEVELS.map(level => (
                              <button key={level} onClick={() => updatePermission(v, level)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${editingUser?.verticalPermissions?.[v] === level ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200'}`}>{level}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-10 py-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button onClick={() => { setIsModalOpen(false); setShowPassword(false); }} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancel</button>
              <button onClick={handleSave} className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Commit Identity</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
