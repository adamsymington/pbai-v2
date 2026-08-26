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

export type WorkshopInput = Omit<Workshop, 'id' | 'created_at' | 'updated_at'>;

export type TrackedContractSource = 'fpds_award' | 'sam_solicitation';

export interface TrackedContract {
  id: string;
  workshop_id: string;
  source: TrackedContractSource;
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
  created_at: string;
}

// Normalized shape used in the UI regardless of which upstream API a result came from.
export interface SearchResult {
  source: TrackedContractSource;
  external_id: string;
  piid: string | null;
  solicitation_number: string | null;
  title: string;
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
  raw: unknown;
}

export interface AnalyticsSummary {
  totals: {
    contract_count: number;
    total_obligated: number;
    total_ceiling_value: number;
    workshops_with_impact: number;
    agencies_impacted: number;
  };
  byAgency: Array<{ agency: string; contract_count: number; total_obligated: number }>;
  byIpt: Array<{ ipt_name: string; contract_count: number; total_obligated: number }>;
  byMonth: Array<{ month: string; contract_count: number; total_obligated: number }>;
  bySource: Array<{ source: TrackedContractSource; contract_count: number }>;
  workshopCount: number;
}
