import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Header } from "../components/Header";
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
      if (settings) {
        setCompanyName(settings.companyName);
        setDefaultLocation(settings.defaultLocation);
        setAdminPin(settings.adminPin);
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
        const matched = data.find((w) => String(w.id) === storedWorkerId);
        setSelectedWorker(matched || data[0]);
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
    </div>
  );
}
