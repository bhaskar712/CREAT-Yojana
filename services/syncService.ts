
import { ProjectData, MasterProject, User, MasterConfigState, AuditLogEntry, FiscalYear, Employee } from "../types";

const API_BASE = '/api';

const getApiUrl = (config: any, path: string) => {
  if (config?.url && config.url !== 'local') {
    let baseUrl = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    
    // If the user pasted a full API URL (e.g., https://domain.com/api/budgets), extract just the base
    const apiIndex = baseUrl.lastIndexOf('/api');
    if (apiIndex !== -1 && (apiIndex === baseUrl.length - 4 || baseUrl[apiIndex + 4] === '/')) {
      baseUrl = baseUrl.slice(0, apiIndex);
    }
    
    return `${baseUrl}${path}`;
  }
  // Standardize relative paths to ensure they resolve against the current origin
  return `${window.location.origin}${path}`;
};

const getHeaders = (config: any) => {
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  // Only add the sync key if it's explicitly configured and not the default 'local' or empty
  if (config?.key && config.key !== 'local' && config.key.trim() !== '') {
    headers['x-sync-key'] = config.key;
  }
  return headers;
};

const formatError = (err: any): string => {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return JSON.stringify(err);
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;
const subscribers = new Set<{ id: string, cb: (data: any) => void }>();
const clientId = Math.random().toString(36).substring(7);
let lastConfig: any = null;

export const getYearKey = (year: string, mode: string = 'Budget'): string => {
  if (!year || year === 'All FY') return 'global-budget-state';
  // If it's already a full ID, return it.
  if (/^(budget|actuals|forecast)-state-/.test(year) || year === 'global-budget-state' || year === 'global-resources') return year;
  
  const modeKey = mode.toLowerCase();
  return `${modeKey}-state-${year.replace(/\s+/g, '-').toLowerCase()}`;
};

const ensureSocket = (config: any) => {
  lastConfig = config;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let wsUrl: string;
  
  if (config?.url && config.url !== 'local') {
    wsUrl = config.url.replace(/^http/, 'ws');
    // Ensure wss if we are on https
    if (protocol === 'wss:' && wsUrl.startsWith('ws:')) {
      wsUrl = wsUrl.replace('ws:', 'wss:');
    }
    if (wsUrl.endsWith('/')) wsUrl = wsUrl.slice(0, -1);
    wsUrl = `${wsUrl}/ws`;
  } else {
    wsUrl = `${protocol}//${window.location.host}/ws`;
  }
  
  console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log(`✅ WebSocket connected to ${wsUrl}`);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'IDENTIFY', clientId }));
    }
  };

  socket.onerror = (error) => {
    console.error(`❌ WebSocket error for ${wsUrl}:`, error);
  };

  socket.onclose = () => {
    console.log(`🔌 WebSocket closed. Reconnecting in 5s...`);
    setTimeout(() => ensureSocket(config), 5000);
  };
  
  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.senderId === clientId) {
        return;
      }

      if (message.type === 'UPDATE') {
        let data = message.data;
        if (!data) {
          console.log(`🔄 Fetching update for ${message.id} due to large payload notification`);
          data = await syncService.loadFromServer(lastConfig, message.id, 'RAW_ID');
        }

        if (data) {
          subscribers.forEach(sub => {
            if (sub.id === message.id || sub.id === 'global-budget-state') {
              sub.cb(data);
            }
          });
        }
      } else if (message.type === 'BATCH_UPDATE') {
        console.log(`🔄 Handling BATCH_UPDATE for ${message.ids?.length} IDs`);
        const ids = message.ids || [];
        
        // We can't easily batch loadFromServer without a new endpoint, 
        // but we can at least process the global-budget-state separately if present
        for (const id of ids) {
          const data = await syncService.loadFromServer(lastConfig, id, 'RAW_ID');
          if (data) {
            subscribers.forEach(sub => {
              if (sub.id === id || sub.id === 'global-budget-state') {
                sub.cb(data);
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('WS Parse Error', e);
    }
  };
};

export const prunePayloadData = (data: any): any => {
  if (data === null || data === undefined) return undefined;
  
  if (typeof data === 'number' || typeof data === 'string' || typeof data === 'boolean') {
    return data;
  }
  
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'number') {
      const hasNonZero = data.some(v => typeof v === 'number' && Math.abs(v) > 0.00001);
      if (!hasNonZero) return undefined;
    }
    const cleanedArr = data.map(prunePayloadData).filter(x => x !== undefined);
    return cleanedArr.length > 0 ? cleanedArr : undefined;
  }
  
  if (typeof data === 'object') {
    const cleanedObj: Record<string, any> = {};
    let hasKeys = false;
    for (const [key, val] of Object.entries(data)) {
      if (['id', 'code', 'name', 'status', 'email', 'category', 'vertical', 'description', 'key', 'type', 'empId', 'employeeId', 'employeeName', 'department', 'seatNumber', 'seatIndex'].includes(key)) {
        if (val !== undefined) {
          cleanedObj[key] = val;
          hasKeys = true;
        }
        continue;
      }
      if (['tempRawData', 'processorRawData', 'rawData', 'rawRows', 'allRawRows'].includes(key)) {
        continue;
      }
      const pruned = prunePayloadData(val);
      if (pruned !== undefined) {
        if (typeof pruned === 'object' && !Array.isArray(pruned) && Object.keys(pruned).length === 0) {
          continue;
        }
        cleanedObj[key] = pruned;
        hasKeys = true;
      }
    }
    return hasKeys ? cleanedObj : undefined;
  }
  
  return data;
};

export const compressPayload = async (dataObj: any): Promise<{ body: BodyInit; isGzip: boolean }> => {
  const jsonStr = JSON.stringify(dataObj);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
      const compressedBuffer = await new Response(stream).arrayBuffer();
      return { body: compressedBuffer, isGzip: true };
    } catch (err) {
      console.warn('Gzip compression failed, falling back to uncompressed JSON:', err);
    }
  }
  return { body: jsonStr, isGzip: false };
};

