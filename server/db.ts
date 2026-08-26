import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'csaw.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS workshops (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    ipt_name TEXT NOT NULL,
    agency TEXT NOT NULL,
    sub_agency TEXT,
    workshop_date TEXT NOT NULL,
    facilitators TEXT,
    naics_codes TEXT,
    psc_codes TEXT,
    contract_vehicle TEXT,
    poc_name TEXT,
    poc_email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tracked_contracts (
    id TEXT PRIMARY KEY,
    workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('fpds_award', 'sam_solicitation')),
    external_id TEXT NOT NULL,
    piid TEXT,
    solicitation_number TEXT,
    title TEXT,
    agency TEXT,
    sub_agency TEXT,
    awardee_name TEXT,
    naics_code TEXT,
    psc_code TEXT,
    obligated_amount REAL,
    base_and_all_options_value REAL,
    action_date TEXT,
    period_of_performance_end TEXT,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'linked' CHECK (status IN ('linked', 'candidate')),
    impact_notes TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workshop_id, source, external_id)
  );

  CREATE INDEX IF NOT EXISTS idx_tracked_contracts_workshop ON tracked_contracts(workshop_id);
`);

export interface Workshop {
  id: string;
  title: string;
  ipt_name: string;
  agency: string;
  sub_agency: string | null;
  workshop_date: string;
  facilitators: string | null;
  naics_codes: string | null;
  psc_codes: string | null;
  contract_vehicle: string | null;
  poc_name: string | null;
  poc_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedContract {
  id: string;
  workshop_id: string;
  source: 'fpds_award' | 'sam_solicitation';
  external_id: string;
  piid: string | null;
  solicitation_number: string | null;
  title: string | null;
  agency: string | null;
  sub_agency: string | null;
  awardee_name: string | null;
  naics_code: string | null;
  psc_code: string | null;
  obligated_amount: number | null;
  base_and_all_options_value: number | null;
  action_date: string | null;
  period_of_performance_end: string | null;
  url: string | null;
  status: 'linked' | 'candidate';
  impact_notes: string | null;
  raw_json: string | null;
  created_at: string;
}
