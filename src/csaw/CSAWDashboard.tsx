import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Users, ArrowLeft } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Workshop, TrackedContract } from './types';
import { listWorkshops, createWorkshop, updateWorkshop, deleteWorkshop, listTrackedContracts } from './api';
import WorkshopList from './components/WorkshopList';
import WorkshopForm from './components/WorkshopForm';
import ContractSearchPanel from './components/ContractSearchPanel';
import TrackedContractsList from './components/TrackedContractsList';
import ImpactDashboard from './components/ImpactDashboard';

export default function CSAWDashboard() {
  const [view, setView] = useState<'workshops' | 'impact'>('workshops');
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Workshop | null | 'new'>(null);
  const [trackedContracts, setTrackedContracts] = useState<TrackedContract[]>([]);

  const loadWorkshops = async () => {
    const data = await listWorkshops();
    setWorkshops(data);
    if (!selectedId && data.length > 0) setSelectedId(data[0].id);
  };

  useEffect(() => { loadWorkshops(); }, []);

  useEffect(() => {
    if (!selectedId) { setTrackedContracts([]); return; }
    listTrackedContracts(selectedId).then(setTrackedContracts);
  }, [selectedId]);

  const selectedWorkshop = workshops.find((w) => w.id === selectedId) || null;

  const handleCreateOrUpdate = async (input: any) => {
    try {
      if (editing === 'new') {
        const created = await createWorkshop(input);
        toast.success('Workshop created');
        setEditing(null);
        await loadWorkshops();
        setSelectedId(created.id);
      } else if (editing) {
        await updateWorkshop(editing.id, input);
        toast.success('Workshop updated');
        setEditing(null);
        await loadWorkshops();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save workshop');
    }
  };

  const handleDelete = async (workshop: Workshop) => {
    if (!confirm(`Delete "${workshop.title}"? This also removes its tracked contract links.`)) return;
    try {
      await deleteWorkshop(workshop.id);
      toast.success('Workshop deleted');
      if (selectedId === workshop.id) setSelectedId(null);
      await loadWorkshops();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workshop');
    }
  };

  const refreshTracked = () => {
    if (selectedId) listTrackedContracts(selectedId).then(setTrackedContracts);
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900 font-sans">
      <Toaster position="top-right" richColors />
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shadow-md">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">CSAW Contract Impact Dashboard</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Track contracts influenced by past CSAW workshops</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              {([
                { id: 'workshops', label: 'Workshops', icon: Users },
                { id: 'impact', label: 'Impact Dashboard', icon: LayoutDashboard },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
            <Link to="/" className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg">
              <ArrowLeft className="w-3.5 h-3.5" /> PBAi
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === 'impact' ? (
          <ImpactDashboard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 h-[calc(100vh-160px)]">
              <WorkshopList
                workshops={workshops}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onNew={() => setEditing('new')}
                onEdit={(w) => setEditing(w)}
                onDelete={handleDelete}
              />
            </div>
            <div className="lg:col-span-2 space-y-6">
              {selectedWorkshop ? (
                <>
                  <ContractSearchPanel workshop={selectedWorkshop} onLinked={refreshTracked} />
                  <TrackedContractsList contracts={trackedContracts} onChanged={refreshTracked} />
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
                  Select or create a CSAW workshop to search and link contracts.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {editing && (
        <WorkshopForm
          initial={editing === 'new' ? null : editing}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
