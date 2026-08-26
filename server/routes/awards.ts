import { Router } from 'express';

export const awardsRouter = Router();

const USASPENDING_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';

const AWARD_FIELDS = [
  'Award ID',
  'Recipient Name',
  'Award Amount',
  'Total Outlays',
  'Description',
  'Contract Award Type',
  'Awarding Agency',
  'Awarding Sub Agency',
  'Funding Agency',
  'Start Date',
  'End Date',
  'Last Modified Date',
  'NAICS Code',
  'NAICS Description',
  'PSC Code',
  'PSC Description',
  'generated_internal_id',
];

// GET /api/search/awards?keyword=&naics=&agency=&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&limit=&page=
awardsRouter.get('/', async (req, res) => {
  const { keyword, naics, agency, dateFrom, dateTo, limit, page } = req.query as Record<string, string | undefined>;

  const today = new Date().toISOString().slice(0, 10);
  const filters: Record<string, unknown> = {
    award_type_codes: ['A', 'B', 'C', 'D'], // contracts (Delivery/BPA/Definitive/IDV order)
    time_period: [{ start_date: dateFrom || '2007-10-01', end_date: dateTo || today }],
  };
  if (keyword) filters.keywords = [keyword];
  if (naics) filters.naics_codes = [naics];
  if (agency) filters.agencies = [{ type: 'awarding', tier: 'toptier', name: agency }];

  const body = {
    filters,
    fields: AWARD_FIELDS,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 25,
    sort: 'Award Amount',
    order: 'desc',
  };

  try {
    const upstream = await fetch(USASPENDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'USASpending API error', detail: data });
    }
    res.json(data);
  } catch (err) {
    console.error('USASpending award search failed:', err);
    res.status(502).json({ error: 'Failed to reach USASpending.gov API' });
  }
});
