import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { workshopsRouter } from './routes/workshops.ts';
import { trackedContractsRouter } from './routes/trackedContracts.ts';
import { opportunitiesRouter } from './routes/opportunities.ts';
import { awardsRouter } from './routes/awards.ts';
import { analyticsRouter } from './routes/analytics.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env first, then .env.local (if present) so local secrets override defaults.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

// Outbound calls to SAM.gov / USASpending.gov must go through the environment's
// configured HTTPS proxy; Node's global fetch does not honor HTTP(S)_PROXY on its own.
setGlobalDispatcher(new EnvHttpProxyAgent());

const app = express();
app.use(express.json());

app.use('/api/workshops', workshopsRouter);
app.use('/api/tracked-contracts', trackedContractsRouter);
app.use('/api/search/opportunities', opportunitiesRouter);
app.use('/api/search/awards', awardsRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// In production, serve the Vite build output; in dev, Vite runs its own server
// and proxies /api requests here (see vite.config.ts).
const distDir = path.resolve(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`CSAW backend listening on http://localhost:${port}`);
});
