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
  const [showFirstTimeWorkerPicker, setShowFirstTimeWorkerPicker] = useState(false);
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
      
      // Auto select first worker or retrieve stored worker ID
      if (data && data.length > 0) {
        const storedWorkerId = typeof window !== "undefined" ? localStorage.getItem("oralavoro_selected_worker_id") : null;
        if (storedWorkerId) {
          const matched = data.find((w) => String(w.id) === storedWorkerId);
          if (matched) {
            setSelectedWorker(matched);
            return;
          }
        }
        // If not stored and there are multiple workers, prompt worker to bind this device
        if (data.length > 1) {
          setShowFirstTimeWorkerPicker(true);
        }
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
            {activeTab === "report" && userRole === "admin" && (
              <MonthlyReportView
                logs={logs}
                workers={workers}
                companyName={companyName}
                lang={lang}
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

      {/* ONE-TIME WORKER DEVICE BINDING MODAL */}
      {showFirstTimeWorkerPicker && workers.length > 1 && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 text-center border border-slate-100">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <User className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">
                {lang === "ar" ? "اختر اسمك لتسجيل الدخول 📲" : "Identificati per iniziare 📲"}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                {lang === "ar"
                  ? "يرجى تحديد حسابك الشخصي لربط هذا الهاتف بك. بعد التحديد ستتمكن فقط من إدارة وتسجيل ساعاتك الشخصية ولن يظهر لك ساعات العمال الآخرين."
                  : "Seleziona il tuo profilo per associare questo telefono. Potrai visualizzare e timbrare esclusivamente le tue ore personali."}
              </p>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {workers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    handleSelectWorker(w);
                    setShowFirstTimeWorkerPicker(false);
                  }}
                  className="w-full p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 font-bold text-sm flex items-center justify-between transition-all cursor-pointer group text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white font-black flex items-center justify-center text-xs shadow-sm">
                      {w.name[0]}
                    </div>
                    <span className="text-sm">{w.name}</span>
                  </div>
                  <span className="text-xs text-blue-600 group-hover:text-blue-700 font-bold bg-blue-100/70 px-2.5 py-1 rounded-lg">
                    {lang === "ar" ? "تأكيد الدخول 👈" : "Accedi 👈"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
