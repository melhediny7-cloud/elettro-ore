import React, { useState } from "react";
import { Building2, MapPin, Database, RefreshCw, Check, Trash2, ShieldCheck, Lock, Shield, KeyRound, AlertCircle } from "lucide-react";
import { seedSampleData, clearAllWorkLogs, changeAdminPin } from "../utils/api";
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

  // PIN Change State
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveCompanySettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("oralavoro_companyName", companyName);
    localStorage.setItem("oralavoro_defaultLocation", defaultLocation);
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

      {/* 2. COMPANY METADATA SETTINGS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <form onSubmit={handleSaveCompanySettings} className="space-y-4">
          
          {/* Company Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>{t.companyNameLabel}</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="es: Edilizia & Restauro s.r.l."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Default Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>{t.defaultLocationLabel}</span>
            </label>
            <input
              type="text"
              required
              value={defaultLocation}
              onChange={(e) => setDefaultLocation(e.target.value)}
              placeholder="es: Ufficio Sede - Milano"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {saved ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> {t.settingsSaved}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Tutti i dati vengono sincronizzati per l'azienda</span>
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
