import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db, Workshop } from '../db.ts';

export const workshopsRouter = Router();

workshopsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM workshops ORDER BY workshop_date DESC').all() as Workshop[];
  res.json(rows);
});

workshopsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM workshops WHERE id = ?').get(req.params.id) as Workshop | undefined;
  if (!row) return res.status(404).json({ error: 'Workshop not found' });
  res.json(row);
});

workshopsRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.title || !b.ipt_name || !b.agency || !b.workshop_date) {
    return res.status(400).json({ error: 'title, ipt_name, agency, and workshop_date are required' });
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO workshops (id, title, ipt_name, agency, sub_agency, workshop_date, facilitators, naics_codes, psc_codes, contract_vehicle, poc_name, poc_email, notes)
    VALUES (@id, @title, @ipt_name, @agency, @sub_agency, @workshop_date, @facilitators, @naics_codes, @psc_codes, @contract_vehicle, @poc_name, @poc_email, @notes)
  `).run({
    id,
    title: b.title,
    ipt_name: b.ipt_name,
    agency: b.agency,
    sub_agency: b.sub_agency ?? null,
    workshop_date: b.workshop_date,
    facilitators: b.facilitators ?? null,
    naics_codes: b.naics_codes ?? null,
    psc_codes: b.psc_codes ?? null,
    contract_vehicle: b.contract_vehicle ?? null,
    poc_name: b.poc_name ?? null,
    poc_email: b.poc_email ?? null,
    notes: b.notes ?? null,
  });
  const row = db.prepare('SELECT * FROM workshops WHERE id = ?').get(id);
  res.status(201).json(row);
});

workshopsRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM workshops WHERE id = ?').get(req.params.id) as Workshop | undefined;
  if (!existing) return res.status(404).json({ error: 'Workshop not found' });
  const b = req.body ?? {};
  const merged = { ...existing, ...b, id: existing.id };
  db.prepare(`
    UPDATE workshops SET
      title = @title, ipt_name = @ipt_name, agency = @agency, sub_agency = @sub_agency,
      workshop_date = @workshop_date, facilitators = @facilitators, naics_codes = @naics_codes,
      psc_codes = @psc_codes, contract_vehicle = @contract_vehicle, poc_name = @poc_name,
      poc_email = @poc_email, notes = @notes, updated_at = datetime('now')
    WHERE id = @id
  `).run(merged);
  const row = db.prepare('SELECT * FROM workshops WHERE id = ?').get(existing.id);
  res.json(row);
});

workshopsRouter.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM workshops WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Workshop not found' });
  res.status(204).send();
});
