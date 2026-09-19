import React, { useState } from "react";
import { Users, Plus, Edit2, Trash2, Clock, MapPin, ExternalLink, Phone, ShieldCheck, UserCheck, RefreshCw, Check, X, Coins } from "lucide-react";
import { WorkerProfile, WorkLogEntry, createWorker, updateWorker, deleteWorker } from "../utils/api";
import { translations, Language } from "../utils/i18n";

interface WorkerManagerViewProps {
  workers: WorkerProfile[];
  logs: WorkLogEntry[];
  onRefreshWorkers: () => void;
  onRefreshLogs: () => void;
  lang: Language;
}

export const WorkerManagerView: React.FC<WorkerManagerViewProps> = ({
  workers,
  logs,
  onRefreshWorkers,
  onRefreshLogs,
  lang,
}) => {
  const t = translations[lang];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerProfile | null>(null);
  const [formData, setFormData] = useState<Omit<WorkerProfile, "id">>({
    name: "",
    hourlyRate: "15.00",
    role: "Operaio",
    phone: "",
    pin: "1234",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active clocked in workers right now
  const activeLogs = logs.filter((l) => l.isClockedIn === 1 || !l.endTime);

  const openNewWorkerModal = () => {
    setEditingWorker(null);
    setFormData({
      name: "",
      hourlyRate: "15.00",
      role: "Operaio",
      phone: "",
      pin: "1234",
    });
    setIsModalOpen(true);
  };

  const openEditWorkerModal = (worker: WorkerProfile) => {
    setEditingWorker(worker);
    setFormData({
      name: worker.name,
      hourlyRate: worker.hourlyRate || "15.00",
      role: worker.role || "Operaio",
      phone: worker.phone || "",
      pin: worker.pin || "1234",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    setMsg(null);
    try {
      if (editingWorker) {
        await updateWorker({
          ...editingWorker,
          name: formData.name.trim(),
          hourlyRate: formData.hourlyRate,
          role: formData.role,
          phone: formData.phone || null,
          pin: formData.pin?.trim() || "1234",
        });
        setMsg({ type: "success", text: t.workerUpdatedSuccess });
      } else {
        await createWorker({
          name: formData.name.trim(),
          hourlyRate: formData.hourlyRate,
          role: formData.role,
          phone: formData.phone || null,
          pin: formData.pin?.trim() || "1234",
        });
        setMsg({ type: "success", text: t.workerAddedSuccess });
      }
      setIsModalOpen(false);
      onRefreshWorkers();
      onRefreshLogs();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Errore durante il salvataggio" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (workerId: number) => {
    if (confirm(t.confirmDeleteWorker)) {
      await deleteWorker(workerId);
      onRefreshWorkers();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">{t.navWorkers}</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestisci i dipendenti, imposta la tariffa oraria (€/h) per ciascun lavoratore e monitora le presenze.
          </p>
        </div>

        <button
          onClick={openNewWorkerModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.btnAddWorker}</span>
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 1: LIVE ATTENDANCE BOARD (Who is working right now?) */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t.liveBoardTitle}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {t.liveBoardSub}
            </p>
          </div>

          <div className="bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200">
            {activeLogs.length} {lang === "ar" ? "عمال في الخدمة" : "in servizio"}
          </div>
        </div>

        {activeLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            <UserCheck className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
            <p>{t.noActiveWorkers}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLogs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="bg-slate-800/90 border border-slate-700/90 rounded-xl p-4 space-y-3 relative overflow-hidden backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/50 flex items-center justify-center font-bold text-sm text-blue-300">
                      {(log.workerName || "M")[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{log.workerName || "Lavoratore"}</h4>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {t.currentlyWorking}
                      </span>
                    </div>
                  </div>
                  <span className="bg-blue-950 text-blue-300 text-xs px-2.5 py-1 rounded-md border border-blue-800 font-mono font-bold">
                    {log.startTime}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span className="truncate">{log.locationName}</span>
                  </div>
                  {log.address && (
                    <div className="text-[11px] text-slate-400 pl-5 truncate">
                      {log.address}
                    </div>
                  )}
                  {log.notes && (
                    <div className="text-[11px] text-amber-300/80 pl-5 italic truncate">
                      "{log.notes}"
                    </div>
                  )}
                </div>

                {(log.latitude || log.address) && (
                  <a
                    href={
                      log.latitude && log.longitude
                        ? `https://www.google.com/maps?q=${log.latitude},${log.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            log.address || log.locationName
                          )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold transition-all"
                  >
                    <span>{t.openMap}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 2: WORKER LIST & HOURLY RATES TABLE */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-600" />
            <span>Elenco Dipendenti e Tariffe Orarie</span>
          </h3>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {workers.length} {lang === "ar" ? "عمال مسجلين" : "Lavoratori"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3.5">{t.workerLabel}</th>
                <th className="px-4 py-3.5">{t.workerRole}</th>
                <th className="px-4 py-3.5">🔑 PIN / Password</th>
                <th className="px-4 py-3.5">{t.workerPhone}</th>
                <th className="px-4 py-3.5">{t.hourlyRateLabel}</th>
                <th className="px-4 py-3.5">Giorni / Ore Registrate</th>
                <th className="px-4 py-3.5 text-right">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((worker) => {
                const workerLogs = logs.filter(
                  (l) => l.workerId === worker.id || l.workerName === worker.name
                );
                const totalHours = workerLogs.reduce(
                  (acc, l) => acc + (parseFloat(l.totalHours) || 0),
                  0
                );

                return (
                  <tr key={worker.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shadow-sm">
                          {worker.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{worker.name}</div>
                          <div className="text-xs text-slate-400">ID: #{worker.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {worker.role || "Operaio"}
                      </span>
                    </td>

                    {/* Worker PIN */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-sm">
                        🔑 {worker.pin || "1234"}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                      {worker.phone ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{worker.phone}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Hourly Rate */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        € {parseFloat(worker.hourlyRate || "15.00").toFixed(2)} / h
                      </span>
                    </td>

                    {/* Stats */}
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-600">
                      <div>
                        <strong>{workerLogs.length}</strong> {lang === "ar" ? "أيام مسجلة" : "giorni"} ({totalHours.toFixed(1)} h)
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 whitespace-nowrap text-right space-x-1">
                      <button
                        onClick={() => openEditWorkerModal(worker)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title={t.btnEditWorker}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWorker(worker.id)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* ADD / EDIT WORKER MODAL */}
      {/* ------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingWorker ? t.btnEditWorker : t.btnAddWorker}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.workerNameLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="es: Mario Rossi / محمد علي"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                  <span>{lang === "ar" ? "🔑 رمز مرور العامل (PIN / Password): *" : "🔑 PIN Personale Lavoratore: *"}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {lang === "ar" ? "الرمز السري للدخول" : "Codice segreto"}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.pin || ""}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="1234"
                  maxLength={8}
                  className="w-full px-3.5 py-2.5 bg-amber-50/60 border border-amber-300 rounded-lg text-sm text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.hourlyRateLabel} (€/h) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    required
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    placeholder="15.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-400 text-sm font-bold">€ / h</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.workerRole}
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="es: Operaio Edile, Elettricista, Tecnico..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.workerPhone}
                </label>
                <input
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="es: +39 340 1234567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-semibold"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-md transition-all flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingWorker ? t.btnSaveSettings : t.btnAddWorker}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
