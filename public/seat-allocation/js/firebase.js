/* 
  DATABASE BRIDGE: Firebase -> SQLite (Unified Portal Migration)
  This file replaces the Firebase SDK with local API calls.
  Existing logic in allocation.html, dashboard.html, and EmployeeMaster.html will continue to work.
*/

const API_BASE = '/api/seats';
// Sync key for authentication with the portal server
const SYNC_KEY = localStorage.getItem('sync_key') || ''; 

const headers = {
  'Content-Type': 'application/json',
  'x-sync-key': SYNC_KEY
};

// Global Firestore Mock to avoid breaking existing frontend code
window.db = "sqlite-bridge"; 

window.firestore = {
  // Mock 'collection' (just returns the name for simplicity)
  collection: (db, name) => name,

  // Mock 'doc' (returns a reference object with path and id)
  doc: (db, path, id) => ({ path, id }),

  // Mock 'query' and 'where' (simulated filtering/constraints)
  query: (path, ...constraints) => {
    return { path, constraints };
  },
  where: (field, op, value) => ({ field, op, value }),

  // REAL DATA FETCH: Replaces getDocs()
  getDocs: async (q) => {
    const path = typeof q === 'string' ? q : q.path;
    const url = new URL(window.location.origin + API_BASE);
    
    // Convert Firestore 'where' to URL params if needed (simulated for simplicity)
    if (q.constraints) {
      q.constraints.forEach(c => {
        if (c.field && c.value !== undefined) {
          url.searchParams.append(c.field, c.value);
        }
      });
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      
      // Replicate Firestore QuerySnapshot structure
      return {
        forEach: (callback) => {
          data.forEach(item => callback({
            id: item.id,
            data: () => item
          }));
        },
        docs: data.map(item => ({
          id: item.id,
          data: () => item
        })),
        empty: data.length === 0,
        size: data.length
      };
    } catch (error) {
      console.error('Firestore Bridge Fetch Error:', error);
      return { forEach: () => {}, docs: [], empty: true, size: 0 };
    }
  },

  // REAL DATA GET: Replaces getDoc()
  getDoc: async (docRef) => {
    try {
      const res = await fetch(`${API_BASE}/${docRef.id}`, { headers });
      if (!res.ok) return { exists: () => false };
      const data = await res.json();
      return {
        exists: () => true,
        id: docRef.id,
        data: () => data
      };
    } catch (error) {
      console.error('Firestore Bridge Get Error:', error);
      return { exists: () => false };
    }
  },

  // REAL DATA ADD: Replaces addDoc()
  addDoc: async (path, data) => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data })
      });
      const result = await res.json();
      return { id: result.id };
    } catch (error) {
      console.error('Firestore Bridge Add Error:', error);
      throw error;
    }
  },

  // REAL DATA UPDATE: Replaces updateDoc()
  updateDoc: async (docRef, data) => {
    try {
      const res = await fetch(`${API_BASE}/${docRef.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ data })
      });
      return await res.json();
    } catch (error) {
      console.error('Firestore Bridge Update Error:', error);
      throw error;
    }
  },

  // REAL DATA DELETE: Replaces deleteDoc()
  deleteDoc: async (docRef) => {
    try {
      const res = await fetch(`${API_BASE}/${docRef.id}`, {
        method: 'DELETE',
        headers
      });
      return await res.json();
    } catch (error) {
      console.error('Firestore Bridge Delete Error:', error);
      throw error;
    }
  }
};
