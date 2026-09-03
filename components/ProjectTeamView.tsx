import React, { useMemo, useState } from 'react';
import { ProjectData, Employee, FiscalYear } from '../types';
import { SKILL_ORDER, SKILL_MAPPING, normalizeSkill } from '../constants';
import { Users, User as UserIcon, Eye, EyeOff } from 'lucide-react';

interface ProjectTeamViewProps {
  project: ProjectData;
  employees: Employee[];
  selectedFY: FiscalYear;
  projects: ProjectData[];
  mode?: string;
}

const ProjectTeamView: React.FC<ProjectTeamViewProps> = ({ project, employees, selectedFY, projects, mode }) => {
  const [showData, setShowData] = useState(true);

  // Determine year range
  let fyStartYear = 2019;
  if (selectedFY && selectedFY !== 'All FY') {
    const parts = selectedFY.split(' ');
    if (parts.length > 1) {
      const yearPart = parts[1].split('-')[0];
      fyStartYear = parseInt(yearPart) + 2000;
    }
  } else if (!selectedFY) {
    fyStartYear = 2025;
  }
  const yearOffset = selectedFY === 'All FY' ? 0 : (fyStartYear - 2019) * 12;
  const yearLimit = selectedFY === 'All FY' ? 144 : 12;

  const getProjectEmployeeSkills = (p: any) => {
    const empSkillsKey = mode === 'Actuals' ? 'actualsEmployeeSkills' : (mode === 'Forecast' ? 'forecastEmployeeSkills' : 'employeeSkills');
    return p[empSkillsKey] || (mode === 'Budget' ? p.employeeSkills : {});
  };

  const teamData = useMemo(() => {
    const result: Record<string, string[]> = {};
    const allSkills = new Set([...SKILL_ORDER, 'Contracted Employee']);
    
    // Add skills from project data
    const pSkills = getProjectEmployeeSkills(project);
    if (pSkills) {
      Object.keys(pSkills).forEach(rawSkill => {
        allSkills.add(normalizeSkill(rawSkill));
      });
    }
    if (project.employeeInfo) {
      Object.values(project.employeeInfo).forEach(info => {
        if (info.skill) allSkills.add(normalizeSkill(info.skill));
      });
    }

    allSkills.forEach(skill => {
      const assignedEmails = new Set<string>();
      
      // Check employeeSkills in project
      if (pSkills) {
        Object.entries(pSkills).forEach(([rawSkill, emailMap]) => {
          const mappedSkill = normalizeSkill(rawSkill);
          if (mappedSkill === skill) {
            Object.entries(emailMap as Record<string, any>).forEach(([email, allocations]) => {
              const allocationsArray = Array.isArray(allocations) ? 
                (allocations.length < 144 ? [...allocations, ...new Array(144 - allocations.length).fill(0)] : allocations) : 
                (allocations && typeof allocations === 'object' ? 
                 Object.entries(allocations).reduce((acc: number[], [k, v]) => {
                   const idx = parseInt(k);
                   if (!isNaN(idx) && idx >= 0 && idx < 144) acc[idx] = Number(v) || 0;
                   return acc;
                 }, new Array(144).fill(0)) : new Array(144).fill(0));
              
              const fyAllocations = allocationsArray.slice(yearOffset, yearOffset + yearLimit);
              const hasAllocation = fyAllocations.some(a => a > 0);
              if (hasAllocation) {
                assignedEmails.add(email.toLowerCase());
              }
            });
          }
        });
      }

      // Check employeeInfo as fallback or additional source
      if (project.employeeInfo) {
        Object.entries(project.employeeInfo).forEach(([email, info]) => {
          if (info) {
            let empSkill = info.skill;
            const globalEmp = employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
            if ((!empSkill || empSkill === 'Unspecified Skill') && globalEmp && globalEmp.skill && globalEmp.skill !== 'Unspecified Skill') {
              empSkill = globalEmp.skill;
            }
            if (empSkill) {
              const mappedSkill = normalizeSkill(empSkill);
              if (mappedSkill === skill) {
                assignedEmails.add(email.toLowerCase());
              }
            }
          }
        });
      }

      if (assignedEmails.size > 0) {
        result[skill] = Array.from(assignedEmails).map(email => {
          const emp = employees.find(e => e.email?.toLowerCase() === email);
          return emp ? emp.name : email;
        });
      }
    });

    return result;
  }, [project, employees, yearOffset, yearLimit, mode]);

  const skillsWithTeam = useMemo(() => {
    const skills = Object.keys(teamData);
    return skills.sort((a, b) => {
      const indexA = SKILL_ORDER.indexOf(a);
      const indexB = SKILL_ORDER.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [teamData]);

  // Calculate total
  const totalEmployees = useMemo(() => {
    let count = 0;
    Object.values(teamData).forEach(members => { count += members.length; });
    return count;
  }, [teamData]);

  if (skillsWithTeam.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-100">
        <Users className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-[9px]">No team members assigned to this project in {selectedFY}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-fadeIn">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Project Team</h3>
        <button onClick={() => setShowData(!showData)} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
          {showData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-1/4">Skill / Role</th>
              <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-24">Count</th>
              <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {skillsWithTeam.map((skill, index) => (
              <tr key={skill} className={`${index % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'} hover:bg-slate-100/50 transition-colors`}>
                <td className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-tight border-r border-slate-100 ${skill === 'Contracted Employee' ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {skill.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-2.5 border-r border-slate-100 text-[10px] font-bold text-slate-600">
                    {teamData[skill].length}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                      {teamData[skill].map((member, idx) => {
                        const pSkills = getProjectEmployeeSkills(project);
                        const email = Object.keys(project.employeeInfo || {}).find(e => project.employeeInfo![e].name === member) || 
                                      Object.keys(pSkills || {}).flatMap(s => Object.keys(pSkills![s])).find(e => employees.find(emp => emp.email === e)?.name === member);
                        
                        let memberHours = 0;
                        let memberTotalHours = 0;
                        
                        if (email) {
                          const emp = employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
                          
                          // Project hours
                          if (pSkills) {
                            Object.values(pSkills).forEach(skillMap => {
                              if (skillMap[email]) {
                                const allocs = Array.isArray(skillMap[email]) ? skillMap[email] : [];
                                memberHours += allocs.reduce((a, b) => a + (Number(b) || 0), 0) * 180;
                              }
                            });
                          }
                          
                          // Total hours across all projects
                          if (emp) {
                             memberTotalHours = projects.reduce((total, p) => {
                                let pHours = 0;
                                const otherPSkills = getProjectEmployeeSkills(p);
                                if (otherPSkills) {
                                  Object.values(otherPSkills).forEach(skillMap => {
                                    if (skillMap[email]) {
                                      const allocs = Array.isArray(skillMap[email]) ? skillMap[email] : [];
                                      pHours += allocs.reduce((a, b) => a + (Number(b) || 0), 0) * 180;
                                    }
                                  });
                                }
                                return total + pHours;
                             }, 0);
                          }
                        }

                        const percentage = memberTotalHours > 0 ? (memberHours / memberTotalHours) * 100 : 0;

                        return (
                          <div 
                            key={idx} 
                            className="flex flex-col gap-1 px-2 py-1 bg-white rounded-md border border-slate-200 group hover:border-indigo-200 hover:bg-indigo-50 transition-all min-w-[100px]"
                          >
                             <div className="flex items-center gap-1.5">
                               <UserIcon className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-500" />
                               <span className="text-[9px] font-bold text-slate-600 group-hover:text-indigo-700">{member}</span>
                             </div>
                             {showData && (
                                <div className="text-[8px] text-slate-500 font-medium">
                                   {Math.round(memberHours)} hrs ({percentage.toFixed(0)}%)
                                </div>
                             )}
                          </div>
                        );
                      })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
                <td className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-700">Total</td>
                <td className="px-4 py-2.5 text-[10px] font-black text-slate-900 border-r border-slate-100">{totalEmployees}</td>
                <td className="px-4 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ProjectTeamView;
