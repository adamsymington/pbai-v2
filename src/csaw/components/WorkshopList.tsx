import React from 'react';
import { Calendar, Building2, Users, Pencil, Trash2, Plus } from 'lucide-react';
import { Workshop } from '../types';

interface Props {
  workshops: Workshop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (workshop: Workshop) => void;
  onDelete: (workshop: Workshop) => void;
}

export default function WorkshopList({ workshops, selectedId, onSelect, onNew, onEdit, onDelete }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">CSAW Workshops</h3>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-black rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-3.5 h-3.5" /> NEW
        </button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {workshops.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">No workshops yet. Add your first CSAW workshop to start tracking impact.</div>
        )}
        {workshops.map((w) => (
          <div
            key={w.id}
            onClick={() => onSelect(w.id)}
            className={`p-4 cursor-pointer transition-colors group ${selectedId === w.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-bold truncate ${selectedId === w.id ? 'text-indigo-700' : 'text-slate-900'}`}>{w.title}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{w.ipt_name}</span>
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{w.agency}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3" />{w.workshop_date}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onEdit(w); }} className="p-1.5 hover:bg-white rounded-md">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(w); }} className="p-1.5 hover:bg-white rounded-md">
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
