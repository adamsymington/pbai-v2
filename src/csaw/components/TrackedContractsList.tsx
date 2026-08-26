import React from 'react';
import { Trash2, ExternalLink, Award, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import { TrackedContract } from '../types';
import { unlinkContract } from '../api';

interface Props {
  contracts: TrackedContract[];
  onChanged: () => void;
}

function formatMoney(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

export default function TrackedContractsList({ contracts, onChanged }: Props) {
  const handleUnlink = async (id: string) => {
    try {
      await unlinkContract(id);
      toast.success('Removed');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  const totalObligated = contracts.reduce((sum, c) => sum + (c.obligated_amount || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Tracked Contracts &amp; Solicitations</h3>
        <span className="text-[11px] font-black text-emerald-600">{formatMoney(totalObligated)} tracked</span>
      </div>
      {contracts.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No contracts linked yet. Use the search panel to find and link FPDS awards or SAM.gov solicitations.</p>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id} className="p-3 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {c.source === 'fpds_award' ? (
                    <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <FileSearch className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  )}
                  <p className="text-sm font-bold text-slate-900 truncate">{c.title || c.piid || c.solicitation_number}</p>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                  {c.awardee_name && <span>Awardee: {c.awardee_name}</span>}
                  {c.agency && <span>{c.agency}</span>}
                  {c.obligated_amount != null && <span className="font-bold text-emerald-600">{formatMoney(c.obligated_amount)}</span>}
                  {c.action_date && <span>{c.action_date}</span>}
                </div>
              </div>
              <button onClick={() => handleUnlink(c.id)} className="shrink-0 p-1.5 hover:bg-rose-50 rounded-md">
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
