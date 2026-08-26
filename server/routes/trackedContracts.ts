import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db, TrackedContract } from '../db.ts';

export const trackedContractsRouter = Router();

// GET /api/tracked-contracts?workshop_id=...
trackedContractsRouter.get('/', (req, res) => {
  const { workshop_id } = req.query;
  const rows = workshop_id
    ? db.prepare('SELECT * FROM tracked_contracts WHERE workshop_id = ? ORDER BY action_date DESC').all(workshop_id)
    : db.prepare('SELECT * FROM tracked_contracts ORDER BY action_date DESC').all();
  res.json(rows);
});

trackedContractsRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!b.workshop_id || !b.source || !b.external_id) {
    return res.status(400).json({ error: 'workshop_id, source, and external_id are required' });
  }
  const workshop = db.prepare('SELECT id FROM workshops WHERE id = ?').get(b.workshop_id);
  if (!workshop) return res.status(404).json({ error: 'Workshop not found' });

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO tracked_contracts (
        id, workshop_id, source, external_id, piid, solicitation_number, title, agency, sub_agency,
        awardee_name, naics_code, psc_code, obligated_amount, base_and_all_options_value,
        action_date, period_of_performance_end, url, status, impact_notes, raw_json
      ) VALUES (
        @id, @workshop_id, @source, @external_id, @piid, @solicitation_number, @title, @agency, @sub_agency,
        @awardee_name, @naics_code, @psc_code, @obligated_amount, @base_and_all_options_value,
        @action_date, @period_of_performance_end, @url, @status, @impact_notes, @raw_json
      )
    `).run({
      id,
      workshop_id: b.workshop_id,
      source: b.source,
      external_id: b.external_id,
      piid: b.piid ?? null,
      solicitation_number: b.solicitation_number ?? null,
      title: b.title ?? null,
      agency: b.agency ?? null,
      sub_agency: b.sub_agency ?? null,
      awardee_name: b.awardee_name ?? null,
      naics_code: b.naics_code ?? null,
      psc_code: b.psc_code ?? null,
      obligated_amount: b.obligated_amount ?? null,
      base_and_all_options_value: b.base_and_all_options_value ?? null,
      action_date: b.action_date ?? null,
      period_of_performance_end: b.period_of_performance_end ?? null,
      url: b.url ?? null,
      status: b.status ?? 'linked',
      impact_notes: b.impact_notes ?? null,
      raw_json: b.raw_json ? JSON.stringify(b.raw_json) : null,
    });
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'This contract is already linked to this workshop' });
    }
    throw e;
  }
  const row = db.prepare('SELECT * FROM tracked_contracts WHERE id = ?').get(id);
  res.status(201).json(row);
});

trackedContractsRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tracked_contracts WHERE id = ?').get(req.params.id) as TrackedContract | undefined;
  if (!existing) return res.status(404).json({ error: 'Tracked contract not found' });
  const b = req.body ?? {};
  const merged = {
    ...existing,
    status: b.status ?? existing.status,
    impact_notes: b.impact_notes ?? existing.impact_notes,
  };
  db.prepare('UPDATE tracked_contracts SET status = @status, impact_notes = @impact_notes WHERE id = @id').run(merged);
  res.json(db.prepare('SELECT * FROM tracked_contracts WHERE id = ?').get(existing.id));
});

trackedContractsRouter.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tracked_contracts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tracked contract not found' });
  res.status(204).send();
});
