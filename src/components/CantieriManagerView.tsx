import React, { useState } from "react";
import { Building2, Plus, Edit2, Trash2, MapPin, ExternalLink, Check, X, RefreshCw, Crosshair, ShieldCheck, Clock, Users, HardHat } from "lucide-react";
import { WorkSite, WorkLogEntry, createWorkSite, updateWorkSite, deleteWorkSite } from "../utils/api";
import { translations, Language } from "../utils/i18n";
import { reverseGeocode } from "../utils/italian";

interface CantieriManagerViewProps {
  cantieri: WorkSite[];
  logs: WorkLogEntry[];
  onRefreshCantieri: () => void;
  lang: Language;
}

export const CantieriManagerView: React.FC<CantieriManagerViewProps> = ({
  cantieri,
  logs,
  onRefreshCantieri,
  lang,
}) => {
  const t = translations[lang];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<WorkSite | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState<Omit<WorkSite, "id">>({
    name: "",
    code: "",
    address: "",
    latitude: 45.4642,
    longitude: 9.1900,
    radiusKm: 2.0,
    clientName: "",
    status: "attivo",
  });

  const openNewSiteModal = () => {
    setEditingSite(null);
    setFormData({
      name: "",
      code: `CNT-${cantieri.length + 1}`,
      address: "",
      latitude: null,
      longitude: null,
      radiusKm: 2.0,
      clientName: "",
      status: "attivo",
    });
    setIsModalOpen(true);
  };

  const openEditSiteModal = (site: WorkSite) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      code: site.code || "",
      address: site.address,
      latitude: site.latitude ?? null,
      longitude: site.longitude ?? null,
      radiusKm: site.radiusKm || 2.0,
      clientName: site.clientName || "",
      status: site.status || "attivo",
    });
    setIsModalOpen(true);
  };

  // Get current GPS coords and reverse geocode
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(lang === "ar" ? "خدمة الموقع غير مدعومة في هذا الجهاز" : "Geolocalizzazione non supportata");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setFormData((prev) => ({
          ...prev,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lon.toFixed(6)),
        }));

        try {
          const addr = await reverseGeocode(lat, lon);
          if (addr && !formData.address) {
            setFormData((prev) => ({ ...prev, address: addr }));
          }
        } catch (e) {
          console.error("Geocoding failed", e);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        alert(lang === "ar" ? "تعذر تحديد الموقع الحالي: " + err.message : "Errore GPS: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    setMsg(null);
    try {
      if (editingSite) {
        await updateWorkSite({
          ...editingSite,
          name: formData.name.trim(),
          code: formData.code?.trim(),
          address: formData.address.trim(),
          latitude: formData.latitude ? Number(formData.latitude) : null,
          longitude: formData.longitude ? Number(formData.longitude) : null,
          radiusKm: Number(formData.radiusKm) || 2.0,
          clientName: formData.clientName?.trim(),
          status: formData.status || "attivo",
        });
        setMsg({ type: "success", text: lang === "ar" ? "تم تحديث موقع العمل بنجاح!" : "Cantiere aggiornato con successo!" });
      } else {
        await createWorkSite({
          name: formData.name.trim(),
          code: formData.code?.trim() || `CNT-${cantieri.length + 1}`,
          address: formData.address.trim(),
          latitude: formData.latitude ? Number(formData.latitude) : null,
          longitude: formData.longitude ? Number(formData.longitude) : null,
          radiusKm: Number(formData.radiusKm) || 2.0,
          clientName: formData.clientName?.trim(),
          status: formData.status || "attivo",
        });
        setMsg({ type: "success", text: lang === "ar" ? "تم إضافة موقع العمل بنجاح!" : "Nuovo cantiere aggiunto con successo!" });
      }
      setIsModalOpen(false);
      onRefreshCantieri();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Errore durante il salvataggio" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (confirm(lang === "ar" ? "هل أنت متأكد من حذف هذا الموقع؟" : "Sei sicuro di voler eliminare questo cantiere?")) {
      await deleteWorkSite(id);
      onRefreshCantieri();
    }
  };

  const activeCantieriCount = cantieri.filter((c) => c.status === "attivo").length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
      
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {lang === "ar" ? "إدارة مواقع العمل والمشاريع (Cantieri) 🏗️" : "Gestione Cantieri & Luoghi di Lavoro 🏗️"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === "ar"
                  ? "إدارة مواقع البناء، تحديد إحداثيات الـ GPS ونطاق السياج الجغرافي لكل مشروع."
                  : "Definisci cantieri, assegna coordinate GPS e perimetri geofence per il tracciamento presenze."}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openNewSiteModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === "ar" ? "+ إضافة موقع جديد" : "+ Nuovo Cantiere"}</span>
        </button>
      </div>

      {/* Alert Messages */}
      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              {lang === "ar" ? "إجمالي المشاريع" : "Totale Cantieri"}
            </span>
            <div className="text-2xl font-black text-slate-900">{cantieri.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              {lang === "ar" ? "المشاريع النشطة" : "Cantieri Attivi"}
            </span>
            <div className="text-2xl font-black text-emerald-700">{activeCantieriCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              {lang === "ar" ? "ساعات مسجلة بالمواقع" : "Ore Lavorate"}
            </span>
            <div className="text-2xl font-black text-amber-700">
              {logs.reduce((sum, l) => sum + (parseFloat(l.totalHours) || 0), 0).toFixed(1)} h
            </div>
          </div>
        </div>
      </div>

      {/* Cantieri Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cantieri.map((site) => {
          const siteLogs = logs.filter(
            (l) => l.locationName === site.name || (l.address && l.address.includes(site.name))
          );
          const totalHours = siteLogs.reduce((acc, l) => acc + (parseFloat(l.totalHours) || 0), 0);

          return (
            <div
              key={site.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header: Name and Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600 mb-1">
                      {site.code || "CNT"}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">{site.name}</h3>
                    {site.clientName && (
                      <p className="text-xs text-slate-500 font-medium">👤 {site.clientName}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                      site.status === "attivo"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {site.status === "attivo" ? (lang === "ar" ? "🟢 نشط" : "🟢 Attivo") : (lang === "ar" ? "⚪ مكتمل" : "⚪ Completato")}
                  </span>
                </div>

                {/* Address */}
                <div className="text-xs text-slate-600 flex items-start gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{site.address || "Indirizzo non specificato"}</span>
                </div>

                {/* GPS Info & Geofence Radius */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span>
                    🌐 {site.latitude ? `${site.latitude.toFixed(4)}, ${site.longitude?.toFixed(4)}` : "GPS non impostato"}
                  </span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    🎯 {site.radiusKm || 2.0} km
                  </span>
                </div>
              </div>

              {/* Footer: Stats and Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-600 font-medium">
                  <strong>{siteLogs.length}</strong> {lang === "ar" ? "تسجيل" : "turni"} ({totalHours.toFixed(1)} h)
                </div>

                <div className="flex items-center gap-1">
                  {site.latitude && site.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t.openMap}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => openEditSiteModal(site)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                    title="Modifica"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HardHat className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  {editingSite ? (lang === "ar" ? "تعديل موقع العمل" : "Modifica Cantiere") : (lang === "ar" ? "إضافة موقع عمل جديد" : "Nuovo Cantiere")}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  {lang === "ar" ? "اسم موقع العمل / المشروع: *" : "Nome Cantiere / Progetto: *"}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="es: Cantiere Ospedale Sacco / مشروع ميلانو"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    {lang === "ar" ? "كود المشروع:" : "Codice Cantiere:"}
                  </label>
                  <input
                    type="text"
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="es: MIL-01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    {lang === "ar" ? "اسم العميل / المقاول:" : "Cliente / Committente:"}
                  </label>
                  <input
                    type="text"
                    value={formData.clientName || ""}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="es: Comune di Milano / Privato"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  {lang === "ar" ? "العنوان بالكامل: *" : "Indirizzo Sede / Cantiere: *"}
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="es: Via Giovanni Battista Grassi 74, Milano"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* GPS Coordinates & Geofence */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>{lang === "ar" ? "إحداثيات الـ GPS ونطاق السياج الجغرافي:" : "Coordinate GPS e Geofence:"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${locating ? "animate-spin" : ""}`} />
                    <span>{locating ? (lang === "ar" ? "جاري التحديد..." : "Rilevamento...") : (lang === "ar" ? "موقعي الحالي 📍" : "Posizione Attuale 📍")}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Latitudine</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude ?? ""}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="45.5188"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Longitudine</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude ?? ""}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="9.1245"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      {lang === "ar" ? "نطاق السياج (كم)" : "Raggio Geofence"}
                    </label>
                    <select
                      value={formData.radiusKm || 2.0}
                      onChange={(e) => setFormData({ ...formData, radiusKm: parseFloat(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value={1.0}>1.0 km (1000m)</option>
                      <option value={2.0}>2.0 km (2000m)</option>
                      <option value={3.0}>3.0 km (3000m)</option>
                      <option value={5.0}>5.0 km (5000m)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  {lang === "ar" ? "حالة المشروع:" : "Stato Cantiere:"}
                </label>
                <select
                  value={formData.status || "attivo"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "attivo" | "completato" })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="attivo">{lang === "ar" ? "🟢 نشط وشغال (Attivo)" : "🟢 Attivo"}</option>
                  <option value="completato">{lang === "ar" ? "⚪ مشروع مكتمل (Completato)" : "⚪ Completato"}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingSite ? t.btnSaveSettings : (lang === "ar" ? "إضافة الموقع" : "Crea Cantiere")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
