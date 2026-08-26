import { Router } from 'express';
import { db } from '../db.ts';

export const analyticsRouter = Router();

// GET /api/analytics/summary
analyticsRouter.get('/summary', (_req, res) => {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS contract_count,
      COALESCE(SUM(obligated_amount), 0) AS total_obligated,
      COALESCE(SUM(base_and_all_options_value), 0) AS total_ceiling_value,
      COUNT(DISTINCT workshop_id) AS workshops_with_impact,
      COUNT(DISTINCT agency) AS agencies_impacted
    FROM tracked_contracts
    WHERE status = 'linked'
  `).get();

  const byAgency = db.prepare(`
    SELECT agency, COUNT(*) AS contract_count, COALESCE(SUM(obligated_amount), 0) AS total_obligated
    FROM tracked_contracts
    WHERE status = 'linked' AND agency IS NOT NULL
    GROUP BY agency
    ORDER BY total_obligated DESC
  `).all();

  const byIpt = db.prepare(`
    SELECT w.ipt_name AS ipt_name, COUNT(tc.id) AS contract_count, COALESCE(SUM(tc.obligated_amount), 0) AS total_obligated
    FROM tracked_contracts tc
    JOIN workshops w ON w.id = tc.workshop_id
    WHERE tc.status = 'linked'
    GROUP BY w.ipt_name
    ORDER BY total_obligated DESC
  `).all();

  const byMonth = db.prepare(`
    SELECT substr(action_date, 1, 7) AS month, COUNT(*) AS contract_count, COALESCE(SUM(obligated_amount), 0) AS total_obligated
    FROM tracked_contracts
    WHERE status = 'linked' AND action_date IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
  `).all();

  const bySource = db.prepare(`
    SELECT source, COUNT(*) AS contract_count
    FROM tracked_contracts
    WHERE status = 'linked'
    GROUP BY source
  `).all();

  const workshopCount = (db.prepare('SELECT COUNT(*) AS c FROM workshops').get() as { c: number }).c;

  res.json({ totals, byAgency, byIpt, byMonth, bySource, workshopCount });
});
