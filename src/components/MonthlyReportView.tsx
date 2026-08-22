import React, { useState, useMemo, useEffect } from "react";
import { Printer, Download, Calendar, Clock, MapPin, Award, FileSpreadsheet, Building2, User, ChevronLeft, ChevronRight, Coins, Filter, Users, PenTool, Check, ShieldCheck } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { WorkLogEntry, WorkerProfile, calculateTotalPay } from "../utils/api";
import { MONTHS_IT, WORK_TYPES_IT, formatDateIT, getDayNameIT } from "../utils/italian";
import { translations, Language } from "../utils/i18n";
import { SignaturePad } from "./SignaturePad";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MonthlyReportViewProps {
  logs: WorkLogEntry[];
  workers: WorkerProfile[];
  companyName: string;
  lang: Language;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ logs, workers, companyName, lang }) => {
  const t = translations[lang];
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(currentDate.getMonth() + 1).padStart(2, "0")
  );
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("ALL");
  const [showSignatureDrawer, setShowSignatureDrawer] = useState(false);

  const [signatureWorker, setSignatureWorker] = useState<string | null>(null);
  const [signatureManager, setSignatureManager] = useState<string | null>(null);

  const monthYearKey = `${selectedYear}-${selectedMonth}`;

  // Sync signatures from storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sw = localStorage.getItem(`oralavoro_sig_worker_${monthYearKey}_${selectedWorkerFilter}`);
      const sm = localStorage.getItem(`oralavoro_sig_manager_${monthYearKey}`);
      setSignatureWorker(sw);
      setSignatureManager(sm);
    }
  }, [monthYearKey, selectedWorkerFilter]);

  const handleSaveWorkerSignature = (sig: string | null) => {
    setSignatureWorker(sig);
    if (typeof window !== "undefined") {
      if (sig) localStorage.setItem(`oralavoro_sig_worker_${monthYearKey}_${selectedWorkerFilter}`, sig);
      else localStorage.removeItem(`oralavoro_sig_worker_${monthYearKey}_${selectedWorkerFilter}`);
    }
  };

  const handleSaveManagerSignature = (sig: string | null) => {
    setSignatureManager(sig);
    if (typeof window !== "undefined") {
      if (sig) localStorage.setItem(`oralavoro_sig_manager_${monthYearKey}`, sig);
      else localStorage.removeItem(`oralavoro_sig_manager_${monthYearKey}`);
    }
  };

  // Filter logs for selected month AND selected worker
  const monthlyLogs = useMemo(() => {
    return logs
      .filter((log) => {
        const matchesMonth = log.date && log.date.startsWith(monthYearKey);
        if (!matchesMonth) return false;
        if (selectedWorkerFilter === "ALL") return true;
        return (
          String(log.workerId) === selectedWorkerFilter ||
          log.workerName === selectedWorkerFilter
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, monthYearKey, selectedWorkerFilter]);

  // Calculations
  const totalMonthlyHours = useMemo(() => {
    return monthlyLogs.reduce((acc, log) => acc + (parseFloat(log.totalHours) || 0), 0);
  }, [monthlyLogs]);

  const totalMonthlyEarnings = useMemo(() => {
    return monthlyLogs.reduce((acc, log) => {
      let rate = 15.0;
      if (log.hourlyRate) {
        rate = parseFloat(String(log.hourlyRate)) || 15.0;
      } else {
        const matchingWorker = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
        if (matchingWorker) rate = parseFloat(matchingWorker.hourlyRate) || 15.0;
      }
      const hours = parseFloat(log.totalHours) || 0;
      const pay = log.totalPay ? parseFloat(log.totalPay) : rate * hours;
      return acc + pay;
    }, 0);
  }, [monthlyLogs, workers]);

  const totalDaysWorked = monthlyLogs.length;

  const averageDailyHours = totalDaysWorked > 0 ? (totalMonthlyHours / totalDaysWorked).toFixed(2) : "0.00";

  const overtimeHours = useMemo(() => {
    return monthlyLogs
      .filter((log) => log.workType === "Straordinario")
      .reduce((acc, log) => acc + (parseFloat(log.totalHours) || 0), 0);
  }, [monthlyLogs]);

  // Breakdown by location
  const locationBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    monthlyLogs.forEach((log) => {
      const loc = log.locationName || "Sede";
      map[loc] = (map[loc] || 0) + (parseFloat(log.totalHours) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthlyLogs]);

  // Chart data
  const chartData = useMemo(() => {
    const labels = monthlyLogs.map((log) => {
      const dayNum = log.date.split("-")[2];
      const namePrefix = selectedWorkerFilter === "ALL" && log.workerName ? `${log.workerName.split(" ")[0]} ` : "";
      return `${dayNum} ${namePrefix}${getDayNameIT(log.date).substring(0, 3)}`;
    });

    const hours = monthlyLogs.map((log) => parseFloat(log.totalHours) || 0);

    return {
      labels,
      datasets: [
        {
          label: "Ore Lavorate",
          data: hours,
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          borderColor: "rgb(37, 99, 235)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [monthlyLogs, selectedWorkerFilter]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    let m = parseInt(selectedMonth, 10) - 1;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth, 10) + 1;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const monthObj = MONTHS_IT.find((m) => m.value === selectedMonth);
    const monthName = monthObj ? monthObj.name : selectedMonth;
    const workerTag = selectedWorkerFilter === "ALL" ? "Azienda_Tutti" : selectedWorkerFilter.replace(/\s+/g, "_");
    const filename = `Report_Ore_${workerTag}_${monthName}_${selectedYear}.csv`;

    const headers = [
      "Lavoratore",
      "Data",
      "Giorno",
      "Ora Inizio",
      "Ora Fine",
      "Pausa (min)",
      "Ore Nette",
      "Paga Oraria (€)",
      "Compenso Totale (€)",
      "Tipo Lavoro",
      "Luogo Lavoro",
      "Indirizzo GPS",
      "Note",
    ];

    const rows = monthlyLogs.map((log) => {
      let rate = "15.00";
      if (log.hourlyRate) {
        rate = String(log.hourlyRate);
      } else {
        const mw = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
        if (mw) rate = mw.hourlyRate;
      }
      const pay = log.totalPay || calculateTotalPay(log.totalHours, rate);
      return [
        `"${log.workerName || "Mario Rossi"}"`,
        log.date,
        getDayNameIT(log.date),
        log.startTime,
        log.endTime || "",
        log.breakMinutes,
        log.totalHours,
        rate,
        pay,
        log.workType,
        `"${log.locationName || ""}"`,
        `"${log.address || ""}"`,
        `"${log.notes || ""}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  const monthObj = MONTHS_IT.find((m) => m.value === selectedMonth);
  const selectedMonthName = monthObj ? monthObj.name : selectedMonth;

  const currentDisplayWorkerName = useMemo(() => {
    if (selectedWorkerFilter === "ALL") return t.allWorkers;
    const found = workers.find(
      (w) => String(w.id) === selectedWorkerFilter || w.name === selectedWorkerFilter
    );
    return found ? found.name : selectedWorkerFilter;
  }, [selectedWorkerFilter, workers, t]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Top Header & Filters (Hidden during printing) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">{t.reportTitle}</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {t.reportDesc}
          </p>
        </div>

        {/* Worker Filter and Month Selector Controls */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          
          {/* Worker Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <select
              value={selectedWorkerFilter}
              onChange={(e) => setSelectedWorkerFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t.allWorkers}</option>
              {workers.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name} ({w.hourlyRate} €/h)
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS_IT.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSignatureDrawer(!showSignatureDrawer)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all whitespace-nowrap ${
                signatureWorker || signatureManager
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>{signatureWorker || signatureManager ? (lang === "ar" ? "✍️ التوقيع الرقمي (موقع)" : "✍️ Firme Inserite") : (lang === "ar" ? "✍️ التوقيع الرقمي" : "✍️ Firma PDF")}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>{t.btnPrint}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t.btnCsv}</span>
            </button>
          </div>
        </div>
      </div>

      {/* DIGITAL SIGNATURE DRAWER (Interactive Canvas) */}
      {showSignatureDrawer && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-lg space-y-4 print:hidden animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-indigo-600" />
                <span>{lang === "ar" ? "التوقيع الرقمي على التقرير الشهري (Firma Digitale PDF)" : "Firma Digitale per Report Mensile"}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === "ar"
                  ? "وقّع بإصبعك على الشاشة لحفظ التوقيع وطباعته رسمياً في أسفل ملف الـ PDF."
                  : "Firma con il dito sullo schermo per allegare la firma ufficiale in fondo al report stampabile."}
              </p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
              {selectedMonthName} {selectedYear}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SignaturePad
              label={lang === "ar" ? `✍️ توقيع العامل (${currentDisplayWorkerName})` : `✍️ Firma Lavoratore (${currentDisplayWorkerName})`}
              initialSignature={signatureWorker}
              onSaveSignature={handleSaveWorkerSignature}
              lang={lang}
            />

            <SignaturePad
              label={lang === "ar" ? `✍️ توقيع صاحب العمل / المدير (${companyName})` : `✍️ Firma Datore di Lavoro (${companyName})`}
              initialSignature={signatureManager}
              onSaveSignature={handleSaveManagerSignature}
              lang={lang}
            />
          </div>
        </div>
      )}

      {/* METRIC SUMMARY CARDS (Interactive Screen) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 print:hidden">
        
        {/* Total Hours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t.metricTotalHours}</span>
            <div className="text-2xl font-extrabold text-slate-900">{totalMonthlyHours.toFixed(2)} h</div>
            <span className="text-xs text-blue-600 font-medium">{selectedMonthName} {selectedYear}</span>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t.metricTotalEarnings}</span>
            <div className="text-2xl font-extrabold text-emerald-700">€ {totalMonthlyEarnings.toFixed(2)}</div>
            <span className="text-xs text-emerald-600 font-medium truncate block max-w-[160px]">
              {currentDisplayWorkerName}
            </span>
          </div>
        </div>

        {/* Days Worked */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t.metricDaysWorked}</span>
            <div className="text-2xl font-extrabold text-slate-900">{totalDaysWorked}</div>
            <span className="text-xs text-indigo-600 font-medium">{t.avgDaily} {averageDailyHours} {t.perDay}</span>
          </div>
        </div>

        {/* Overtime Hours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t.metricOvertime}</span>
            <div className="text-2xl font-extrabold text-slate-900">{overtimeHours.toFixed(2)} h</div>
            <span className="text-xs text-amber-600 font-medium">Extra hours</span>
          </div>
        </div>
      </div>

      {/* Visual Chart (Screen view) */}
      {monthlyLogs.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
          <h3 className="text-base font-bold text-slate-900 mb-4">{t.chartTitle}</h3>
          <div className="h-64">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  y: { beginAtZero: true, max: 12 },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICIAL PRINTABLE MONTHLY REPORT SHEET (A4 Print Formatted) */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-lg print:border-none print:shadow-none print:p-0 print:m-0">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/app-logo.png"
                alt="Logo"
                className="w-14 h-14 rounded-xl object-cover shadow-sm border border-slate-200"
              />
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {t.officialSheetTitle}
                </h1>
                <p className="text-sm font-semibold text-blue-700 mt-0.5">
                  {t.officialSheetSub}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-slate-900 uppercase">
                {selectedMonthName} {selectedYear}
              </div>
              <div className="text-xs text-slate-500">{t.officialDocBadge}</div>
            </div>
          </div>

          {/* Worker & Company Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase block">{t.workerLabel}</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <User className="w-4 h-4 text-blue-600 print:hidden" />
                <span>{currentDisplayWorkerName}</span>
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase block">{t.companyLabel}</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-4 h-4 text-slate-600 print:hidden" />
                <span>{companyName || "Azienda s.r.l."}</span>
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase block">{t.metricTotalHours}</span>
              <span className="font-black text-blue-700 text-base mt-0.5 block">
                {totalMonthlyHours.toFixed(2)} h
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase block">{t.metricTotalEarnings}</span>
              <span className="font-black text-emerald-700 text-base mt-0.5 block">
                € {totalMonthlyEarnings.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        {monthlyLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Nessuna ora registrata per il mese di {selectedMonthName} {selectedYear}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold uppercase">
                  <th className="p-2.5 border border-slate-900">{t.thWorker}</th>
                  <th className="p-2.5 border border-slate-900">{t.thDate}</th>
                  <th className="p-2.5 border border-slate-900">Giorno</th>
                  <th className="p-2.5 border border-slate-900">Entrata</th>
                  <th className="p-2.5 border border-slate-900">Uscita</th>
                  <th className="p-2.5 border border-slate-900">{t.thBreak}</th>
                  <th className="p-2.5 border border-slate-900">{t.thNetHours}</th>
                  <th className="p-2.5 border border-slate-900">{t.thTotalPay}</th>
                  <th className="p-2.5 border border-slate-900">{t.thType}</th>
                  <th className="p-2.5 border border-slate-900">{t.thLocation}</th>
                  <th className="p-2.5 border border-slate-900">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {monthlyLogs.map((log, idx) => {
                  const dayName = getDayNameIT(log.date);
                  const isWeekend = dayName === "Sabato" || dayName === "Domenica";
                  let rateToUse = "15.00";
                  if (log.hourlyRate) {
                    rateToUse = String(log.hourlyRate);
                  } else {
                    const mw = workers.find((w) => w.id === log.workerId || w.name === log.workerName);
                    if (mw) rateToUse = mw.hourlyRate;
                  }
                  const logPay = log.totalPay || calculateTotalPay(log.totalHours, rateToUse);

                  return (
                    <tr
                      key={log.id || idx}
                      className={isWeekend ? "bg-amber-50/50 print:bg-slate-100" : "hover:bg-slate-50"}
                    >
                      <td className="p-2.5 border border-slate-200 font-bold whitespace-nowrap text-slate-900">
                        {log.workerName || "Mario Rossi"}
                      </td>
                      <td className="p-2.5 border border-slate-200 font-mono font-bold whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="p-2.5 border border-slate-200 font-medium capitalize whitespace-nowrap">
                        {dayName}
                      </td>
                      <td className="p-2.5 border border-slate-200 font-semibold">{log.startTime}</td>
                      <td className="p-2.5 border border-slate-200 font-semibold">{log.endTime || "-"}</td>
                      <td className="p-2.5 border border-slate-200 text-center">{log.breakMinutes}m</td>
                      <td className="p-2.5 border border-slate-200 font-black text-blue-800 text-center">
                        {log.totalHours} h
                      </td>
                      <td className="p-2.5 border border-slate-200 font-black text-emerald-800 text-center whitespace-nowrap">
                        € {logPay}
                      </td>
                      <td className="p-2.5 border border-slate-200 font-semibold">{log.workType}</td>
                      <td className="p-2.5 border border-slate-200 font-medium">
                        <div>{log.locationName}</div>
                        {log.address && <div className="text-[11px] text-slate-500">{log.address}</div>}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-slate-600">{log.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900">
                  <td colSpan={6} className="p-3 border border-slate-300 text-right uppercase">
                    Totali Generale:
                  </td>
                  <td className="p-3 border border-slate-300 text-center text-blue-900 text-base font-black">
                    {totalMonthlyHours.toFixed(2)} h
                  </td>
                  <td className="p-3 border border-slate-300 text-center text-emerald-900 text-base font-black whitespace-nowrap">
                    € {totalMonthlyEarnings.toFixed(2)}
                  </td>
                  <td colSpan={3} className="p-3 border border-slate-300 text-xs text-slate-600">
                    Giorni Lavorati: {totalDaysWorked} | Straordinari: {overtimeHours.toFixed(2)} h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Signatures Section for Print / Official Submission */}
        <div className="mt-10 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs font-semibold text-slate-700">
          <div>
            <span className="block mb-1 font-bold">{t.signatureWorker}</span>
            <div className="h-16 flex items-end">
              {signatureWorker ? (
                <img src={signatureWorker} alt="Firma Lavoratore" className="h-14 object-contain" />
              ) : (
                <div className="h-14" />
              )}
            </div>
            <div className="border-b border-slate-400 w-3/4" />
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              {currentDisplayWorkerName}
            </span>
          </div>

          <div className="text-right">
            <span className="block mb-1 font-bold">{t.signatureManager}</span>
            <div className="h-16 flex items-end justify-end">
              {signatureManager ? (
                <img src={signatureManager} alt="Firma Datore di Lavoro" className="h-14 object-contain" />
              ) : (
                <div className="h-14" />
              )}
            </div>
            <div className="border-b border-slate-400 w-3/4 ml-auto" />
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              {companyName} (Direzione)
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4">
          Generato da OraLavoro Italia — Registro Ore e Posizione Geolocalizzata
        </div>
      </div>
    </div>
  );
};
