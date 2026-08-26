import React, { useState } from 'react';
import { Search, Link2, RefreshCw, FileSearch, Award, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Workshop, SearchResult } from '../types';
import { searchAwards, searchOpportunities, linkContract } from '../api';

interface Props {
  workshop: Workshop;
  onLinked: () => void;
}

function formatMoney(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

export default function ContractSearchPanel({ workshop, onLinked }: Props) {
  const [tab, setTab] = useState<'awards' | 'opportunities'>('awards');
  const [keyword, setKeyword] = useState(workshop.ipt_name);
  const [naics, setNaics] = useState((workshop.naics_codes || '').split(',')[0]?.trim() || '');
  const [agency, setAgency] = useState(workshop.agency);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const runSearch = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const data = tab === 'awards'
        ? await searchAwards({ keyword, naics, agency })
        : await searchOpportunities({ keyword, naics, agency });
      setResults(data);
      if (data.length === 0) toast.info('No results found for these filters.');
    } catch (err: any) {
      console.error('Search failed', err);
      setError(err.message || 'Search failed. The upstream API may be unavailable.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async (result: SearchResult) => {
    setLinkingId(result.external_id);
    try {
      await linkContract(workshop.id, result, 'linked');
      toast.success(`Linked to ${workshop.title}`);
      onLinked();
    } catch (err: any) {
      toast.error(err.message || 'Failed to link contract');
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Search Contracts &amp; Solicitations</h3>
        <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
          {([
            { id: 'awards', label: 'FPDS Awards', icon: Award },
            { id: 'opportunities', label: 'SAM.gov Solicitations', icon: FileSearch },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${
                tab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword (e.g. cybersecurity, IPT name)"
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <input
          value={naics}
          onChange={(e) => setNaics(e.target.value)}
          placeholder="NAICS code"
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <input
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Agency name"
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <button
        onClick={runSearch}
        disabled={isSearching}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-white text-xs font-black rounded-lg hover:bg-slate-900 disabled:opacity-50"
      >
        {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        {isSearching ? 'SEARCHING...' : 'SEARCH'}
      </button>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">{error}</div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((r) => (
          <div key={r.external_id} className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">{r.title}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                {r.awardee_name && <span>Awardee: {r.awardee_name}</span>}
                {r.agency && <span>{r.agency}</span>}
                {r.naics_code && <span>NAICS {r.naics_code}</span>}
                {r.obligated_amount != null && <span className="font-bold text-emerald-600">{formatMoney(r.obligated_amount)}</span>}
                {r.action_date && <span>{r.action_date}</span>}
              </div>
            </div>
            <button
              onClick={() => handleLink(r)}
              disabled={linkingId === r.external_id}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" />
              {linkingId === r.external_id ? 'LINKING...' : 'LINK TO WORKSHOP'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
