import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Workshop, WorkshopInput } from '../types';

interface Props {
  initial?: Workshop | null;
  onSubmit: (input: WorkshopInput) => Promise<void>;
  onCancel: () => void;
}

const emptyForm: WorkshopInput = {
  title: '',
  ipt_name: '',
  agency: '',
  sub_agency: '',
  workshop_date: '',
  facilitators: '',
  naics_codes: '',
  psc_codes: '',
  contract_vehicle: '',
  poc_name: '',
  poc_email: '',
  notes: '',
};

export default function WorkshopForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<WorkshopInput>(
    initial
      ? {
          title: initial.title,
          ipt_name: initial.ipt_name,
          agency: initial.agency,
          sub_agency: initial.sub_agency ?? '',
          workshop_date: initial.workshop_date,
          facilitators: initial.facilitators ?? '',
          naics_codes: initial.naics_codes ?? '',
          psc_codes: initial.psc_codes ?? '',
          contract_vehicle: initial.contract_vehicle ?? '',
          poc_name: initial.poc_name ?? '',
          poc_email: initial.poc_email ?? '',
          notes: initial.notes ?? '',
        }
      : emptyForm
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const field = (key: keyof WorkshopInput, label: string, opts?: { type?: string; placeholder?: string; required?: boolean }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
        {label}{opts?.required && <span className="text-rose-500"> *</span>}
      </label>
      <input
        type={opts?.type || 'text'}
        value={form[key] ?? ''}
        placeholder={opts?.placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
      />
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.ipt_name || !form.agency || !form.workshop_date) return;
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-lg font-bold text-slate-900">{initial ? 'Edit Workshop' : 'New CSAW Workshop'}</h3>
          <button type="button" onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">{field('title', 'Workshop Title', { required: true, placeholder: 'e.g. FY24 Cyber Requirements CSAW' })}</div>
          {field('ipt_name', 'IPT', { required: true, placeholder: 'e.g. Enterprise Cyber IPT' })}
          {field('workshop_date', 'Workshop Date', { type: 'date', required: true })}
          {field('agency', 'Agency', { required: true, placeholder: 'e.g. Department of the Army' })}
          {field('sub_agency', 'Sub-Agency / Office')}
          {field('naics_codes', 'NAICS Code(s)', { placeholder: 'comma-separated, e.g. 541512, 541519' })}
          {field('psc_codes', 'PSC Code(s)', { placeholder: 'comma-separated, e.g. D302, D307' })}
          {field('contract_vehicle', 'Contract Vehicle', { placeholder: 'e.g. GSA MAS, SEWP, IDIQ name' })}
          {field('facilitators', 'Facilitator(s)')}
          {field('poc_name', 'IPT Point of Contact')}
          {field('poc_email', 'POC Email', { type: 'email' })}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              placeholder="Workshop context, outcomes, key takeaways..."
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : initial ? 'Save Changes' : 'Create Workshop'}
          </button>
        </div>
      </form>
    </div>
  );
}
