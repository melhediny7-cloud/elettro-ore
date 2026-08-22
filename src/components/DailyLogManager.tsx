import React, { useState } from "react";
import { Plus, Trash2, Edit2, MapPin, Search, Calendar, Clock, ExternalLink, Navigation, Check, X, RefreshCw, Coins, User, Users } from "lucide-react";
import { WorkLogEntry, WorkerProfile, createWorkLog, updateWorkLog, deleteWorkLog, clearAllWorkLogs, calculateNetHours, calculateTotalPay } from "../utils/api";
import { formatDateIT, getCurrentDateISO, PRESET_LOCATIONS_IT, WORK_TYPES_IT, reverseGeocode, parseWorkplaceZone, verifyWorkerGeofence } from "../utils/italian";
import { translations, Language } from "../utils/i18n";

interface DailyLogManagerProps {
  logs: WorkLogEntry[];
  workers: WorkerProfile[];
  selectedWorker?: WorkerProfile | null;
  onRefresh: () => void;
  defaultLocation: string;
  lang: Language;
  userRole?: "worker" | "admin";
}

export const DailyLogManager: React.FC<DailyLogManagerProps> = ({
  logs,
  workers,
  selectedWorker,
  onRefresh,
  defaultLocation,
  lang,
  userRole = "worker",
}) => {
  const t = translations[lang];
  const workplaceZone = parseWorkplaceZone(defaultLocation);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("TUTTI");
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLogEntry | null>(null);

  const defaultWorker = selectedWorker || workers[0] || { id: 1, name: "Mario Rossi", hourlyRate: "15.00" };

  // Form state
  const [formData, setFormData] = useState<WorkLogEntry>({
    workerId: defaultWorker.id,
    workerName: defaultWorker.name,
    date: getCurrentDateISO(),
    startTime: "07:30",
    endTime: "18:30",
    breakMinutes: 60,
    totalHours: "10.00",
    hourlyRate: defaultWorker.hourlyRate || "15.00",
    totalPay: "150.00",
    workType: "Ordinario",
    locationName: defaultLocation || "Ufficio Sede",
    address: "",
    latitude: "",
    longitude: "",
    notes: "",
    isClockedIn: 0,
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const openNewModal = () => {
    setEditingLog(null);
    const initialRate = defaultWorker.hourlyRate || "15.00";
    const initialHours = calculateNetHours("07:30", "18:30", 60);
    const initialPay = calculateTotalPay(initialHours, initialRate);
    setFormData({
      workerId: defaultWorker.id,
      workerName: defaultWorker.name,
      date: getCurrentDateISO(),
      startTime: "07:30",
      endTime: "18:30",
      breakMinutes: 60,
      totalHours: initialHours,
      hourlyRate: initialRate,
      totalPay: initialPay,
      workType: "Ordinario",
      locationName: defaultLocation || "Ufficio Sede",
      address: "",
      latitude: "",
      longitude: "",
      notes: "",
      isClockedIn: 0,
    });
    setIsModalOpen(true);

    if (userRole === "worker") {
      setTimeout(() => handleDetectGPSInModal(), 200);
    }
  };

  const openEditModal = (log: WorkLogEntry) => {
    setEditingLog(log);
    const matchingWorker = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
    const rateToUse = log.hourlyRate ? String(log.hourlyRate) : matchingWorker?.hourlyRate || "15.00";
    const hoursToUse = log.totalHours || calculateNetHours(log.startTime, log.endTime || "18:00", log.breakMinutes || 0);
    const payToUse = log.totalPay || calculateTotalPay(hoursToUse, rateToUse);

    setFormData({
      ...log,
      workerId: log.workerId || matchingWorker?.id || null,
      workerName: log.workerName || matchingWorker?.name || "Mario Rossi",
      endTime: log.endTime || "18:00",
      breakMinutes: log.breakMinutes !== undefined ? log.breakMinutes : 0,
      hourlyRate: rateToUse,
      totalPay: payToUse,
      address: log.address || "",
      latitude: log.latitude || "",
      longitude: log.longitude || "",
      notes: log.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleWorkerChangeInModal = (workerIdStr: string) => {
    const selected = workers.find((w) => String(w.id) === workerIdStr);
    if (!selected) return;

    const netHours = calculateNetHours(formData.startTime, formData.endTime || "", formData.breakMinutes);
    const newPay = calculateTotalPay(netHours, selected.hourlyRate);

    setFormData((prev) => ({
      ...prev,
      workerId: selected.id,
      workerName: selected.name,
      hourlyRate: selected.hourlyRate,
      totalPay: newPay,
    }));
  };

  const handleDetectGPSInModal = () => {
    if (!navigator.geolocation) {
      alert(lang === "ar" ? "المتصفح لا يدعم تحديد الموقع GPS" : "Geolocalizzazione non supportata");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const addr = await reverseGeocode(latitude, longitude);
        setFormData((prev) => ({
          ...prev,
          latitude: String(latitude),
          longitude: String(longitude),
          address: addr || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
        }));
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        console.warn("Geolocation error", err);
        alert(
          lang === "ar"
            ? "⚠️ يرجى السماح للتطبيق بالوصول إلى موقعك GPS من إعدادات المتصفح."
            : "⚠️ Attiva i permessi GPS del browser per rilevare la tua posizione."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // AUTOMATIC GPS & STRICT 3KM GEOFENCE VERIFICATION
    let currentLat = formData.latitude;
    let currentLng = formData.longitude;
    let currentAddr = formData.address;

    if (!currentLat || !currentLng) {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          currentLat = String(pos.coords.latitude);
          currentLng = String(pos.coords.longitude);
          currentAddr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        } catch (e) {
          alert(
            lang === "ar"
              ? "⚠️ تنبيه أمني: لا يمكن تسجيل الساعات بدون تفعيل خدمة الـ GPS في الهاتف وإعطاء الإذن للمتصفح!"
              : "⚠️ Impossibile salvare senza autorizzare la posizione GPS attiva sul dispositivo!"
          );
          return;
        }
      } else {
        alert("Geolocalizzazione GPS non supportata da questo dispositivo.");
        return;
      }
    }

    const check = verifyWorkerGeofence(currentLat, currentLng, workplaceZone);
    if (!check.allowed) {
      alert(
        lang === "ar"
          ? `❌ تم رفض تسجيل الساعات! أنت متواجد خارج موقع العمل (${check.distanceKm} كم من ${workplaceZone.name}). الحد الأقصى المسموح به هو ${workplaceZone.radiusKm} كم.`
          : `❌ Registrazione Rifiutata: Sei fuori dalla zona di lavoro autorizzata (Distanza: ${check.distanceKm} km > ${workplaceZone.radiusKm} km dal cantiere).`
      );
      return;
    }

    setLoading(true);

    const netHours = calculateNetHours(formData.startTime, formData.endTime || "", formData.breakMinutes);
    const rateToUse = formData.hourlyRate ? String(formData.hourlyRate) : "15.00";
    const totalPay = calculateTotalPay(netHours, rateToUse);

    const payload = {
      ...formData,
      workerName: formData.workerName || selectedWorker?.name || "Mario Rossi",
      latitude: currentLat,
      longitude: currentLng,
      address: currentAddr || formData.address,
      totalHours: netHours,
      hourlyRate: rateToUse,
      totalPay: totalPay,
      isClockedIn: 0,
    };

    try {
      if (editingLog && editingLog.id) {
        await updateWorkLog({ ...payload, id: editingLog.id });
      } else {
        await createWorkLog(payload);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error("Error saving log", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(t.confirmDelete)) {
      await deleteWorkLog(id);
      onRefresh();
    }
  };

  const handleClearAll = async () => {
    if (confirm(t.confirmClearAll)) {
      await clearAllWorkLogs();
      onRefresh();
    }
  };

  // Filtering
  const filteredLogs = logs.filter((log) => {
    // If worker mode, strictly only show this worker's logs
    if (userRole === "worker" && selectedWorker) {
      const isMyLog = log.workerId === selectedWorker.id || log.workerName?.trim().toLowerCase() === selectedWorker.name?.trim().toLowerCase();
      if (!isMyLog) return false;
    }

    const matchesSearch =
      (log.workerName && log.workerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.locationName && log.locationName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.address && log.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.date && log.date.includes(searchTerm));

    const matchesType = selectedTypeFilter === "TUTTI" || log.workType === selectedTypeFilter;
    const matchesWorker =
      userRole === "worker"
        ? true
        : selectedWorkerFilter === "ALL" ||
          String(log.workerId) === selectedWorkerFilter ||
          log.workerName === selectedWorkerFilter;

    return matchesSearch && matchesType && matchesWorker;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t.registryTitle}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t.registryDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {logs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-semibold rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.btnClearAll}</span>
            </button>
          )}

          <button
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t.btnNewEntry}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Worker Filter (Manager only) */}
        {userRole === "admin" && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <select
              value={selectedWorkerFilter}
              onChange={(e) => setSelectedWorkerFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t.allWorkers}</option>
              {workers.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name} ({w.hourlyRate}€/h)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Work Type Filter */}
        <select
          value={selectedTypeFilter}
          onChange={(e) => setSelectedTypeFilter(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="TUTTI">{t.filterAllTypes}</option>
          {WORK_TYPES_IT.map((wt) => (
            <option key={wt.id} value={wt.id}>
              {wt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / Cards List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">{t.noEntriesFound}</h3>
            <p className="text-sm text-slate-400 mt-1">
              {t.noEntriesDesc}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">{t.thWorker}</th>
                  <th className="px-4 py-3.5">{t.thDate}</th>
                  <th className="px-4 py-3.5">{t.thTime}</th>
                  <th className="px-4 py-3.5">{t.thBreak}</th>
                  <th className="px-4 py-3.5">{t.thNetHours}</th>
                  {userRole === "admin" && <th className="px-4 py-3.5">{t.thTotalPay}</th>}
                  <th className="px-4 py-3.5">{t.thType}</th>
                  <th className="px-5 py-3.5">{t.thLocation}</th>
                  <th className="px-4 py-3.5 text-right">{t.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y border-slate-100">
                {filteredLogs.map((log) => {
                  const typeObj = WORK_TYPES_IT.find((w) => w.id === log.workType) || WORK_TYPES_IT[0];
                  let rateToUse = "15.00";
                  if (log.hourlyRate) {
                    rateToUse = String(log.hourlyRate);
                  } else {
                    const mw = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
                    if (mw) rateToUse = mw.hourlyRate;
                  }
                  const logPay = log.totalPay || calculateTotalPay(log.totalHours, rateToUse);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Worker Name */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {(log.workerName || "M")[0]}
                          </div>
                          <span>{log.workerName || "Mario Rossi"}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-900">
                        <div className="font-semibold">{formatDateIT(log.date)}</div>
                        <div className="text-xs text-slate-400 font-mono">{log.date}</div>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>{log.startTime}</span>
                          <span className="text-slate-400">→</span>
                          <span>{log.endTime || t.inProgress}</span>
                        </div>
                      </td>

                      {/* Break */}
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                        {log.breakMinutes} min
                      </td>

                      {/* Total Hours */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                          {log.totalHours || "0.00"} h
                        </span>
                      </td>

                      {/* Total Pay (Admin only) */}
                      {userRole === "admin" && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            € {logPay}
                          </span>
                        </td>
                      )}

                      {/* Work Type */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${typeObj.color}`}>
                          {typeObj.label}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-5 py-4 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm block">
                              {log.locationName}
                            </span>
                            {log.address && (
                              <span className="text-xs text-slate-500 block truncate">{log.address}</span>
                            )}
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
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium mt-0.5"
                              >
                                <span>{t.openMap}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap text-right space-x-1">
                        <button
                          onClick={() => openEditModal(log)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Modifica"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {log.id && (
                          <button
                            onClick={() => handleDelete(log.id!)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingLog ? t.modalEditTitle : t.modalNewTitle}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Select Worker */}
              {userRole === "admin" ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t.workerLabel} *
                  </label>
                  <select
                    value={formData.workerId || ""}
                    onChange={(e) => handleWorkerChangeInModal(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.hourlyRate} €/h)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t.workerLabel}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.workerName || selectedWorker?.name || "Lavoratore"}
                    className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-bold cursor-not-allowed"
                  />
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.dateLabel} *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Start Time & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t.startTimeLabel} *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t.endTimeLabel} *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime || "17:30"}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Break Minutes & Hourly Rate (Admin only) */}
              <div className={`grid ${userRole === "admin" ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t.thBreak} (min)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={formData.breakMinutes}
                    onChange={(e) => setFormData({ ...formData, breakMinutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {userRole === "admin" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      {t.hourlyRateLabel}
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={formData.hourlyRate || "15.00"}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Work Type */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.workTypeLabel}
                </label>
                <select
                  value={formData.workType}
                  onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {WORK_TYPES_IT.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Realtime Live Calculation Preview Box */}
              {(() => {
                const liveNetHours = calculateNetHours(formData.startTime, formData.endTime || "", formData.breakMinutes);
                const liveRate = formData.hourlyRate ? String(formData.hourlyRate) : "15.00";
                const liveTotalPay = calculateTotalPay(liveNetHours, liveRate);

                return (
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between text-xs sm:text-sm">
                    <div>
                      <span className="text-slate-500 font-medium block">Ore Nette: <strong className="text-slate-900">{liveNetHours} h</strong></span>
                      <span className="text-slate-500 font-medium block">Sconto Pausa: {formData.breakMinutes}m</span>
                    </div>
                    {userRole === "admin" && (
                      <div className="text-right">
                        <span className="text-xs text-emerald-600 font-bold block">{liveRate} €/h</span>
                        <span className="text-base font-black text-emerald-800 block">€ {liveTotalPay}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Location Name & Mandatory GPS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t.locationLabel} {userRole === "worker" ? "(Posizione GPS Obbligatoria *)" : ""}
                  </label>
                  {formData.latitude ? (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> GPS Verificato
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-600">
                      GPS Non Rilevato
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <select
                    value={formData.locationName}
                    onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRESET_LOCATIONS_IT.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleDetectGPSInModal}
                    disabled={geoLoading}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      formData.latitude
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-blue-600 hover:bg-blue-700 text-white animate-pulse"
                    }`}
                  >
                    {geoLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                    <span>{formData.latitude ? "Aggiorna GPS 📍" : "Rileva GPS 📍"}</span>
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Indirizzo o dettagli cantiere..."
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {userRole === "worker" && !formData.latitude && (
                  <p className="text-[11px] text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                    ⚠️ {lang === "ar" ? "يجب الضغط على زر (Rileva GPS) للتحقق من أنك في موقع العمل قبل الحفظ." : "Devi premere 'Rileva GPS' per verificare la presenza in cantiere prima di salvare."}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t.notesLabel}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Descrizione delle attività svolte..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
                  <span>{t.btnSave}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
