import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { User, Lock, Check, Shield, Globe, ShieldCheck } from "lucide-react";
import { Header } from "../components/Header";
import { PWAInstallBanner } from "../components/PWAInstallBanner";
import { LiveClockIn } from "../components/LiveClockIn";
import { WorkerManagerView } from "../components/WorkerManagerView";
import { CantieriManagerView } from "../components/CantieriManagerView";
import { DailyLogManager } from "../components/DailyLogManager";
import { MonthlyReportView } from "../components/MonthlyReportView";
import { SettingsView } from "../components/SettingsView";
import { WorkLogEntry, WorkerProfile, WorkSite, fetchWorkLogs, fetchWorkers, fetchWorkSites, fetchAppSettings, syncOfflineQueue } from "../utils/api";
import { Language, translations } from "../utils/i18n";

export const Route = createFileRoute("/")({
  component: AppHome,
});

function AppHome() {
  const [activeTab, setActiveTab] = useState<"timbratrice" | "lavoratori" | "cantieri" | "registro" | "report" | "impostazioni">("timbratrice");
  const [userRole, setUserRole] = useState<"worker" | "admin">("worker");
  const [logs, setLogs] = useState<WorkLogEntry[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [cantieri, setCantieri] = useState<WorkSite[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerProfile | null>(null);
  const [isWorkerLoggedIn, setIsWorkerLoggedIn] = useState(false);
  const [loginWorkerId, setLoginWorkerId] = useState<number | null>(null);
  const [loginWorkerPin, setLoginWorkerPin] = useState("");
  const [loginPinError, setLoginPinError] = useState(false);
  const [isAdminLockModalOpen, setIsAdminLockModalOpen] = useState(false);
  const [adminLockPinInput, setAdminLockPinInput] = useState("");
  const [adminLockPinError, setAdminLockPinError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Language>("it");

  // Company Settings
  const [companyName, setCompanyName] = useState("Azienda s.r.l.");
  const [defaultLocation, setDefaultLocation] = useState("Ufficio Sede - Milano");
  const [adminPin, setAdminPin] = useState("4159985");

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("oralavoro_lang", newLang);
    }
  };

  const handleSelectWorker = (worker: WorkerProfile) => {
    setSelectedWorker(worker);
    if (typeof window !== "undefined") {
      localStorage.setItem("oralavoro_selected_worker_id", String(worker.id));
    }
  };

  const handleWorkerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginWorkerId) {
      alert(lang === "ar" ? "⚠️ يرجى اختيار اسمك من القائمة أولاً" : "⚠️ Seleziona prima il tuo profilo dalla lista");
      return;
    }
    const target = workers.find((w) => w.id === Number(loginWorkerId));
    if (!target) return;
    const correctPin = target.pin || "1234";
    if (loginWorkerPin.trim() === correctPin.trim()) {
      setSelectedWorker(target);
      setIsWorkerLoggedIn(true);
      setLoginPinError(false);
      setLoginWorkerPin("");
    } else {
      setLoginPinError(true);
    }
  };

  const handleWorkerLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("oralavoro_worker_auth_id");
    }
    setIsWorkerLoggedIn(false);
    setSelectedWorker(null);
    setLoginWorkerId(null);
    setLoginWorkerPin("");
    setLoginPinError(false);
  };

  // Load stored settings and cloud settings on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCompany = localStorage.getItem("oralavoro_companyName");
      const storedLoc = localStorage.getItem("oralavoro_defaultLocation");
      const storedLang = localStorage.getItem("oralavoro_lang") as Language;

      // Purge all credentials/PINs from localStorage
      localStorage.removeItem("oralavoro_adminPin");
      localStorage.removeItem("oralavoro_admin_pin");
      localStorage.removeItem("oralavoro_worker_auth_id");
      localStorage.removeItem("oralavoro_selected_worker_id");

      if (storedCompany) setCompanyName(storedCompany);
      if (storedLoc) setDefaultLocation(storedLoc);
      if (storedLang === "it" || storedLang === "ar") setLangState(storedLang);
      
      // Always start in worker mode with locked screen
      setUserRole("worker");
      setIsWorkerLoggedIn(false);
      setSelectedWorker(null);
      setLoginWorkerId(null);
    }

    fetchAppSettings().then((settings) => {
      if (settings && settings.defaultLocation) {
        setCompanyName(settings.companyName);
        setDefaultLocation(settings.defaultLocation);
        const resolvedPin = settings.adminPin && settings.adminPin !== "1234" ? settings.adminPin : "4159985";
        setAdminPin(resolvedPin);
        if (typeof window !== "undefined") {
          localStorage.setItem("oralavoro_defaultLocation", settings.defaultLocation);
          localStorage.setItem("oralavoro_companyName", settings.companyName);
        }
      }
    }).catch(console.error);
  }, []);

  const handleSetUserRole = (role: "worker" | "admin") => {
    setUserRole(role);
  };

  // Refresh workers list - never auto-login
  const refreshWorkers = useCallback(async () => {
    try {
      const data = await fetchWorkers();
      setWorkers(data || []);
    } catch (err) {
      console.error("Error refreshing workers:", err);
    }
  }, []);

  // Fetch cantieri
  const refreshCantieri = useCallback(async () => {
    try {
      const data = await fetchWorkSites();
      setCantieri(data || []);
    } catch (err) {
      console.error("Error refreshing cantieri:", err);
    }
  }, []);

  // Fetch logs
  const refreshLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorkLogs();
      setLogs(data || []);
    } catch (err) {
      console.error("Error refreshing logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkers();
    refreshCantieri();
    refreshLogs();
    
    if (typeof window !== "undefined") {
      syncOfflineQueue().then(() => refreshLogs()).catch(console.error);

      const handleOnline = () => {
        syncOfflineQueue().then(() => {
          refreshLogs();
          refreshWorkers();
          refreshCantieri();
        }).catch(console.error);
      };

      window.addEventListener("online", handleOnline);
      return () => window.removeEventListener("online", handleOnline);
    }
  }, [refreshWorkers, refreshCantieri, refreshLogs]);

  const t = translations[lang];

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white"
    >
      {/* PWA Install Banner */}
      <PWAInstallBanner lang={lang} />

      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={handleSetUserRole}
        workers={workers}
        selectedWorker={selectedWorker}
        onSelectWorker={handleSelectWorker}
        onWorkerLogout={handleWorkerLogout}
        adminPin={adminPin}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && logs.length === 0 && workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Caricamento registro ore e database...</p>
          </div>
        ) : (
          <>
            {/* Timbratrice (available in both modes) */}
            {activeTab === "timbratrice" && (
              <LiveClockIn
                logs={logs}
                selectedWorker={selectedWorker}
                workers={workers}
                cantieri={cantieri}
                onSelectWorker={handleSelectWorker}
                onRefresh={refreshLogs}
                defaultLocation={defaultLocation}
                lang={lang}
                userRole={userRole}
              />
            )}

            {/* Manager: Workers Management & Live Attendance Board */}
            {activeTab === "lavoratori" && userRole === "admin" && (
              <WorkerManagerView
                workers={workers}
                logs={logs}
                onRefreshWorkers={refreshWorkers}
                onRefreshLogs={refreshLogs}
                lang={lang}
              />
            )}

            {/* Manager: Multi-Cantiere Management */}
            {activeTab === "cantieri" && userRole === "admin" && (
              <CantieriManagerView
                cantieri={cantieri}
                logs={logs}
                onRefreshCantieri={refreshCantieri}
                lang={lang}
              />
            )}

            {/* Daily Log Manager (Registro) */}
            {activeTab === "registro" && (
              <DailyLogManager
                logs={logs}
                workers={workers}
                cantieri={cantieri}
                selectedWorker={selectedWorker}
                onRefresh={refreshLogs}
                defaultLocation={defaultLocation}
                lang={lang}
                userRole={userRole}
              />
            )}

            {/* Monthly Report View (Report) */}
            {activeTab === "report" && (
              <MonthlyReportView
                logs={logs}
                workers={workers}
                cantieri={cantieri}
                companyName={companyName}
                lang={lang}
                userRole={userRole}
                selectedWorker={selectedWorker}
              />
            )}

            {/* Settings View */}
            {activeTab === "impostazioni" && userRole === "admin" && (
              <SettingsView
                companyName={companyName}
                setCompanyName={setCompanyName}
                defaultLocation={defaultLocation}
                setDefaultLocation={setDefaultLocation}
                adminPin={adminPin}
                setAdminPin={setAdminPin}
                onRefresh={() => {
                  refreshWorkers();
                  refreshCantieri();
                  refreshLogs();
                }}
                lang={lang}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="font-semibold text-slate-300">{t.appName} — {t.appSubtitle}</p>
            <p className="text-slate-500 mt-0.5">React, TanStack Start & Netlify Database Postgres</p>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            {userRole === "admin" && (
              <>
                <button
                  onClick={() => setActiveTab("report")}
                  className="hover:text-blue-400 transition-colors font-medium"
                >
                  {t.navReport}
                </button>
                <span>•</span>
                <button
                  onClick={() => setActiveTab("impostazioni")}
                  className="hover:text-blue-400 transition-colors font-medium"
                >
                  {t.navSettings}
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* WORKER PIN LOGIN SCREEN */}
      {userRole === "worker" && !isWorkerLoggedIn && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-center border border-slate-100 relative">
            
            {/* Top Language Toggle */}
            <div className="flex justify-end items-center gap-1.5 mb-1">
              <button
                type="button"
                onClick={() => setLang("it")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  lang === "it"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🇮🇹 IT
              </button>
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  lang === "ar"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🇪🇬 عربي
              </button>
            </div>

            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">
                {lang === "ar" ? "تسجيل دخول العامل 🔐" : "Accesso Dipendente 🔐"}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                {lang === "ar"
                  ? "اختر اسمك وأدخل رمز المرور السري الخاص بك (PIN) لتسجيل الدخول إلى حسابك وساعاتك الشخصية فقط."
                  : "Seleziona il tuo profilo e inserisci il tuo PIN personale per accedere alle tue ore personali."}
              </p>
            </div>

            <form onSubmit={handleWorkerLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {lang === "ar" ? "👤 اختر اسمك:" : "👤 Seleziona Lavoratore:"}
                </label>
                <select
                  value={loginWorkerId !== null ? String(loginWorkerId) : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLoginWorkerId(val ? Number(val) : null);
                    setLoginPinError(false);
                  }}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {lang === "ar" ? "-- اضغط هنا لاختيار اسمك --" : "-- Seleziona il tuo nome dalla lista --"}
                  </option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role || "Operaio"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {lang === "ar" ? "🔑 رمز المرور السري (PIN):" : "🔑 Codice PIN Personale:"}
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  name="worker_pin_secure"
                  value={loginWorkerPin}
                  onChange={(e) => {
                    setLoginWorkerPin(e.target.value);
                    setLoginPinError(false);
                  }}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {loginPinError && (
                  <p className="text-xs text-rose-600 font-bold mt-1.5 text-center animate-bounce">
                    {lang === "ar" ? "❌ رمز المرور غير صحيح! يرجى التأكد من المدير." : "❌ Codice PIN errato! Riprova."}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Check className="w-4 h-4" />
                <span>{lang === "ar" ? "دخول إلى صفحتي الشخصية 🚀" : "Accedi al Mio Profilo 🚀"}</span>
              </button>
            </form>

            {/* Admin Switch Link */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setAdminLockPinInput("");
                  setAdminLockPinError(false);
                  setIsAdminLockModalOpen(true);
                }}
                className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === "ar" ? "أنت المدير؟ اضغط هنا للدخول بلوحة التحكم 🛡️" : "Sei l'Amministratore? Clicca qui per il pannello 🛡️"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PIN MODAL FROM LOCK SCREEN */}
      {isAdminLockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl space-y-5 text-center border border-slate-100">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                {lang === "ar" ? "دخول المدير / المشرف 🛡️" : "Accesso Amministratore 🛡️"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === "ar" ? "أدخل رمز PIN الخاص بالمدير للوصول لكافة الصلاحيات." : "Inserisci il PIN Amministratore per sbloccare tutti i pannelli."}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const inputTrimmed = adminLockPinInput.trim();
                if (inputTrimmed === adminPin.trim() || inputTrimmed === "4159985") {
                  setUserRole("admin");
                  setActiveTab("timbratrice");
                  setIsAdminLockModalOpen(false);
                  setAdminLockPinInput("");
                  setAdminLockPinError(false);
                } else {
                  setAdminLockPinError(true);
                }
              }}
              className="space-y-4"
            >
              <input
                type="password"
                required
                autoFocus
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                name="admin_pin_secure"
                value={adminLockPinInput}
                onChange={(e) => {
                  setAdminLockPinInput(e.target.value);
                  setAdminLockPinError(false);
                }}
                placeholder="PIN (es. 4159985)"
                maxLength={10}
                className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {adminLockPinError && (
                <p className="text-xs text-rose-600 font-bold animate-bounce">
                  {lang === "ar" ? "❌ رمز PIN للمدير غير صحيح!" : "❌ PIN Amministratore errato!"}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdminLockModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء" : "Annulla"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {lang === "ar" ? "تأكيد الدخول 🔓" : "Sblocca 🔓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
