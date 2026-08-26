import { Router } from 'express';

export const opportunitiesRouter = Router();

const SAM_OPPORTUNITIES_URL = 'https://api.sam.gov/opportunities/v2/search';

function toMMDDYYYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// GET /api/search/opportunities?keyword=&naics=&agency=&postedFrom=MM/dd/yyyy&postedTo=MM/dd/yyyy&limit=&offset=
opportunitiesRouter.get('/', async (req, res) => {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey || apiKey.includes('MY_SAM_GOV_API_KEY')) {
    return res.status(503).json({ error: 'SAM_GOV_API_KEY is not configured on the server' });
  }

  const { keyword, naics, agency, postedFrom, postedTo, limit, offset } = req.query as Record<string, string | undefined>;

  // SAM.gov requires postedFrom/postedTo and caps the range at 1 year.
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const params = new URLSearchParams({
    api_key: apiKey,
    postedFrom: postedFrom || toMMDDYYYY(oneYearAgo),
    postedTo: postedTo || toMMDDYYYY(today),
    limit: limit || '25',
    offset: offset || '0',
  });
  if (keyword) params.set('title', keyword);
  if (naics) params.set('ncode', naics);
  if (agency) params.set('organizationName', agency);

  try {
    const upstream = await fetch(`${SAM_OPPORTUNITIES_URL}?${params.toString()}`);
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'SAM.gov API error', detail: data });
    }
    res.json(data);
  } catch (err) {
    console.error('SAM.gov opportunities search failed:', err);
    res.status(502).json({ error: 'Failed to reach SAM.gov API' });
  }
});
