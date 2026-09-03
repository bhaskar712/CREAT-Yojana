import dotenv from 'dotenv';
import path from 'path';
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

let _filename: string;
let _dirname: string;
try {
  _filename = __filename;
  _dirname = __dirname;
} catch (e) {
  _filename = fileURLToPath(import.meta.url);
  _dirname = path.dirname(_filename);
}

// Load .env explicitly
dotenv.config({ path: path.join(process.cwd(), '.env') });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

const dbPath = process.env.DATABASE_PATH 
  ? (path.isAbsolute(process.env.DATABASE_PATH) ? process.env.DATABASE_PATH : path.join(process.cwd(), process.env.DATABASE_PATH))
  : path.join(process.cwd(), 'database.sqlite');

console.log('--- Environment Configuration ---');
console.log(`📍 Current Directory: ${process.cwd()}`);
console.log(`📂 Database Path: ${dbPath}`);
console.log(`🔑 Sync Key Configured: ${process.env.SYNC_KEY ? 'YES (Length: ' + process.env.SYNC_KEY.length + ')' : 'NO'}`);
console.log('---------------------------------');

// Ensure directory exists
const dbDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dbDir)) {
  console.log(`📁 Creating directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

function createTables(instance: InstanceType<typeof Database>) {
  instance.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      data TEXT,
      updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      product_family TEXT,
      domain TEXT,
      customer_name TEXT,
      segment TEXT,
      stage TEXT,
      value REAL,
      sop_date TEXT,
      probability REAL,
      status TEXT,
      vertical TEXT,
      business_unit TEXT,
      type TEXT,
      fiscal_year TEXT,
      updated_at TEXT,
      data TEXT
    );

    CREATE TABLE IF NOT EXISTS seats (
      employeeId TEXT PRIMARY KEY,
      employeeName TEXT,
      department TEXT,
      seatNumber TEXT,
      seatIndex INTEGER,
      updated_at TEXT
    );
  `);
}

function initDatabase(targetPath: string): InstanceType<typeof Database> {
  const openAndVerify = (p: string) => {
    const instance = new Database(p);
    instance.pragma('journal_mode = WAL');
    instance.prepare('PRAGMA quick_check;').get();
    return instance;
  };

  try {
    const instance = openAndVerify(targetPath);
    createTables(instance);
    return instance;
  } catch (err: any) {
    console.error(`⚠️ Database initialization error at ${targetPath}:`, err?.message || err);
    console.log(`🔄 Resetting corrupted/malformed database file...`);
    
    try {
      const backupPath = `${targetPath}.corrupted.${Date.now()}`;
      if (fs.existsSync(targetPath)) fs.renameSync(targetPath, backupPath);
      if (fs.existsSync(`${targetPath}-wal`)) fs.renameSync(`${targetPath}-wal`, `${backupPath}-wal`);
      if (fs.existsSync(`${targetPath}-shm`)) fs.renameSync(`${targetPath}-shm`, `${backupPath}-shm`);
      console.log(`📦 Corrupted database backed up to ${backupPath}`);
    } catch (e) {
      console.error(`Failed to move corrupted database file, unlinking:`, e);
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      if (fs.existsSync(`${targetPath}-wal`)) fs.unlinkSync(`${targetPath}-wal`);
      if (fs.existsSync(`${targetPath}-shm`)) fs.unlinkSync(`${targetPath}-shm`);
    }

    const freshInstance = openAndVerify(targetPath);
    createTables(freshInstance);
    console.log(`✅ Fresh database created successfully at ${targetPath}`);
    return freshInstance;
  }
}

const db = initDatabase(dbPath);

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-sync-key']
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Security Middleware: Validate Sync Key if configured
app.use((req, res, next) => {
  const serverSyncKey = process.env.SYNC_KEY;
  const path = req.path;
  
  if (!path.startsWith('/api') || path === '/api/health') {
    return next();
  }

  // Only enforce if a key is actually set on the server and is not empty
  if (serverSyncKey && serverSyncKey.trim() !== '') {
    const clientKey = req.headers['x-sync-key'];
    if (clientKey !== serverSyncKey) {
      console.warn(`[API Auth Fail] Unauthorized attempt to ${path}. Key mismatch.`);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid or missing Sync Key',
        serverKeySet: true 
      });
    }
  }
  next();
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: !!db,
    syncKeyConfigured: !!process.env.SYNC_KEY
  });
});