const postWithGzip = async (url: string, headers: Record<string, string>, payloadObj: any): Promise<Response> => {
  const { body, isGzip } = await compressPayload(payloadObj);
  const reqHeaders: Record<string, string> = {
    ...headers,
    'Content-Type': 'application/json'
  };
  if (isGzip) {
    reqHeaders['Content-Encoding'] = 'gzip';
  }
  return fetch(url, {
    method: 'POST',
    headers: reqHeaders,
    body
  });
};

export const syncService = {
  saveResources: async (
    config: any,
    employees: Employee[]
  ): Promise<{ success: boolean; timestamp: number }> => {
    const url = getApiUrl(config, `${API_BASE}/budgets`);
    console.log(`Saving resources to URL: ${url}`);
    const pruned = prunePayloadData({ employees }) || {};
    const response = await postWithGzip(url, getHeaders(config), { id: 'global-resources', data: pruned });

    if (!response.ok) {
      console.error(`Failed to save resources. Status: ${response.status}, URL: ${url}`);
      throw new Error('Failed to save resources');
    }
    return await response.json();
  },

  loadResources: async (
    config: any
  ): Promise<Employee[]> => {
    const url = getApiUrl(config, `${API_BASE}/budgets/global-resources`);
    const response = await fetch(url, {
      headers: getHeaders(config)
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to load resources');
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`API not available or invalid response format at ${url}. Returning empty resources.`);
      return [];
    }
    
    const result = await response.json();
    return result.data?.employees || [];
  },

  saveMasterProjects: async (
    config: any,
    masterProjects: MasterProject[]
  ): Promise<{ success: boolean; timestamp: number }> => {
    const url = getApiUrl(config, `${API_BASE}/budgets`);
    const pruned = prunePayloadData({ masterProjects }) || {};
    const response = await postWithGzip(url, getHeaders(config), { id: 'global-master-projects', data: pruned });

    if (!response.ok) {
      throw new Error('Failed to save master projects');
    }
    return await response.json();
  },

  loadMasterProjects: async (
    config: any
  ): Promise<MasterProject[]> => {
    const url = getApiUrl(config, `${API_BASE}/budgets/global-master-projects`);
    const response = await fetch(url, {
      headers: getHeaders(config)
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to load master projects');
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return [];
    
    const result = await response.json();
    return result.data?.masterProjects || [];
  },

  saveBatchToServer: async (
    config: any,
    items: { id: string, data: any }[]
  ): Promise<{ success: boolean; timestamp: number }> => {
    const url = getApiUrl(config, `${API_BASE}/budgets/batch`);
    const prunedItems = items.map(item => ({
      id: item.id,
      data: prunePayloadData(item.data) || {}
    }));
    const response = await postWithGzip(url, getHeaders(config), { items: prunedItems, senderId: clientId });

    if (!response.ok) throw new Error('Failed to save batch to server');
    return await response.json();
  },

  saveToServer: async (
    config: any,
    data: { 
      projects: ProjectData[], 
      masterProjects?: MasterProject[], 
      users: User[], 
      employees?: Employee[],
      masterConfig: MasterConfigState, 
      lastUpdated: number, 
      settings: any,
      history: AuditLogEntry[],
      processorFileName?: string,
      processorMode?: string
    },
    year: string = 'FY 26-27',
    mode: string = 'Budget'
  ): Promise<{ success: boolean; timestamp: number }> => {
    const documentId = getYearKey(year, mode);
    const url = getApiUrl(config, `${API_BASE}/budgets`);
    console.log(`Saving to server: ${documentId} at URL: ${url}`);
    
    // Prune data to optimize payload size and avoid 413 Request Entity Too Large
    const prunedData = prunePayloadData(data) || {};
    
    const response = await postWithGzip(url, getHeaders(config), { id: documentId, data: prunedData, senderId: clientId });

    if (!response.ok) {
      console.error(`Failed to save to server. Status: ${response.status}, URL: ${url}`);
      try {
        const text = await response.text();
        console.error(`Response body (non-JSON): ${text.substring(0, 500)}`);
      } catch (e) {}
      throw new Error('Failed to save to server');
    }
    try {
      return await response.json();
    } catch (err) {
      console.error('Failed to parse JSON response from saveToServer');
      try {
        const text = await response.text();
        console.error(`Raw response text: ${text.substring(0, 500)}`);
      } catch (e) {}
      throw err;
    }
  },

  loadFromServer: async (
    config: any, 
    yearOrYears: string | string[] = 'FY 25-26',
    mode: string = 'Budget'
  ): Promise<any> => {
    if (yearOrYears === 'All FY') {
      return await syncService.loadMultipleFromServer(config, null, mode);
    }
    
    if (Array.isArray(yearOrYears)) {
      if (yearOrYears.includes('All FY')) {
        return await syncService.loadMultipleFromServer(config, null, mode);
      }
      if (yearOrYears.length > 1) {
        return await syncService.loadMultipleFromServer(config, yearOrYears, mode);
      }
      yearOrYears = yearOrYears[0] || 'FY 25-26';
    }

    const documentId = mode === 'RAW_ID' ? (yearOrYears as string) : getYearKey(yearOrYears as string, mode);
    const url = getApiUrl(config, `${API_BASE}/budgets/${documentId}`);
    
    const maxRetries = 2;
    let lastError: any = null;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await fetch(url, {
              headers: getHeaders(config)
            });
            if (response.status === 404) return null;
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'No error body');
                throw new Error(`Load failed (${response.status}): ${errorText}`);
            }
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              console.warn(`API not available or invalid response format at ${url}. Returning null.`);
              return null;
            }
            
            const result = await response.json();
            return result.data;
        } catch (err) {
            lastError = err;
            if (i < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                continue;
            }
        }
    }
    throw lastError || new Error('Failed to load from server after retries');
  },

  loadMultipleFromServer: async (config: any, specificYears: string[] | null, mode: string = 'Budget'): Promise<any> => {
    const years = specificYears || [
      'FY 19-20', 'FY 20-21', 'FY 21-22', 'FY 22-23', 'FY 23-24', 'FY 24-25', 'FY 25-26', 
      'FY 26-27', 'FY 27-28', 'FY 28-29', 'FY 29-30', 'FY 30-31'
    ];
    
    const documentIds = years.map(year => getYearKey(year, mode));
    const url = getApiUrl(config, `${API_BASE}/budgets/batch-load`);
    
    let validResults: any[] = [];
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(config),
        body: JSON.stringify({ ids: documentIds })
      });
      
      if (response.ok) {
        const json = await response.json();
        if (json.data) {
          validResults = Object.values(json.data);
        }
      }
    } catch (err) {
      console.error('Batch load failed, falling back to sequential load', err);
    }

    if (validResults.length === 0) return null;

    // Merge projects
    const mergedProjectsMap: Record<string, any> = {};
    let latestMasterConfig = validResults[0].masterConfig;
    let latestUsers = validResults[0].users;
    let latestHistory = validResults[0].history;
    let maxLastUpdated = 0;

    validResults.forEach(data => {
      if (data.lastUpdated > maxLastUpdated) {
        maxLastUpdated = data.lastUpdated;
        if (data.masterConfig) latestMasterConfig = data.masterConfig;
        if (data.users) latestUsers = data.users;
        if (data.history) latestHistory = data.history;
      }

      (data.projects || []).forEach((p: any) => {
        if (!p.code) return;
        const code = p.code.toUpperCase();
        if (!mergedProjectsMap[code]) {
          mergedProjectsMap[code] = { ...p };
        } else {
          const existing = mergedProjectsMap[code];
          
          // Merge arrays
          existing.budgetFYs = Array.from(new Set([...(existing.budgetFYs || []), ...(p.budgetFYs || [])]));
          existing.actualsFYs = Array.from(new Set([...(existing.actualsFYs || []), ...(p.actualsFYs || [])]));
          existing.forecastFYs = Array.from(new Set([...(existing.forecastFYs || []), ...(p.forecastFYs || [])]));
          
          // Merge data objects
          const mergeData = (target: any, source: any) => {
            if (!source) return target;
            const result = { ...(target || {}) };
            Object.entries(source).forEach(([cat, data]: [string, any]) => {
              if (!result[cat]) result[cat] = new Array(144).fill(0); // MAX_MONTHS
              if (Array.isArray(data)) {
                data.forEach((val, i) => {
                  if (val && i < 144) result[cat][i] = val || result[cat][i] || 0;
                });
              } else if (data && typeof data === 'object') {
                Object.entries(data).forEach(([k, v]) => {
                  const idx = parseInt(k);
                  if (!isNaN(idx) && idx >= 0 && idx < 144 && v) {
                    result[cat][idx] = (v as number) || result[cat][idx] || 0;
                  }
                });
              }
            });
            return result;
          };
          
          existing.pmoRows = mergeData(existing.pmoRows, p.pmoRows);
          existing.actuals = mergeData(existing.actuals, p.actuals);
          existing.forecast = mergeData(existing.forecast, p.forecast);
          existing.rows = mergeData(existing.rows, p.rows);
          existing.skills = mergeData(existing.skills, p.skills);
          existing.expenses = mergeData(existing.expenses, p.expenses);
          existing.employeeBillableHours = mergeData(existing.employeeBillableHours, p.employeeBillableHours);
          existing.employeeNonBillableHours = mergeData(existing.employeeNonBillableHours, p.employeeNonBillableHours);
          existing.employeeIdleHours = mergeData(existing.employeeIdleHours, p.employeeIdleHours);
          
          existing.employeeInfo = { ...(existing.employeeInfo || {}), ...(p.employeeInfo || {}) };
          
          if (p.igGates && Array.isArray(p.igGates)) {
            if (!existing.igGates) existing.igGates = new Array(144).fill('');
            p.igGates.forEach((gate, i) => {
              if (gate && gate !== 'NA' && gate !== 'TBD' && i < 144) {
                existing.igGates[i] = gate;
              }
            });
          }

          if (p.remarks && Array.isArray(p.remarks)) {
            const existingRemarks = existing.remarks || [];
            const newRemarks = p.remarks.filter((r: any) => !existingRemarks.some((er: any) => er.timestamp === r.timestamp && er.userId === r.userId));
            existing.remarks = [...existingRemarks, ...newRemarks].sort((a, b) => a.timestamp - b.timestamp);
          }

          if (p.rowRemarks) {
            if (!existing.rowRemarks) existing.rowRemarks = {};
            Object.entries(p.rowRemarks).forEach(([cat, remarks]: [string, any]) => {
              if (Array.isArray(remarks)) {
                const existingRowRemarks = existing.rowRemarks[cat] || [];
                const newRowRemarks = remarks.filter((r: any) => !existingRowRemarks.some((er: any) => er.timestamp === r.timestamp && er.userId === r.userId));
                existing.rowRemarks[cat] = [...existingRowRemarks, ...newRowRemarks].sort((a, b) => a.timestamp - b.timestamp);
              }
            });
          }
          
          const mergeTaskInfoList = (targetList: any[], sourceList: any[]) => {
            const result = [...(targetList || [])];
            sourceList.forEach((sTask: any) => {
              const tTask = result.find((t: any) => t.name === sTask.name);
              if (tTask) {
                const mergeArray = (tArr: any, sArr: any) => {
                  const res = new Array(144).fill(0);
                  if (Array.isArray(tArr)) tArr.forEach((v: any, i: number) => { if (i < 144 && v) res[i] = v || res[i] || 0; });
                  else if (tArr && typeof tArr === 'object') Object.entries(tArr).forEach(([k, v]) => { const idx = parseInt(k); if (!isNaN(idx) && idx >= 0 && idx < 144 && v) res[idx] = (v as number) || res[idx] || 0; });
                  if (Array.isArray(sArr)) sArr.forEach((v: any, i: number) => { if (i < 144 && v) res[i] = v || res[i] || 0; });
                  else if (sArr && typeof sArr === 'object') Object.entries(sArr).forEach(([k, v]) => { const idx = parseInt(k); if (!isNaN(idx) && idx >= 0 && idx < 144 && v) res[idx] = (v as number) || res[idx] || 0; });
                  return res;
                };
                tTask.monthlyHours = mergeArray(tTask.monthlyHours, sTask.monthlyHours);
                tTask.monthlyAllocations = mergeArray(tTask.monthlyAllocations, sTask.monthlyAllocations);
              } else {
                result.push(sTask);
              }
            });
            return result;
          };

          if (p.projectTasks) {
            if (!existing.projectTasks) existing.projectTasks = {};
            Object.entries(p.projectTasks).forEach(([list, tasks]: [string, any]) => {
              existing.projectTasks[list] = mergeTaskInfoList(existing.projectTasks[list] || [], tasks);
            });
          }

          if (p.employeeTasks) {
            if (!existing.employeeTasks) existing.employeeTasks = {};
            Object.entries(p.employeeTasks).forEach(([email, listMap]: [string, any]) => {
              if (!existing.employeeTasks[email]) existing.employeeTasks[email] = {};
              Object.entries(listMap).forEach(([list, tasks]: [string, any]) => {
                existing.employeeTasks[email][list] = mergeTaskInfoList(existing.employeeTasks[email][list] || [], tasks);
              });
            });
          }

          if (p.employeeSkills) {
            if (!existing.employeeSkills) existing.employeeSkills = {};
            Object.entries(p.employeeSkills).forEach(([skill, emailMap]: [string, any]) => {
              if (!existing.employeeSkills![skill]) existing.employeeSkills![skill] = {};
              Object.entries(emailMap).forEach(([email, allocations]: [string, any]) => {
                if (!existing.employeeSkills![skill][email]) existing.employeeSkills![skill][email] = new Array(144).fill(0);
                if (Array.isArray(allocations)) {
                  allocations.forEach((val, i) => {
                    if (val && i < 144) existing.employeeSkills![skill][email][i] = (existing.employeeSkills![skill][email][i] || 0) + val;
                  });
                } else if (allocations && typeof allocations === 'object') {
                  Object.entries(allocations).forEach(([k, v]) => {
                    const idx = parseInt(k);
                    if (!isNaN(idx) && idx >= 0 && idx < 144 && v) {
                      existing.employeeSkills![skill][email][idx] = (existing.employeeSkills![skill][email][idx] || 0) + (v as number);
                    }
                  });
                }
              });
            });
          }

          if (p.actualsEmployeeSkills) {
            if (!existing.actualsEmployeeSkills) existing.actualsEmployeeSkills = {};
            Object.entries(p.actualsEmployeeSkills).forEach(([skill, emailMap]: [string, any]) => {
              if (!existing.actualsEmployeeSkills![skill]) existing.actualsEmployeeSkills![skill] = {};
              Object.entries(emailMap).forEach(([email, allocations]: [string, any]) => {
                if (!existing.actualsEmployeeSkills![skill][email]) existing.actualsEmployeeSkills![skill][email] = new Array(144).fill(0);
                if (Array.isArray(allocations)) {
                  allocations.forEach((val, i) => {
                    if (val && i < 144) existing.actualsEmployeeSkills![skill][email][i] = (existing.actualsEmployeeSkills![skill][email][i] || 0) + val;
                  });
                } else if (allocations && typeof allocations === 'object') {
                  Object.entries(allocations).forEach(([k, v]) => {
                    const idx = parseInt(k);
                    if (!isNaN(idx) && idx >= 0 && idx < 144 && v) {
                      existing.actualsEmployeeSkills![skill][email][idx] = (existing.actualsEmployeeSkills![skill][email][idx] || 0) + (v as number);
                    }
                  });
                }
              });
            });
          }

          if (p.forecastEmployeeSkills) {
            if (!existing.forecastEmployeeSkills) existing.forecastEmployeeSkills = {};
            Object.entries(p.forecastEmployeeSkills).forEach(([skill, emailMap]: [string, any]) => {
              if (!existing.forecastEmployeeSkills![skill]) existing.forecastEmployeeSkills![skill] = {};
              Object.entries(emailMap).forEach(([email, allocations]: [string, any]) => {
                if (!existing.forecastEmployeeSkills![skill][email]) existing.forecastEmployeeSkills![skill][email] = new Array(144).fill(0);
                if (Array.isArray(allocations)) {
                  allocations.forEach((val, i) => {
                    if (val && i < 144) existing.forecastEmployeeSkills![skill][email][i] = (existing.forecastEmployeeSkills![skill][email][i] || 0) + val;
                  });
                } else if (allocations && typeof allocations === 'object') {
                  Object.entries(allocations).forEach(([k, v]) => {
                    const idx = parseInt(k);
                    if (!isNaN(idx) && idx >= 0 && idx < 144 && v) {
                      existing.forecastEmployeeSkills![skill][email][idx] = (existing.forecastEmployeeSkills![skill][email][idx] || 0) + (v as number);
                    }
                  });
                }
              });
            });
          }

          if (p.tasks && p.tasks.length > 0) {
            if (!existing.tasks) existing.tasks = [];
            p.tasks.forEach((sTask: any) => {
              const tTask = existing.tasks!.find((t: any) => t.id === sTask.id);
              if (tTask) {
                const mergeArray = (tArr: any, sArr: any) => {
                  const res = new Array(144).fill(0);
                  if (Array.isArray(tArr)) tArr.forEach((v: any, i: number) => { if (i < 144 && v) res[i] = v; });
                  else if (tArr && typeof tArr === 'object') Object.entries(tArr).forEach(([k, v]) => { const idx = parseInt(k); if (!isNaN(idx) && idx >= 0 && idx < 144 && v) res[idx] = v; });
                  if (Array.isArray(sArr)) sArr.forEach((v: any, i: number) => { if (i < 144 && v) res[i] = v; });
                  else if (sArr && typeof sArr === 'object') Object.entries(sArr).forEach(([k, v]) => { const idx = parseInt(k); if (!isNaN(idx) && idx >= 0 && idx < 144 && v) res[idx] = v; });
                  return res;
                };
                tTask.monthlyHours = mergeArray(tTask.monthlyHours, sTask.monthlyHours);
                tTask.monthlyAllocations = mergeArray(tTask.monthlyAllocations, sTask.monthlyAllocations);
              } else {
                existing.tasks!.push(sTask);
              }
            });
          }
        }
      });
    });

    return {
      projects: Object.values(mergedProjectsMap),
      masterConfig: latestMasterConfig,
      users: latestUsers,
      history: latestHistory,
      lastUpdated: maxLastUpdated
    };
  },

  subscribeToChanges: (
    config: any, 
    year: string,
    mode: string,
    onUpdate: (data: any) => void
  ): any => {
    ensureSocket(config);
    const documentId = getYearKey(year, mode);
    
    const sub = { id: documentId, cb: onUpdate };
    subscribers.add(sub);
    return { unsubscribe: () => subscribers.delete(sub) };
  },

  setupPresence: (
    config: any,
    user: User,
    onPresenceSync: (presenceState: any) => void
  ) => {
    // Basic presence simulation or can be expanded with WS
    return null;
  },

  listSnapshots: async (config: any): Promise<any[]> => {
    const url = getApiUrl(config, `${API_BASE}/snapshots`);
    const response = await fetch(url, {
      headers: getHeaders(config)
    });
    if (!response.ok) throw new Error('Failed to list snapshots');
    return await response.json();
  },

  deleteSnapshot: async (config: any, snapshotId: string): Promise<boolean> => {
    const url = getApiUrl(config, `${API_BASE}/budgets/${snapshotId}`);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(config)
    });
    if (!response.ok) throw new Error('Failed to delete snapshot');
    return true;
  }
};
