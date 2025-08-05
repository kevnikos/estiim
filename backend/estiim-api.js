
/**
 * Estiim API (Express 4, sqlite3) - reverted stable version
 */
import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export async function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  const db = await open({ filename: './estiim.db', driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS resource_types(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS estimation_factors(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      input_unit TEXT NOT NULL CHECK (input_unit IN ('h','d')),
      hours_per_resource_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS initiatives(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      selected_factors TEXT DEFAULT '[]',
      computed_hours TEXT DEFAULT '{}',
      shirt_size TEXT
    );
  `);

  const HOURS_PER_DAY = 8;
  const toHours = (unit, v) => unit === 'd' ? v * HOURS_PER_DAY : v;
  const ok = (req, res) => {
    const e = validationResult(req);
    if (!e.isEmpty()) { res.status(400).json({ errors: e.array() }); return false; }
    return true;
  };
  const calcShirt = h => {
    const t = Object.values(h).reduce((a,b)=>a+b,0);
    if (t<=160) return 'S';
    if (t<=400) return 'M';
    if (t<=800) return 'L';
    return 'XL';
  };

  /* Resource Types */
  app.get('/api/resource-types', async (_req,res)=> res.json(await db.all('SELECT * FROM resource_types ORDER BY name')));
  app.post('/api/resource-types', body('name').trim().notEmpty(), async (req,res)=>{
    if(!ok(req,res)) return;
    const { name, description='' } = req.body;
    const id = uuid();
    await db.run('INSERT INTO resource_types(id,name,description) VALUES(?,?,?)', id, name, description);
    res.status(201).json({ id, name, description });
  });
  app.put('/api/resource-types/:id', body('name').optional().trim().notEmpty(), async (req,res)=>{
    if(!ok(req,res)) return;
    const { id } = req.params;
    const { name, description } = req.body;
    await db.run('UPDATE resource_types SET name=COALESCE(?,name), description=COALESCE(?,description) WHERE id=?', name, description, id);
    res.sendStatus(204);
  });
  app.delete('/api/resource-types/:id', async (req,res)=>{
    await db.run('DELETE FROM resource_types WHERE id=?', req.params.id);
    res.sendStatus(204);
  });

  /* Estimation Factors */
  app.get('/api/estimation-factors', async (_req,res)=> res.json(await db.all('SELECT * FROM estimation_factors ORDER BY name')));
  app.post('/api/estimation-factors',
    body('name').trim().notEmpty(),
    body('hoursPerResourceType').isObject(),
    body('inputUnit').optional().isIn(['h','d']),
    async (req,res)=>{
      if(!ok(req,res)) return;
      const { name, hoursPerResourceType, inputUnit='h' } = req.body;
      const norm = {};
      for(const [k,v] of Object.entries(hoursPerResourceType)) norm[k] = toHours(inputUnit,v);
      const id = uuid();
      await db.run('INSERT INTO estimation_factors(id,name,input_unit,hours_per_resource_type) VALUES(?,?,?,?)', id, name, inputUnit, JSON.stringify(norm));
      res.status(201).json({ id, name, inputUnit, hoursPerResourceType:norm });
  });
  app.put('/api/estimation-factors/:id', body('inputUnit').optional().isIn(['h','d']), async (req,res)=>{
    if(!ok(req,res)) return;
    const { id } = req.params;
    let { name, hoursPerResourceType, inputUnit } = req.body;
    if(hoursPerResourceType && inputUnit){
      const norm={};
      for(const [k,v] of Object.entries(hoursPerResourceType)) norm[k]=toHours(inputUnit,v);
      hoursPerResourceType = JSON.stringify(norm);
    }
    await db.run(`UPDATE estimation_factors SET
        name = COALESCE(?,name),
        input_unit = COALESCE(?,input_unit),
        hours_per_resource_type = COALESCE(?,hours_per_resource_type)
      WHERE id=?`, name, inputUnit, hoursPerResourceType, id);
    res.sendStatus(204);
  });
  app.delete('/api/estimation-factors/:id', async (req,res)=>{
    await db.run('DELETE FROM estimation_factors WHERE id=?', req.params.id);
    res.sendStatus(204);
  });

  /* Initiatives */
  async function calcHours(selected){
    if(!selected?.length) return {};
    const ids = selected.map(s=>`'${s.factorId}'`).join(',');
    const rows = await db.all(`SELECT id,hours_per_resource_type FROM estimation_factors WHERE id IN (${ids})`);
    const map = new Map(rows.map(r=>[r.id, JSON.parse(r.hours_per_resource_type)]));
    const totals = {};
    for(const { factorId, quantity } of selected){
      const hrs = map.get(factorId); if(!hrs) continue;
      for(const [rt,h] of Object.entries(hrs)) totals[rt]=(totals[rt]||0)+h*quantity;
    }
    return totals;
  }
  app.get('/api/initiatives', async (_req,res)=> res.json(await db.all('SELECT * FROM initiatives ORDER BY name')));
  app.post('/api/initiatives', body('name').trim().notEmpty(), async (req,res)=>{
    if(!ok(req,res)) return;
    const { name, selectedFactors=[] } = req.body;
    const id = uuid();
    const hours = await calcHours(selectedFactors);
    const s = calcShirt(hours);
    await db.run('INSERT INTO initiatives(id,name,selected_factors,computed_hours,shirt_size) VALUES(?,?,?,?,?)',
      id,name,JSON.stringify(selectedFactors),JSON.stringify(hours),s);
    res.status(201).json({ id, name, selectedFactors, computedHours:hours, shirtSize:s });
  });

  /* Health & SPA */
  app.get('/healthz', (_req,res)=> res.json({ status:'ok', ts:Date.now() }));
  app.get('*', (_req,res)=> res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  return app;
}

if(import.meta.main){
  createApp().then(app=>{
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, ()=> console.log(`Estiim running at http://localhost:${PORT}/`));
  }).catch(err=>{ console.error(err); process.exit(1); });
}