app.get('/api/seats', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM seats').all();
    res.json(rows.map((row: any) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      department: row.department,
      seatNumber: row.seatNumber,
      index: row.seatIndex
    })));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/seats', (req, res) => {
  let body = req.body;
  if (body.data) body = body.data;
  const { employeeId, employeeName, department, seatNumber, index } = body;
  if (!employeeId || !seatNumber) {
    return res.status(400).json({ error: 'Missing employeeId or seatNumber' });
  }

  try {
    const updatedAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO seats (employeeId, employeeName, department, seatNumber, seatIndex, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(employeeId) DO UPDATE SET
        employeeName = excluded.employeeName,
        department = excluded.department,
        seatNumber = excluded.seatNumber,
        seatIndex = excluded.seatIndex,
        updated_at = excluded.updated_at
    `).run(employeeId, employeeName || '', department || '', seatNumber, index || 0, updatedAt);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/seats/:id', (req, res) => {
  const { id } = req.params;
  let body = req.body;
  if (body.data) body = body.data;
  const { employeeName, department, seatNumber, index } = body;

  try {
    const updatedAt = new Date().toISOString();
    const result = db.prepare(`
      UPDATE seats SET 
        employeeName = COALESCE(?, employeeName),
        department = COALESCE(?, department),
        seatNumber = COALESCE(?, seatNumber),
        seatIndex = COALESCE(?, seatIndex),
        updated_at = ?
      WHERE employeeId = ?
    `).run(employeeName, department, seatNumber, index, updatedAt, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/seats/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM seats WHERE employeeId = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/debug/db', (req, res) => {
  try {
    const pmoBudgetRow = db.prepare('SELECT data FROM budgets WHERE id = ?').get('budget-state-fy-25-26') as { data: string } | undefined;
    const pmoActualsRow = db.prepare('SELECT data FROM budgets WHERE id = ?').get('actuals-state-fy-25-26') as { data: string } | undefined;
    const resRow = db.prepare('SELECT data FROM budgets WHERE id = ?').get('global-resources') as { data: string } | undefined;
    
    console.log('--- DEBUG DB CONTENT ---');
    console.log('PMO FY 25-26 Budget:', pmoBudgetRow ? 'FOUND' : 'NOT FOUND');
    console.log('PMO FY 25-26 Actuals:', pmoActualsRow ? 'FOUND' : 'NOT FOUND');
    console.log('Resources:', resRow ? 'FOUND' : 'NOT FOUND');
    console.log('------------------------');
    
    res.json({
      pmoBudgetFound: !!pmoBudgetRow,
      pmoActualsFound: !!pmoActualsRow,
      resourcesFound: !!resRow,
      pmoBudgetSnippet: pmoBudgetRow ? pmoBudgetRow.data.substring(0, 100) : null,
      pmoActualsSnippet: pmoActualsRow ? pmoActualsRow.data.substring(0, 100) : null,
      resourcesSnippet: resRow ? resRow.data.substring(0, 100) : null
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/budgets', (req, res) => {
  try {
    const rows = db.prepare('SELECT id FROM budgets').all();
    res.json(rows.map(row => (row as { id: string }).id));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/budgets/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT data FROM budgets WHERE id = ?').get(req.params.id) as { data: string } | undefined;
    if (row) {
      const data = JSON.parse(row.data);
      if (req.params.id !== 'global-budget-state') {
        const globalRow = db.prepare('SELECT data FROM budgets WHERE id = ?').get('global-budget-state') as { data: string } | undefined;
        if (globalRow) {
          const globalData = JSON.parse(globalRow.data);
          if (globalData.masterConfig) data.masterConfig = globalData.masterConfig;
          if (globalData.users) data.users = globalData.users;
        }
      }
      res.json({ data });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/budgets/batch-load', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'IDs array required' });
  }

  try {
    const stmt = db.prepare('SELECT id, data FROM budgets WHERE id IN (' + ids.map(() => '?').join(',') + ')');
    const rows = stmt.all(...ids) as { id: string, data: string }[];
    
    const results: Record<string, any> = {};
    rows.forEach(row => {
      results[row.id] = JSON.parse(row.data);
    });

    // Mix in global data for any non-global IDs if needed
    const globalRow = db.prepare('SELECT data FROM budgets WHERE id = ?').get('global-budget-state') as { data: string } | undefined;
    if (globalRow) {
      const globalData = JSON.parse(globalRow.data);
      rows.forEach(row => {
        if (row.id !== 'global-budget-state') {
          if (globalData.masterConfig) results[row.id].masterConfig = globalData.masterConfig;
          if (globalData.users) results[row.id].users = globalData.users;
        }
      });
    }

    res.json({ data: results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/budgets/batch', (req, res) => {
  const { items, senderId } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array required' });
  }
  
  console.log(`POST /api/budgets/batch received with ${items.length} items from sender: ${senderId}`);
  try {
    const updatedAt = new Date().toISOString();
    const idsToBroadcast: string[] = [];

    const upsertStmt = db.prepare(`
      INSERT INTO budgets (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    const selectGlobalStmt = db.prepare('SELECT data FROM budgets WHERE id = ?');

    const transaction = db.transaction((batchItems) => {
      let masterConfigToSync = null;
      let usersToSync = null;

      for (const item of batchItems) {
        const { id, data } = item;
        upsertStmt.run(id, JSON.stringify(data), updatedAt);
        
        if (id !== 'global-budget-state') {
          if (data.masterConfig) masterConfigToSync = data.masterConfig;
          if (data.users) usersToSync = data.users;
        }
        
        idsToBroadcast.push(id);
      }

      if (masterConfigToSync || usersToSync) {
        const globalRow = selectGlobalStmt.get('global-budget-state') as { data: string } | undefined;
        let globalData = globalRow ? JSON.parse(globalRow.data) : { projects: [], masterProjects: [], users: [], masterConfig: {}, lastUpdated: Date.now(), settings: {}, history: [] };
        
        if (masterConfigToSync) globalData.masterConfig = masterConfigToSync;
        if (usersToSync) globalData.users = usersToSync;
        
        upsertStmt.run('global-budget-state', JSON.stringify(globalData), updatedAt);
        if (!idsToBroadcast.includes('global-budget-state')) {
          idsToBroadcast.push('global-budget-state');
        }
      }
    });

    transaction(items);

    // Single broadcast message for batch updates
    broadcast({ type: 'BATCH_UPDATE', ids: idsToBroadcast, senderId }, senderId);

    res.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    console.error(`Error in batch update`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/budgets', (req, res) => {
  const { id, data, senderId } = req.body;
  console.log(`POST /api/budgets received for id: ${id} from sender: ${senderId}`);
  try {
    const updatedAt = new Date().toISOString();
    const dataString = JSON.stringify(data);
    db.prepare(`
      INSERT INTO budgets (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(id, dataString, updatedAt);
    
    if (id !== 'global-budget-state' && data.masterConfig) {
      const globalRow = db.prepare('SELECT data FROM budgets WHERE id = ?').get('global-budget-state') as { data: string } | undefined;
      let globalData = globalRow ? JSON.parse(globalRow.data) : { projects: [], masterProjects: [], users: [], masterConfig: {}, lastUpdated: Date.now(), settings: {}, history: [] };
      globalData.masterConfig = data.masterConfig;
      if (data.users) globalData.users = data.users;
      db.prepare(`
        INSERT INTO budgets (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `).run('global-budget-state', JSON.stringify(globalData), updatedAt);
    }
    
    // Broadcast to all connected clients EXCEPT the sender
    // For budgets, we only send the notification to keep WS traffic low
    broadcast({ type: 'UPDATE', id, senderId }, senderId);
    
    res.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    console.error(`Error saving to database for id: ${id}`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/snapshots', (req, res) => {
  try {
    const rows = db.prepare("SELECT id, updated_at FROM budgets WHERE id LIKE 'snapshot:%' ORDER BY updated_at DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/budgets/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/data/cleanup', (req, res) => {
  try {
    db.prepare('DELETE FROM budgets').run();
    db.prepare('DELETE FROM opportunities').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Import from Excel
app.post('/api/opportunities/import-excel', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'Data', 'PMTS_Handshake_Document_Corp_Marketing.xlsx');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Excel file not found in Data folder' });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const opportunities = jsonData.map((row: any) => {
      const stageMap: Record<string, string> = {
        'Target': 'T',
        'Discussion': 'E',
        'RFI Received': 'D',
        'RFQ Received': 'C',
        'Awarded': 'B',
        'Production': 'A',
        'PoC': 'P',
        'Hold': 'H'
      };

      const formatDate = (val: any) => {
        if (!val) return '';
        // If it's a number, it's an Excel serial date
        if (typeof val === 'number') {
          const date = new Date((val - 25569) * 86400 * 1000);
          return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-').toUpperCase();
        }
        // If it's a string, try to parse it
        if (typeof val === 'string') {
          // Check if it's already in a format we can parse, e.g., "Nov-21"
          if (/^[A-Za-z]{3}-\d{2}$/.test(val)) return val.toUpperCase();
          
          // Try parsing as a standard date
          const date = new Date(val);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-').toUpperCase();
          }
        }
        return val;
      };

      const extraData = {
        remarks: row['Remarks'] ? [{ text: row['Remarks'], date: new Date().toISOString(), user: 'Import' }] : [],
        marketingContact: row['Head Marketing'] || '',
        vth: row['VTH'] || '',
        peakYearVolume: parseInt(row['Peak Year Volume']) || 0,
        programLifeYears: parseInt(row['Program Life Years']) || 0,
        productDescription: row['Product Description'] || '',
        rfiRfqReceiveDate: formatDate(row['RFI/Q Receive Date']),
        pmtTechSales: row['PMT Tech Sales'] || '',
        targetLoiDate: formatDate(row['Target LOI Date']),
        actualLoiDate: formatDate(row['Actual LOI date'] || row['Actual LOI Date']),
        pfsStatus: row['PFS State'] || '',
        tentativePrice: parseFloat(row['Potential Kit Value']) || 0,
        sw: row['SW'] || '',
        hw: row['HW'] || '',
        me: row['ME'] || '',
        bu: row['BU'] || row['BU Status'] || row['BU State'] || ''
      };

      return {
        id: crypto.randomUUID(),
        product_family: row['Product Family'] || row['Product'] || 'Unknown',
        domain: row['Domain'] || 'Unknown',
        customer_name: row['Customer Name'] || row['Customer'] || 'Unknown',
        segment: row['Segment'] || 'Unknown',
        stage: stageMap[row['DCBA']] || row['DCBA'] || 'T',
        value: parseFloat(row['Value (Rs. Cr)']) || parseFloat(row['Value']) || 0,
        sop_date: formatDate(row['Planned SOP Date']),
        probability: parseFloat(row['Probability']) || 0.5,
        status: row['Status'] || 'Open',
        vertical: row['CREAT Vertical'] || '',
        business_unit: row['Business Unit'] || '',
        type: row['Type'] || '',
        fiscal_year: row['Fiscal Year'] || row['FY'] || '',
        updated_at: new Date().toISOString(),
        data: JSON.stringify(extraData)
      };
    });

    const insert = db.prepare(`
      INSERT INTO opportunities (
        id, product_family, domain, customer_name, segment, 
        stage, value, sop_date, probability, status, 
        vertical, business_unit, type, fiscal_year,
        updated_at, data
      )
      VALUES (
        @id, @product_family, @domain, @customer_name, @segment, 
        @stage, @value, @sop_date, @probability, @status, 
        @vertical, @business_unit, @type, @fiscal_year,
        @updated_at, @data
      )
    `);

    const transaction = db.transaction((opps) => {
      for (const opp of opps) {
        insert.run(opp);
      }
    });

    transaction(opportunities);
    broadcast({ type: 'OPPORTUNITIES_UPDATED' });
    res.json({ message: `Successfully imported ${opportunities.length} opportunities` });
  } catch (err: any) {
    console.error('Excel import error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/opportunities/bulk', (req, res) => {
  const opportunities = req.body;
  if (!Array.isArray(opportunities)) {
    return res.status(400).json({ error: 'Expected an array of opportunities' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO opportunities (
        id, product_family, domain, customer_name, segment, 
        stage, value, sop_date, probability, status, 
        vertical, business_unit, type, fiscal_year,
        updated_at, data
      )
      VALUES (
        @id, @productFamily, @domain, @customerName, @segment, 
        @stage, @value, @sopDate, @probability, @status, 
        @vertical, @businessUnit, @type, @fiscalYear,
        @updatedAt, @data
      )
      ON CONFLICT(id) DO UPDATE SET
        product_family = excluded.product_family,
        domain = excluded.domain,
        customer_name = excluded.customer_name,
        segment = excluded.segment,
        stage = excluded.stage,
        value = excluded.value,
        sop_date = excluded.sop_date,
        probability = excluded.probability,
        status = excluded.status,
        vertical = excluded.vertical,
        business_unit = excluded.business_unit,
        type = excluded.type,
        fiscal_year = excluded.fiscal_year,
        updated_at = excluded.updated_at,
        data = excluded.data
    `);

    const transaction = db.transaction((opps) => {
      for (const opp of opps) {
        const id = opp.id || `opp-${crypto.randomUUID()}`;
        const updatedAt = new Date().toISOString();
        const extraData = {
          productDescription: opp.productDescription,
          rfiRfqReceiveDate: opp.rfiRfqReceiveDate,
          pmtTechSales: opp.pmtTechSales,
          targetLoiDate: opp.targetLoiDate,
          actualLoiDate: opp.actualLoiDate,
          pfsStatus: opp.pfsStatus,
          tentativePrice: opp.tentativePrice,
          remarks: opp.remarks,
          marketingContact: opp.marketingContact,
          vth: opp.vth,
          peakYearVolume: opp.peakYearVolume,
          programLifeYears: opp.programLifeYears,
          fyValue: opp.fyValue,
          sw: opp.sw,
          hw: opp.hw,
          me: opp.me,
          bu: opp.bu
        };

        insert.run({
          id,
          productFamily: opp.productFamily || '',
          domain: opp.domain || '',
          customerName: opp.customerName || '',
          segment: opp.segment || '',
          stage: opp.stage || 'T',
          value: opp.value || 0,
          sopDate: opp.sopDate || '',
          probability: opp.probability || 0,
          status: opp.status || 'Open',
          vertical: opp.vertical || '',
          businessUnit: opp.businessUnit || '',
          type: opp.type || '',
          fiscalYear: opp.fiscalYear || '',
          updatedAt,
          data: JSON.stringify(extraData)
        });
      }
    });

    transaction(opportunities);
    broadcast({ type: 'OPPORTUNITIES_UPDATED' });
    res.json({ success: true, count: opportunities.length });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Opportunities API
app.get('/api/opportunities', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM opportunities ORDER BY updated_at DESC').all();
    res.json(rows.map((row: any) => {
      const extraData = JSON.parse(row.data || '{}');
      const businessUnit = (row.business_unit === 'ADAS' || row.business_unit === 'Sensor') ? 'ADAS & Sensor' : row.business_unit;
      const segment = row.segment === 'CV' ? 'CV_OR' : row.segment;
      return {
        id: row.id,
        productFamily: row.product_family,
        domain: row.domain,
        customerName: row.customer_name,
        segment,
        stage: row.stage,
        value: row.value,
        sopDate: row.sop_date,
        probability: row.probability,
        status: row.status,
        vertical: row.vertical,
        businessUnit,
        type: row.type,
        fiscalYear: row.fiscal_year,
        updatedAt: row.updated_at,
        ...extraData
      };
    }));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/opportunities', (req, res) => {
  const opp = req.body;
  const id = opp.id || `opp-${Date.now()}`;
  const updatedAt = new Date().toISOString();
  
  const extraData = {
    productDescription: opp.productDescription,
    rfiRfqReceiveDate: opp.rfiRfqReceiveDate,
    pmtTechSales: opp.pmtTechSales,
    targetLoiDate: opp.targetLoiDate,
    actualLoiDate: opp.actualLoiDate,
    pfsStatus: opp.pfsStatus,
    tentativePrice: opp.tentativePrice,
    remarks: Array.isArray(opp.remarks) ? opp.remarks : (opp.remarks ? [{ text: opp.remarks, date: new Date().toISOString(), user: 'System' }] : []),
    marketingContact: opp.marketingContact,
    vth: opp.vth,
    peakYearVolume: opp.peakYearVolume,
    programLifeYears: opp.programLifeYears,
    fyValue: opp.fyValue,
    sw: opp.sw,
    hw: opp.hw,
    me: opp.me,
    bu: opp.bu
  };

  try {
    db.prepare(`
      INSERT INTO opportunities (
        id, product_family, domain, customer_name, segment, 
        stage, value, sop_date, probability, status, 
        vertical, business_unit, type, fiscal_year,
        updated_at, data
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        product_family = excluded.product_family,
        domain = excluded.domain,
        customer_name = excluded.customer_name,
        segment = excluded.segment,
        stage = excluded.stage,
        value = excluded.value,
        sop_date = excluded.sop_date,
        probability = excluded.probability,
        status = excluded.status,
        vertical = excluded.vertical,
        business_unit = excluded.business_unit,
        type = excluded.type,
        fiscal_year = excluded.fiscal_year,
        updated_at = excluded.updated_at,
        data = excluded.data
    `).run(
      id,
      opp.productFamily || '',
      opp.domain || '',
      opp.customerName || '',
      opp.segment || '',
      opp.stage || 'T',
      opp.value || 0,
      opp.sopDate || '',
      opp.probability || 0,
      opp.status || 'Open',
      opp.vertical || '',
      opp.businessUnit || '',
      opp.type || '',
      opp.fiscalYear || '',
      updatedAt,
      JSON.stringify(extraData)
    );
    
    broadcast({ type: 'OPPORTUNITIES_UPDATED' });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/opportunities', (req, res) => {
  try {
    db.prepare('DELETE FROM opportunities').run();
    broadcast({ type: 'OPPORTUNITIES_UPDATED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/opportunities/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM opportunities WHERE id = ?').run(req.params.id);
    broadcast({ type: 'OPPORTUNITY_DELETE', id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// WebSocket broadcast state
const clientMap = new Map<WebSocket, string>();

function broadcast(message: any, skipSenderId?: string) {
  const payload = JSON.stringify(message);
  clientMap.forEach((clientId, client) => {
    if (skipSenderId && clientId === skipSenderId) return;
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// API 404 Handler - Catch-all for undefined /api routes
app.use('/api', (req: express.Request, res: express.Response) => {
  res.status(404).json({ 
    error: 'API endpoint not found', 
    path: req.originalUrl,
    method: req.method
  });
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    
    // Catch-all middleware for SPA
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      if (req.path.match(/\.(js|css|json|png|jpg|jpeg|gif|ico|svg|map)$/)) {
        return res.status(404).send('Not Found');
      }
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error]', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      path: req.path
    });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server is ready!');
    console.log(`Local:            http://localhost:${PORT}`);
    console.log(`On Your Network:  http://0.0.0.0:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`🔌 New WS connection from ${ip}`);
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'IDENTIFY') {
          clientMap.set(ws, data.clientId);
          console.log(`🆔 WS Client identified: ${data.clientId}`);
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      console.log(`🔌 WS connection closed for ${ip}`);
      clientMap.delete(ws);
    });
    ws.on('error', (err) => console.error(`❌ WS Error for ${ip}:`, err));
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
