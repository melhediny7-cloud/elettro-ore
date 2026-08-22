import React, { useState, useEffect } from "react";
import { Building2, MapPin, Database, RefreshCw, Check, Trash2, ShieldCheck, Lock, Shield, KeyRound, AlertCircle, Navigation, Compass, ShieldAlert } from "lucide-react";
import { seedSampleData, clearAllWorkLogs, clearAllWorkers, changeAdminPin, updateAppSettings } from "../utils/api";
import { parseWorkplaceZone, formatWorkplaceZone, reverseGeocode } from "../utils/italian";
import { translations, Language } from "../utils/i18n";

interface SettingsViewProps {
  companyName: string;
  setCompanyName: (name: string) => void;
  defaultLocation: string;
  setDefaultLocation: (loc: string) => void;
  adminPin: string;
  setAdminPin: (pin: string) => void;
  onRefresh: () => void;
  lang: Language;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  companyName,
  setCompanyName,
  defaultLocation,
  setDefaultLocation,
  adminPin,
  setAdminPin,
  onRefresh,
  lang,
}) => {
  const t = translations[lang];
  const [saved, setSaved] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);

  // Geofence Zone state
  const initialZone = parseWorkplaceZone(defaultLocation);
  const [zoneName, setZoneName] = useState(initialZone.name);
  const [zoneLat, setZoneLat] = useState(String(initialZone.lat));
  const [zoneLng, setZoneLng] = useState(String(initialZone.lng));
  const [zoneRadius, setZoneRadius] = useState(String(initialZone.radiusKm || 3.0));
  const [geoLocLoading, setGeoLocLoading] = useState(false);

  // Sync if defaultLocation prop updates
  useEffect(() => {
    const z = parseWorkplaceZone(defaultLocation);
    setZoneName(z.name);
    setZoneLat(String(z.lat));
    setZoneLng(String(z.lng));
    setZoneRadius(String(z.radiusKm || 3.0));
  }, [defaultLocation]);

  const handleDetectAdminGPS = () => {
    if (!navigator.geolocation) {
      alert(lang === "ar" ? "المتصفح لا يدعم تحديد الموقع" : "Geolocalizzazione non supportata");
      return;
    }
    setGeoLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setZoneLat(String(latitude.toFixed(5)));
        setZoneLng(String(longitude.toFixed(5)));
        const addr = await reverseGeocode(latitude, longitude);
        if (addr) setZoneName(addr);
        setGeoLocLoading(false);
      },
      (err) => {
        setGeoLocLoading(false);
        console.warn("Admin GPS error", err);
        alert(lang === "ar" ? "تعذر تحديد الموقع، يرجى تفعيل الـ GPS في جهازك." : "Impossibile rilevare GPS. Attiva i permessi.");
      },
      { enableHighAccuracy: true }
    );
  };

  // PIN Change State
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const encodedLocation = formatWorkplaceZone(zoneName, zoneLat, zoneLng, zoneRadius);
    setDefaultLocation(encodedLocation);

    if (typeof window !== "undefined") {
      localStorage.setItem("oralavoro_companyName", companyName);
      localStorage.setItem("oralavoro_defaultLocation", encodedLocation);
    }

    try {
      await updateAppSettings({
        companyName,
        defaultLocation: encodedLocation,
      });
    } catch (e) {
      console.warn("Could not sync settings to cloud", e);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    if (newPinInput.length < 4) {
      setPinMessage({
        type: "error",
        text: lang === "ar" ? "يجب أن يتكون الرمز الجديد من 4 أرقام على الأقل" : "Il nuovo PIN deve contenere almeno 4 cifre",
      });
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinMessage({
        type: "error",
        text: lang === "ar" ? "تأكيد الرمز الجديد غير متطابق" : "I due nuovi PIN non coincidono",
      });
      return;
    }

    setPinChangeLoading(true);
    try {
      const res = await changeAdminPin(currentPinInput, newPinInput);
      if (res.success) {
        setAdminPin(newPinInput);
        setPinMessage({
          type: "success",
          text: lang === "ar" ? "تم تغيير وتأمين رمز الإدارة بنجاح!" : "PIN Amministratore aggiornato con successo!",
        });
        setCurrentPinInput("");
        setNewPinInput("");
        setConfirmPinInput("");
      } else {
        setPinMessage({
          type: "error",
          text: res.message || (lang === "ar" ? "الرمز الحالي غير صحيح" : "PIN attuale errato"),
        });
      }
    } catch {
      setPinMessage({
        type: "error",
        text: lang === "ar" ? "فشل تحديث الرمز" : "Errore durante l'aggiornamento del PIN",
      });
    } finally {
      setPinChangeLoading(false);
    }
  };

  const handleSeedData = async () => {
    setLoadingSeed(true);
    try {
      await seedSampleData();
      await onRefresh();
      alert(t.seedSuccess);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSeed(false);
    }
  };

  const handleClearAllData = async () => {
    if (confirm(t.confirmClearAll)) {
      setLoadingClear(true);
      try {
        await clearAllWorkLogs();
        await clearAllWorkers();
        await onRefresh();
        alert(t.clearSuccess);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingClear(false);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{t.settingsTitle}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {t.settingsDesc}
        </p>
      </div>

      {/* 1. SECURE ADMIN PIN CHANGE CARD */}
      <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t.adminPinLabel}</h3>
            <p className="text-xs text-slate-500">
              {lang === "ar"
                ? "لحماية لوحة المدير: يجب إدخال الرمز الحالي لتتمكن من تعيين رمز جديد"
                : "Proteggi il pannello: inserisci il PIN attuale per impostarne uno nuovo"}
            </p>
          </div>
        </div>

        {/* Status Alert */}
        {pinMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              pinMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {pinMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{pinMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePin} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Current PIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                {lang === "ar" ? "الرمز الحالي" : "PIN Attuale"} *
              </label>
              <input
                type="password"
                required
                maxLength={8}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tracking-widest font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* New PIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                {lang === "ar" ? "الرمز الجديد" : "Nuovo PIN"} *
              </label>
              <input
                type="password"
                required
                maxLength={8}
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tracking-widest font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Confirm New PIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                {lang === "ar" ? "تأكيد الرمز الجديد" : "Conferma Nuovo"} *
              </label>
              <input
                type="password"
                required
                maxLength={8}
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tracking-widest font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pinChangeLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {pinChangeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{lang === "ar" ? "تغيير وتأمين الرمز السري" : "Modifica e Proteggi PIN"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. COMPANY METADATA & GEOFENCING SETTINGS */}
      <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              <span>{lang === "ar" ? "إعدادات الشركة وتحديد نطاق موقع العمل (Geofencing GPS)" : "Azienda e Zona Geofencing Cantiere (GPS 3 km)"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === "ar"
                ? "حدد موقع العمل الفعلي ومحيط الـ GPS (مثلاً 3 كم) لمنع العمال من تسجيل الحضور من خارج الورشة."
                : "Imposta le coordinate del cantiere e il raggio di tolleranza (es: 3 km) per bloccare le timbrature fuori sede."}
            </p>
          </div>
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg border border-blue-200">
            GPS 3 KM
          </span>
        </div>

        <form onSubmit={handleSaveCompanySettings} className="space-y-4">
          
          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>{t.companyNameLabel}</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="es: Power / Edilizia s.r.l."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cantiere / Workplace Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>{lang === "ar" ? "اسم موقع العمل / الورشة (Cantiere / Sede)" : "Nome Cantiere / Luogo Principale"}</span>
            </label>
            <input
              type="text"
              required
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="es: Cantiere Milano / Ospedale Sacco"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Workplace GPS Coordinates & Detect Button */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">
                {lang === "ar" ? "📍 إحداثيات موقع العمل الجغرافية (GPS)" : "📍 Coordinate Centro Cantiere"}
              </span>
              <button
                type="button"
                onClick={handleDetectAdminGPS}
                disabled={geoLocLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
              >
                {geoLocLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                <span>{lang === "ar" ? "تحديد موقعي الحالي كمركز العمل 📍" : "Rileva Mia Posizione 📍"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Latitude (خط العرض)</label>
                <input
                  type="text"
                  required
                  value={zoneLat}
                  onChange={(e) => setZoneLat(e.target.value)}
                  placeholder="45.4642"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Longitude (خط الطول)</label>
                <input
                  type="text"
                  required
                  value={zoneLng}
                  onChange={(e) => setZoneLng(e.target.value)}
                  placeholder="9.1900"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                  {lang === "ar" ? "نطاق السماح (Radius)" : "Raggio Tolleranza (km)"}
                </label>
                <select
                  value={zoneRadius}
                  onChange={(e) => setZoneRadius(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1.0">1.0 km (نطاق ضيق جداً)</option>
                  <option value="2.0">2.0 km</option>
                  <option value="3.0">3.0 km (الموصى به - محيط 3 كم)</option>
                  <option value="5.0">5.0 km</option>
                  <option value="10.0">10.0 km (نطاق مدينة كاملة)</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-medium">
              💡 {lang === "ar" 
                ? `أي عامل يبعد أكثر من ${zoneRadius} كم عن هذه الإحداثيات سيتم حظره وتنبيهه بالعودة لموقع العمل.`
                : `Qualsiasi lavoratore a più di ${zoneRadius} km da questo punto sarà bloccato e allertato.`}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {saved ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> {t.settingsSaved}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Tutte le impostazioni sono salvate sul cloud Supabase</span>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{t.btnSaveSettings}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. DATABASE & CLOUD TOOLS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <span>{t.dbTitle}</span>
        </h3>
        <p className="text-sm text-slate-500">
          {t.dbDesc}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleSeedData}
            disabled={loadingSeed}
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingSeed ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>{t.btnSeed}</span>
          </button>

          <button
            onClick={handleClearAllData}
            disabled={loadingClear}
            className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingClear ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{t.btnClearDb}</span>
          </button>
        </div>
      </div>

      {/* 4. IMPORT HISTORICAL DATA MODAL / CARD */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <span>{lang === "ar" ? "استيراد بيانات أو سجلات سابقة" : "Importa Dati e Registri Precedenti"}</span>
        </h3>
        <p className="text-xs text-slate-500">
          {lang === "ar" 
            ? "إذا كان لديك كود بيانات محفوظ سابقاً، يمكنك لصقه هنا لإضافته فوراً إلى قاعدة البيانات السحابية." 
            : "Incolla il JSON dei dati salvati precedentemente per importarli direttamente su Supabase Cloud."}
        </p>

        <textarea
          id="jsonImportBox"
          rows={3}
          placeholder='[{"date":"2026-08-20","workerName":"Mario Rossi","startTime":"08:00","endTime":"17:00","totalHours":"8.00"}]'
          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={async () => {
            const el = document.getElementById("jsonImportBox") as HTMLTextAreaElement;
            if (!el || !el.value.trim()) {
              alert(lang === "ar" ? "الرجاء لصق البيانات أولاً" : "Incolla prima i dati JSON");
              return;
            }
            try {
              const res = await (await import("../utils/api")).importDataFromJson(el.value);
              if (res.success) {
                alert(res.message);
                el.value = "";
                onRefresh();
              } else {
                alert(res.message);
              }
            } catch (e: any) {
              alert("Errore: " + e.message);
            }
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all"
        >
          {lang === "ar" ? "📥 استيراد وحفظ في السحابة الآن" : "📥 Importa su Cloud Ora"}
        </button>
      </div>

      {/* Cloud Persistence Badge */}
      <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <span className="font-semibold text-white block">Netlify Postgres Database & Auth Serverless</span>
          Tutti i dati dei dipendenti, delle ore e la sicurezza del PIN sono gestiti e protetti sul cloud.
        </div>
      </div>
    </div>
  );
};
