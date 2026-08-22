import React, { useState } from "react";
import { Clock, Calendar, FileText, Settings, MapPin, Globe, Shield, ShieldCheck, Users, Lock, Unlock, User } from "lucide-react";
import { formatDateIT, getCurrentDateISO } from "../utils/italian";
import { translations, Language } from "../utils/i18n";
import { WorkerProfile, verifyAdminPin } from "../utils/api";

interface HeaderProps {
  activeTab: "timbratrice" | "lavoratori" | "registro" | "report" | "impostazioni";
  setActiveTab: (tab: "timbratrice" | "lavoratori" | "registro" | "report" | "impostazioni") => void;
  userRole: "worker" | "admin";
  setUserRole: (role: "worker" | "admin") => void;
  workers: WorkerProfile[];
  selectedWorker: WorkerProfile | null;
  onSelectWorker: (worker: WorkerProfile) => void;
  adminPin: string;
  lang: Language;
  setLang: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  workers,
  selectedWorker,
  onSelectWorker,
  adminPin,
  lang,
  setLang,
}) => {
  const todayFormatted = formatDateIT(getCurrentDateISO());
  const t = translations[lang];

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const handleRoleToggle = () => {
    if (userRole === "admin") {
      // Switch back to worker mode
      setUserRole("worker");
      setActiveTab("timbratrice");
    } else {
      // Prompt for PIN to unlock manager mode
      setPinInput("");
      setPinError(false);
      setIsPinModalOpen(true);
    }
  };

  const [verifying, setVerifying] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setPinError(false);

    const inputTrimmed = pinInput.trim();
    if (!inputTrimmed) {
      setPinError(true);
      setVerifying(false);
      return;
    }

    try {
      // Direct instant check against 1234 or prop adminPin
      if (inputTrimmed === "1234" || (adminPin && inputTrimmed === adminPin.trim())) {
        setUserRole("admin");
        setIsPinModalOpen(false);
        setActiveTab("lavoratori");
        setVerifying(false);
        return;
      }

      // Cloud verification
      const isValid = await verifyAdminPin(inputTrimmed);
      if (isValid === true || (typeof isValid === "object" && (isValid as any)?.success)) {
        setUserRole("admin");
        setIsPinModalOpen(false);
        setActiveTab("lavoratori");
      } else {
        setPinError(true);
      }
    } catch {
      if (inputTrimmed === "1234" || (adminPin && inputTrimmed === adminPin.trim())) {
        setUserRole("admin");
        setIsPinModalOpen(false);
        setActiveTab("lavoratori");
      } else {
        setPinError(true);
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top bar with Logo, Role Switcher, Worker Selector & Language */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-lg border-2 border-amber-400/80 flex-shrink-0 bg-slate-950 p-0.5">
              <img
                src="/app-logo.png"
                alt="ElettroOre Logo"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center">
                  <span>Elettro</span>
                  <span className="text-amber-400">Ore</span>
                </h1>
                <span className="bg-amber-400/20 text-amber-300 text-xs px-2 py-0.5 rounded-full font-bold border border-amber-400/30">
                  {lang.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mt-0.5">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Right Tools: Worker Selector, Role Switch, Language & Date */}
          <div className="flex items-center gap-2.5 text-xs sm:text-sm flex-wrap">
            
            {/* Language Switcher Toggle */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1">
              <Globe className="w-3.5 h-3.5 text-blue-400 mx-1.5" />
              <button
                onClick={() => setLang("it")}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  lang === "it" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                IT
              </button>
              <button
                onClick={() => setLang("ar")}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  lang === "ar" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                عربي
              </button>
            </div>

            {/* Worker Selector Dropdown (Always visible for easy worker identity) */}
            {workers.length > 0 && (
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                <User className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
                <select
                  value={selectedWorker?.id || workers[0]?.id}
                  onChange={(e) => {
                    const found = workers.find((w) => w.id === Number(e.target.value));
                    if (found) onSelectWorker(found);
                  }}
                  className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer pr-1"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                      {w.name} ({w.hourlyRate}€/h)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mode / Role Toggle Button */}
            <button
              onClick={handleRoleToggle}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                userRole === "admin"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {userRole === "admin" ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.roleManager}</span>
                  <Lock className="w-3 h-3 text-amber-400/80 ml-1" />
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.roleWorker}</span>
                </>
              )}
            </button>

            {/* Today's Date */}
            <div className="hidden sm:block bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-slate-200 text-xs">
              <span className="font-semibold text-blue-300">{todayFormatted}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-800 pt-2 pb-1 overflow-x-auto">
          
          {/* Timbratrice is available in both modes */}
          <button
            onClick={() => setActiveTab("timbratrice")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "timbratrice"
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Clock className="w-4 h-4 text-blue-300" />
            <span>{t.navClockIn}</span>
          </button>

          {/* If Manager Mode is active: show full suite */}
          {userRole === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("lavoratori")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "lavoratori"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4 text-amber-300" />
                <span>{t.navWorkers}</span>
              </button>

              <button
                onClick={() => setActiveTab("registro")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "registro"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Calendar className="w-4 h-4 text-indigo-300" />
                <span>{t.navRegistry}</span>
              </button>

              <button
                onClick={() => setActiveTab("report")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "report"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-300" />
                <span>{t.navReport}</span>
              </button>

              <button
                onClick={() => setActiveTab("impostazioni")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "impostazioni"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4 text-slate-300" />
                <span>{t.navSettings}</span>
              </button>
            </>
          )}

          {/* In worker mode: quick button to view their own days */}
          {userRole === "worker" && (
            <button
              onClick={() => setActiveTab("registro")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "registro"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-300" />
              <span>{t.navRegistry}</span>
            </button>
          )}
        </nav>
      </div>

      {/* PIN Unlock Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-700 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.pinPrompt}</h3>
                <p className="text-xs text-slate-400">{t.pinDesc}</p>
              </div>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
              <div>
                <input
                  type="password"
                  autoFocus
                  maxLength={10}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder={t.pinPlaceholder}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {pinError && (
                  <p className="text-xs text-rose-400 font-semibold text-center mt-1.5">
                    {t.pinWrong}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{t.btnUnlock}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

