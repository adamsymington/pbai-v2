import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { RefreshCw, DollarSign, FileText, Building2, GraduationCap } from 'lucide-react';
import { AnalyticsSummary } from '../types';
import { getAnalyticsSummary } from '../api';

const INDIGO = '#4f46e5';

function formatMoney(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

function StatTile({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <div className="p-5">
        <span className="text-2xl font-black text-slate-900">{value}</span>
      </div>
    </div>
  );
}

const chartTickStyle = { fontSize: 11, fill: '#64748b' };

export default function ImpactDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const summary = await getAnalyticsSummary();
      setData(summary);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading impact data...
      </div>
    );
  }

  const { totals } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatTile icon={GraduationCap} label="Workshops Held" value={String(data.workshopCount)} accent="text-indigo-600" />
        <StatTile icon={FileText} label="Contracts Tracked" value={String(totals.contract_count)} accent="text-emerald-600" />
        <StatTile icon={DollarSign} label="Obligated Value Influenced" value={formatMoney(totals.total_obligated)} accent="text-emerald-600" />
        <StatTile icon={DollarSign} label="Total Ceiling Value" value={formatMoney(totals.total_ceiling_value)} accent="text-amber-600" />
        <StatTile icon={Building2} label="Agencies Impacted" value={String(totals.agencies_impacted)} accent="text-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Obligated Value by Agency</h3>
          {data.byAgency.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byAgency} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={formatMoney} tick={chartTickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="agency" width={140} tick={chartTickStyle} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total_obligated" fill={INDIGO} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Obligated Value by IPT</h3>
          {data.byIpt.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byIpt} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={formatMoney} tick={chartTickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="ipt_name" width={140} tick={chartTickStyle} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total_obligated" fill={INDIGO} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Obligated Value Over Time</h3>
        {data.byMonth.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.byMonth} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={chartTickStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatMoney} tick={chartTickStyle} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="total_obligated" stroke={INDIGO} strokeWidth={2} dot={{ r: 3, fill: INDIGO }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No linked contracts yet</div>;
}
