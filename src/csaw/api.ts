import { AnalyticsSummary, SearchResult, TrackedContract, Workshop, WorkshopInput } from './types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error ? `: ${body.error}` : '';
    } catch {
      // ignore
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Workshops ---

export const listWorkshops = () => request<Workshop[]>('/api/workshops');
export const getWorkshop = (id: string) => request<Workshop>(`/api/workshops/${id}`);
export const createWorkshop = (input: WorkshopInput) =>
  request<Workshop>('/api/workshops', { method: 'POST', body: JSON.stringify(input) });
export const updateWorkshop = (id: string, input: Partial<WorkshopInput>) =>
  request<Workshop>(`/api/workshops/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteWorkshop = (id: string) =>
  request<void>(`/api/workshops/${id}`, { method: 'DELETE' });

// --- Tracked contracts (workshop -> contract links) ---

export const listTrackedContracts = (workshopId?: string) =>
  request<TrackedContract[]>(`/api/tracked-contracts${workshopId ? `?workshop_id=${workshopId}` : ''}`);

export const linkContract = (workshopId: string, result: SearchResult, status: 'linked' | 'candidate' = 'linked') =>
  request<TrackedContract>('/api/tracked-contracts', {
    method: 'POST',
    body: JSON.stringify({
      workshop_id: workshopId,
      source: result.source,
      external_id: result.external_id,
      piid: result.piid,
      solicitation_number: result.solicitation_number,
      title: result.title,
      agency: result.agency,
      sub_agency: result.sub_agency,
      awardee_name: result.awardee_name,
      naics_code: result.naics_code,
      psc_code: result.psc_code,
      obligated_amount: result.obligated_amount,
      base_and_all_options_value: result.base_and_all_options_value,
      action_date: result.action_date,
      period_of_performance_end: result.period_of_performance_end,
      url: result.url,
      status,
      raw_json: result.raw,
    }),
  });

export const updateTrackedContract = (id: string, patch: { status?: 'linked' | 'candidate'; impact_notes?: string }) =>
  request<TrackedContract>(`/api/tracked-contracts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const unlinkContract = (id: string) =>
  request<void>(`/api/tracked-contracts/${id}`, { method: 'DELETE' });

// --- Search (SAM.gov + USASpending proxies) ---

export interface SearchFilters {
  keyword?: string;
  naics?: string;
  agency?: string;
}

function toQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  return q.toString();
}

export async function searchAwards(filters: SearchFilters): Promise<SearchResult[]> {
  const qs = toQuery({ keyword: filters.keyword, naics: filters.naics, agency: filters.agency, limit: '25' });
  const data = await request<{ results: any[] }>(`/api/search/awards?${qs}`);
  return (data.results || []).map((r): SearchResult => ({
    source: 'fpds_award',
    external_id: String(r.generated_internal_id ?? r['Award ID']),
    piid: r['Award ID'] ?? null,
    solicitation_number: null,
    title: r['Description'] || r['Award ID'] || 'Untitled award',
    agency: r['Awarding Agency'] ?? null,
    sub_agency: r['Awarding Sub Agency'] ?? null,
    awardee_name: r['Recipient Name'] ?? null,
    naics_code: r['NAICS Code'] ?? null,
    psc_code: r['PSC Code'] ?? null,
    obligated_amount: r['Award Amount'] ?? null,
    base_and_all_options_value: r['Total Outlays'] ?? null,
    action_date: r['Start Date'] ?? null,
    period_of_performance_end: r['End Date'] ?? null,
    url: r.generated_internal_id ? `https://www.usaspending.gov/award/${r.generated_internal_id}` : null,
    raw: r,
  }));
}

export async function searchOpportunities(filters: SearchFilters): Promise<SearchResult[]> {
  const qs = toQuery({ keyword: filters.keyword, naics: filters.naics, agency: filters.agency, limit: '25' });
  const data = await request<{ opportunitiesData: any[] }>(`/api/search/opportunities?${qs}`);
  return (data.opportunitiesData || []).map((r): SearchResult => ({
    source: 'sam_solicitation',
    external_id: r.noticeId,
    piid: null,
    solicitation_number: r.solicitationNumber ?? null,
    title: r.title || 'Untitled opportunity',
    agency: r.fullParentPathName?.split('.')?.[0] ?? null,
    sub_agency: r.fullParentPathName ?? null,
    awardee_name: null,
    naics_code: r.naicsCode ?? null,
    psc_code: r.classificationCode ?? null,
    obligated_amount: null,
    base_and_all_options_value: null,
    action_date: r.postedDate ?? null,
    period_of_performance_end: r.responseDeadLine ?? null,
    url: r.uiLink ?? null,
    raw: r,
  }));
}

// --- Analytics ---

export const getAnalyticsSummary = () => request<AnalyticsSummary>('/api/analytics/summary');
