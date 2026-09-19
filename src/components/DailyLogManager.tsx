import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, MapPin, Search, Calendar, Clock, ExternalLink, Navigation, Check, X, RefreshCw, Coins, User, Users, Lock, ShieldCheck, HardHat, FileText, Printer, MessageSquare, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { WorkLogEntry, WorkerProfile, WorkSite, createWorkLog, updateWorkLog, deleteWorkLog, clearAllWorkLogs, calculateNetHours, calculateTotalPay } from "../utils/api";
import { formatDateIT, getCurrentDateISO, PRESET_LOCATIONS_IT, WORK_TYPES_IT, MONTHS_IT, getDayNameIT, reverseGeocode, parseWorkplaceZone, verifyWorkerGeofence } from "../utils/italian";
import { translations, Language } from "../utils/i18n";

interface DailyLogManagerProps {
  logs: WorkLogEntry[];
  workers: WorkerProfile[];
  cantieri?: WorkSite[];
  selectedWorker?: WorkerProfile | null;
  onRefresh: () => void;
  defaultLocation: string;
  lang: Language;
  userRole?: "worker" | "admin";
}

export const DailyLogManager: React.FC<DailyLogManagerProps> = ({
  logs,
  workers,
  cantieri = [],
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
  const [selectedCantiereFilter, setSelectedCantiereFilter] = useState("ALL");
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
  const [showWorkerExport, setShowWorkerExport] = useState(false);
  const [exportSelectedMonth, setExportSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [exportPhone, setExportPhone] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("oralavoro_managerPhone") || "" : ""
  );

  const openNewModal = () => {
    // Manual log creation is restricted to admins only
    if (userRole !== "admin") {
      alert(
        lang === "ar"
          ? "⚠️ إضافة سجل يدوي متاحة للمدير فقط. استخدم آلة الختم لتسجيل حضورك."
          : "⚠️ La registrazione manuale è riservata all'amministratore. Usa la timbratrice per timbrare."
      );
      return;
    }
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
  };

  const openEditModal = (log: WorkLogEntry) => {
    if (userRole !== "admin") {
      alert(lang === "ar" ? "⚠️ تعديل الساعات المسجلة متاح للمدير فقط." : "⚠️ Solo l'amministratore può modificare le registrazioni.");
      return;
    }
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

    // Triple-layer protection: only admins can manually create/edit logs
    if (userRole !== "admin") {
      alert(
        lang === "ar"
          ? "⚠️ التسجيل اليدوي للمدير فقط."
          : "⚠️ Solo l'amministratore può registrare manualmente."
      );
      setIsModalOpen(false);
      return;
    }

    // GPS & GEOFENCE: only enforced for workers — admin can log from anywhere
    let currentLat = formData.latitude;
    let currentLng = formData.longitude;
    let currentAddr = formData.address;

    if (userRole !== "admin") {
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
    if (userRole !== "admin") {
      alert(lang === "ar" ? "⚠️ حذف الساعات المسجلة متاح للمدير فقط." : "⚠️ Solo l'amministratore può eliminare le registrazioni.");
      return;
    }
    if (confirm(t.confirmDelete)) {
      await deleteWorkLog(id);
      onRefresh();
    }
  };

  const handleClearAll = async () => {
    if (userRole !== "admin") return;
    if (confirm(t.confirmClearAll)) {
      await clearAllWorkLogs();
      onRefresh();
    }
  };

  // Filtering
  const filteredLogs = logs.filter((log) => {
    // If worker mode, strictly only show THIS specific worker's logs
    if (userRole === "worker") {
      if (!selectedWorker) return false;
      const isMyLog = 
        (log.workerId && log.workerId === selectedWorker.id) || 
        (log.workerName && log.workerName.trim().toLowerCase() === selectedWorker.name.trim().toLowerCase());
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

    const matchesCantiere =
      selectedCantiereFilter === "ALL" ||
      log.locationName === selectedCantiereFilter ||
      (log.address && log.address.includes(selectedCantiereFilter));

    return matchesSearch && matchesType && matchesWorker && matchesCantiere;
  });

  // ── Worker PDF Export helpers ──────────────────────────────────────────────
  const [exportYear, exportMonthNum] = exportSelectedMonth.split("-");
  const exportMonthName = MONTHS_IT.find((m) => m.value === exportMonthNum)?.name || exportMonthNum;

  const workerExportLogs = useMemo(() => {
    if (!selectedWorker) return [];
    return logs
      .filter((log) => {
        const isMyLog =
          (log.workerId && log.workerId === selectedWorker.id) ||
          (log.workerName &&
            log.workerName.trim().toLowerCase() === selectedWorker.name.trim().toLowerCase());
        return isMyLog && log.date && log.date.startsWith(exportSelectedMonth);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, selectedWorker, exportSelectedMonth]);

  const workerExportTotalHours = workerExportLogs.reduce(
    (acc, l) => acc + (parseFloat(l.totalHours) || 0),
    0
  );

  const handleWorkerPrintPDF = () => {
    const workerName = selectedWorker?.name || "Lavoratore";
    const rows = workerExportLogs
      .map((log) => {
        const dayName = getDayNameIT(log.date);
        return `<tr>
          <td>${log.date}</td>
          <td>${dayName}</td>
          <td><b>${log.startTime}</b></td>
          <td><b>${log.endTime || "-"}</b></td>
          <td style="text-align:center;">${log.breakMinutes || 0} min</td>
          <td style="font-weight:900;color:#1d4ed8;text-align:center;">${log.totalHours} h</td>
          <td>${log.workType || "Ordinario"}</td>
          <td>${log.locationName || ""}</td>
          <td style="color:#64748b;">${log.notes || "-"}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Scheda Ore - ${workerName} - ${exportMonthName} ${exportYear}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1e293b}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#1e293b;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase}
    td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
    tr:nth-child(even) td{background:#f8fafc}
    .total-row td{background:#1e293b!important;color:#fff;font-weight:bold;padding:8px;border:none}
    .header-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0}
    .lbl{font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase}
    .val{font-size:14px;font-weight:900;margin-top:3px}
    .sig{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px}
    .sig-line{border-top:1px solid #94a3b8;padding-top:6px;font-size:10px;color:#64748b}
    @media print{body{padding:8px}}
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e293b;padding-bottom:16px;margin-bottom:16px;">
    <div>
      <div style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;">SCHEDA ORE DI LAVORO</div>
      <div style="font-size:13px;font-weight:700;margin-top:2px;">بطاقة ساعات العمل الرسمية</div>
      <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-top:4px;">Registro Ufficiale Presenze — ElettroOre Italia</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;">${exportMonthName} ${exportYear}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">DOCUMENTO UFFICIALE</div>
    </div>
  </div>
  <div class="header-grid">
    <div><div class="lbl">Lavoratore / العامل</div><div class="val">${workerName}</div></div>
    <div><div class="lbl">Periodo / الفترة</div><div class="val">${exportMonthName} ${exportYear}</div></div>
    <div><div class="lbl">Ore Totali / إجمالي الساعات</div><div class="val" style="color:#1d4ed8;">${workerExportTotalHours.toFixed(2)} h</div></div>
    <div><div class="lbl">Giorni Lavorati / أيام العمل</div><div class="val" style="color:#059669;">${workerExportLogs.length} gg</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data / التاريخ</th><th>Giorno / اليوم</th><th>Entrata / دخول</th>
        <th>Uscita / خروج</th><th>Pausa / استراحة</th><th>Ore / الساعات</th>
        <th>Tipo / النوع</th><th>Cantiere / الموقع</th><th>Note / ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5" style="text-align:right;padding-right:12px;">TOTALE / المجموع:</td>
        <td style="font-size:14px;">${workerExportTotalHours.toFixed(2)} h</td>
        <td colspan="3" style="font-size:11px;opacity:0.8;">${workerExportLogs.length} giorni / يوم عمل</td>
      </tr>
    </tbody>
  </table>
  <div class="sig">
    <div><div class="sig-line">Firma Lavoratore / توقيع العامل<br><b>${workerName}</b></div></div>
    <div><div class="sig-line">Firma Responsabile / توقيع المدير<br><span style="color:#94a3b8;">_________________________</span></div></div>
  </div>
  <p style="text-align:center;margin-top:24px;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:12px;">
    Generato da ElettroOre Italia — ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
  </p>
  <script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleWorkerWhatsAppExport = () => {
    if (typeof window === "undefined") return;
    const cleanPhone = exportPhone.replace(/[^0-9+]/g, "");
    if (!cleanPhone) {
      alert(
        lang === "ar"
          ? "⚠️ يرجى إدخال رقم واتساب المدير أولاً في الحقل أعلاه!"
          : "⚠️ Inserisci prima il numero WhatsApp del responsabile!"
      );
      return;
    }
    // Save phone for next time
    localStorage.setItem("oralavoro_managerPhone", exportPhone);
    const workerName = selectedWorker?.name || "Lavoratore";

    // Step 1: Open the PDF page so user can save/download it
    handleWorkerPrintPDF();

    // Step 2: After PDF opens, launch WhatsApp with a short note
    const msg =
      lang === "ar"
        ? `📄 السلام عليكم،\nأنا *${workerName}* أرسل لك استمارة ساعات العمل الشهرية.\n\n📅 الشهر: *${exportMonthName} ${exportYear}*\n⏱️ إجمالي الساعات: *${workerExportTotalHours.toFixed(2)} h*\n🗓️ أيام العمل: *${workerExportLogs.length} يوم*\n\n📎 *يرجى مراجعة ملف PDF المرفق والتوقيع عليه.*\n\n_— ElettroOre Italia_`
        : `📄 Salve,\nSono *${workerName}* — invio la scheda mensile ore.\n\n📅 Mese: *${exportMonthName} ${exportYear}*\n⏱️ Ore Totali: *${workerExportTotalHours.toFixed(2)} h*\n🗓️ Giorni Lavorati: *${workerExportLogs.length}*\n\n📎 *Si prega di verificare il PDF allegato e firmarlo.*\n\n_— ElettroOre Italia_`;

    setTimeout(() => {
      window.open(
        `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`,
        "_blank"
      );
    }, 1500);
  };

  const handleWorkerEmailExport = () => {
    const workerName = selectedWorker?.name || "Lavoratore";
    const subject = encodeURIComponent(
      `Scheda Ore Lavoro - ${workerName} - ${exportMonthName} ${exportYear}`
    );
    const body = encodeURIComponent(
      `Gentile Responsabile / مدير محترم،\n\n` +
        `نرسل لكم ملخص ساعات العمل — Riepilogo ore di lavoro:\n\n` +
        `👤 Lavoratore / العامل: ${workerName}\n` +
        `📅 Periodo / الفترة: ${exportMonthName} ${exportYear}\n` +
        `⏱️ Ore Totali / إجمالي الساعات: ${workerExportTotalHours.toFixed(2)} h\n` +
        `🗓️ Giorni Lavorati / أيام العمل: ${workerExportLogs.length} giorni\n\n` +
        `يرجى مراجعة الساعات والتوقيع.\nSi prega di verificare e firmare.\n\n` +
        `Cordiali saluti,\n${workerName}\n— ElettroOre Italia`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleExportPrevMonth = () => {
    let m = parseInt(exportMonthNum, 10) - 1;
    let y = parseInt(exportYear, 10);
    if (m < 1) { m = 12; y -= 1; }
    setExportSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  const handleExportNextMonth = () => {
    let m = parseInt(exportMonthNum, 10) + 1;
    let y = parseInt(exportYear, 10);
    if (m > 12) { m = 1; y += 1; }
    setExportSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };
  // ── End Worker PDF Export helpers ──────────────────────────────────────────

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
          {logs.length > 0 && userRole === "admin" && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-semibold rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.btnClearAll}</span>
            </button>
          )}

          {/* Manual entry button — admin only */}
          {userRole === "admin" && (
            <button
              onClick={openNewModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{t.btnNewEntry}</span>
            </button>
          )}

          {/* Worker: PDF export button */}
          {userRole === "worker" && (
            <button
              onClick={() => setShowWorkerExport(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>{lang === "ar" ? "📄 إرسال ساعاتي كـ PDF" : "📄 Invia Ore come PDF"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
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

        {/* Cantiere Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5">
          <HardHat className="w-4 h-4 text-amber-600" />
          <select
            value={selectedCantiereFilter}
            onChange={(e) => setSelectedCantiereFilter(e.target.value)}
            className="bg-transparent text-sm text-slate-800 font-bold focus:outline-none cursor-pointer"
          >
            <option value="ALL">{lang === "ar" ? "🏗️ كل مواقع العمل" : "🏗️ Tutti i Cantieri"}</option>
            {cantieri.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

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
                        {userRole === "admin" ? (
                          <>
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
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>{lang === "ar" ? "محمي ومسجل" : "Protetto"}</span>
                          </span>
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
                  ) : userRole === "admin" ? (
                    <span className="text-[11px] font-bold text-slate-400">
                      {lang === "ar" ? "GPS اختياري للمدير" : "GPS Opzionale (Admin)"}
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
                        : userRole === "admin"
                        ? "bg-slate-200 hover:bg-slate-300 text-slate-700"
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

      {/* ── WORKER PDF EXPORT MODAL ─────────────────────────────────────── */}
      {showWorkerExport && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh]">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {lang === "ar" ? "استمارة الساعات الرسمية 📄" : "Scheda Ore Ufficiale 📄"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === "ar"
                      ? "اختر الشهر ثم اطبع أو أرسل ساعاتك"
                      : "Seleziona il mese poi stampa o invia le tue ore"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWorkerExport(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Month Selector */}
            <div className="px-5 pt-4 flex items-center justify-center gap-3">
              <button
                onClick={handleExportPrevMonth}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <div className="text-lg font-black text-slate-900 uppercase tracking-wide">
                  {exportMonthName} {exportYear}
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  {lang === "ar" ? "الشهر المحدد" : "Mese selezionato"}
                </div>
              </div>
              <button
                onClick={handleExportNextMonth}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="px-5 pt-3 grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                  {lang === "ar" ? "إجمالي الساعات" : "Ore Totali"}
                </div>
                <div className="text-2xl font-black text-blue-800 mt-0.5">
                  {workerExportTotalHours.toFixed(2)} h
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">
                  {lang === "ar" ? "أيام العمل" : "Giorni Lavorati"}
                </div>
                <div className="text-2xl font-black text-emerald-800 mt-0.5">
                  {workerExportLogs.length}
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">
                  {lang === "ar" ? "العامل" : "Lavoratore"}
                </div>
                <div className="text-sm font-black text-indigo-800 mt-0.5 truncate">
                  {selectedWorker?.name || "-"}
                </div>
              </div>
            </div>

            {/* Log Preview Table */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {workerExportLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold">
                    {lang === "ar"
                      ? "لا توجد ساعات مسجلة لهذا الشهر"
                      : "Nessuna ora registrata per questo mese"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2">{lang === "ar" ? "التاريخ" : "Data"}</th>
                        <th className="px-3 py-2">{lang === "ar" ? "الدخول" : "Entrata"}</th>
                        <th className="px-3 py-2">{lang === "ar" ? "الخروج" : "Uscita"}</th>
                        <th className="px-3 py-2">{lang === "ar" ? "الساعات" : "Ore"}</th>
                        <th className="px-3 py-2">{lang === "ar" ? "الموقع" : "Cantiere"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {workerExportLogs.map((log, i) => (
                        <tr key={log.id || i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-semibold">{log.date}</td>
                          <td className="px-3 py-2 font-bold text-emerald-700">{log.startTime}</td>
                          <td className="px-3 py-2 font-bold text-rose-600">{log.endTime || "-"}</td>
                          <td className="px-3 py-2 font-black text-blue-700">{log.totalHours} h</td>
                          <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">{log.locationName}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800 text-white font-bold">
                        <td className="px-3 py-2 text-right" colSpan={3}>
                          {lang === "ar" ? "المجموع:" : "TOTALE:"}
                        </td>
                        <td className="px-3 py-2 text-blue-300">{workerExportTotalHours.toFixed(2)} h</td>
                        <td className="px-3 py-2 text-slate-400 text-[11px]">{workerExportLogs.length} {lang === "ar" ? "يوم" : "giorni"}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-5 border-t border-slate-100 space-y-3">

              {/* WhatsApp phone number input */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  📲 {lang === "ar" ? "رقم واتساب المدير (للإرسال):" : "Numero WhatsApp Responsabile:"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    dir="ltr"
                    value={exportPhone}
                    onChange={(e) => setExportPhone(e.target.value)}
                    placeholder={lang === "ar" ? "+39 351 000 0000 أو +20 100 000 0000" : "+39 351 000 0000"}
                    className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:font-normal placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (exportPhone) {
                        localStorage.setItem("oralavoro_managerPhone", exportPhone);
                        alert(lang === "ar" ? "✅ تم حفظ الرقم!" : "✅ Numero salvato!");
                      }
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {lang === "ar" ? "💾 حفظ" : "💾 Salva"}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium">
                  {lang === "ar"
                    ? "⚠️ أدخل الرقم مع كود الدولة (+39 للإيطاليا / +20 لمصر)"
                    : "⚠️ Includi il prefisso internazionale (+39 per Italia)"}
                </p>
              </div>

              <button
                onClick={handleWorkerPrintPDF}
                disabled={workerExportLogs.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {lang === "ar"
                    ? "🖨️ طباعة / تحميل كـ PDF (استمارة رسمية)"
                    : "🖨️ Stampa / Salva come PDF (Scheda Ufficiale)"}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleWorkerWhatsAppExport}
                  disabled={workerExportLogs.length === 0}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "📲 إرسال عبر واتساب" : "📲 Invia su WhatsApp"}</span>
                </button>
                <button
                  onClick={handleWorkerEmailExport}
                  disabled={workerExportLogs.length === 0}
                  className="py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "📧 إرسال بالإيميل" : "📧 Invia Email"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
