import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { User, Lock, Check } from "lucide-react";
import { Header } from "../components/Header";
import { PWAInstallBanner } from "../components/PWAInstallBanner";
import { LiveClockIn } from "../components/LiveClockIn";
import { WorkerManagerView } from "../components/WorkerManagerView";
import { DailyLogManager } from "../components/DailyLogManager";
import { MonthlyReportView } from "../components/MonthlyReportView";
import { SettingsView } from "../components/SettingsView";
import { WorkLogEntry, WorkerProfile, fetchWorkLogs, fetchWorkers, fetchAppSettings } from "../utils/api";
import { Language, translations } from "../utils/i18n";

export const Route = createFileRoute("/")({
  component: AppHome,
});

function AppHome() {
  const [activeTab, setActiveTab] = useState<"timbratrice" | "lavoratori" | "registro" | "report" | "impostazioni">("timbratrice");
  const [userRole, setUserRole] = useState<"worker" | "admin">("worker");
  const [logs, setLogs] = useState<WorkLogEntry[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerProfile | null>(null);
  const [isWorkerLoggedIn, setIsWorkerLoggedIn] = useState(false);
  const [loginWorkerId, setLoginWorkerId] = useState<number | null>(null);
  const [loginWorkerPin, setLoginWorkerPin] = useState("");
  const [loginPinError, setLoginPinError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Language>("it");

  // Company Settings
  const [companyName, setCompanyName] = useState("Azienda s.r.l.");
  const [defaultLocation, setDefaultLocation] = useState("Ufficio Sede - Milano");
  const [adminPin, setAdminPin] = useState("1234");

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
    const target = workers.find((w) => w.id === Number(loginWorkerId));
    if (!target) return;
    const correctPin = target.pin || "1234";
    if (loginWorkerPin.trim() === correctPin.trim()) {
      setSelectedWorker(target);
      if (typeof window !== "undefined") {
        localStorage.setItem("oralavoro_worker_auth_id", String(target.id));
        localStorage.setItem("oralavoro_selected_worker_id", String(target.id));
      }
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
    setLoginWorkerPin("");
    setLoginPinError(false);
  };

  // Load stored settings and cloud settings on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCompany = localStorage.getItem("oralavoro_companyName");
      const storedLoc = localStorage.getItem("oralavoro_defaultLocation");
      const storedLang = localStorage.getItem("oralavoro_lang") as Language;
      const storedPin = localStorage.getItem("oralavoro_adminPin");

      if (storedCompany) setCompanyName(storedCompany);
      if (storedLoc) setDefaultLocation(storedLoc);
      if (storedPin) setAdminPin(storedPin);
      if (storedLang === "it" || storedLang === "ar") setLangState(storedLang);
      
      // Always ensure worker mode on initial load
      setUserRole("worker");
    }

    fetchAppSettings().then((settings) => {
      if (settings && settings.defaultLocation) {
        setCompanyName(settings.companyName);
        setDefaultLocation(settings.defaultLocation);
        setAdminPin(settings.adminPin);
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

  // Refresh workers list
  const refreshWorkers = useCallback(async () => {
    try {
      const data = await fetchWorkers();
      setWorkers(data || []);
      
      // Auto select authenticated worker or prompt PIN login
      if (data && data.length > 0) {
        const authWorkerId = typeof window !== "undefined" ? localStorage.getItem("oralavoro_worker_auth_id") : null;
        if (authWorkerId) {
          const matched = data.find((w) => String(w.id) === authWorkerId);
          if (matched) {
            setSelectedWorker(matched);
            setLoginWorkerId(matched.id);
            setIsWorkerLoggedIn(true);
            return;
          }
        }
        // If not authenticated
        setIsWorkerLoggedIn(false);
        setLoginWorkerId(data[0].id);
        setSelectedWorker(data[0]);
      }
    } catch (err) {
      console.error("Error refreshing workers:", err);
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
    refreshLogs();
  }, [refreshWorkers, refreshLogs]);

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

            {/* Daily Log Manager (Registro) */}
            {activeTab === "registro" && (
              <DailyLogManager
                logs={logs}
                workers={workers}
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
      {userRole === "worker" && !isWorkerLoggedIn && workers.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-center border border-slate-100">
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
                  value={loginWorkerId || workers[0]?.id}
                  onChange={(e) => {
                    setLoginWorkerId(Number(e.target.value));
                    setLoginPinError(false);
                  }}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
                  autoFocus
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
          </div>
        </div>
      )}
    </div>
  );
}
