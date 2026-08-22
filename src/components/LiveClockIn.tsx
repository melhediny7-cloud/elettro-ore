import React, { useState, useEffect, useRef } from "react";
import { Play, Square, MapPin, Navigation, Clock, CheckCircle2, AlertCircle, RefreshCw, User, ChevronDown, ShieldAlert, MessageSquare, Phone, Send, Share2, X } from "lucide-react";
import { WorkLogEntry, WorkerProfile, createWorkLog, updateWorkLog, calculateNetHours, calculateTotalPay } from "../utils/api";
import { getCurrentDateISO, getCurrentTimeHHMM, PRESET_LOCATIONS_IT, WORK_TYPES_IT, reverseGeocode, parseWorkplaceZone, verifyWorkerGeofence } from "../utils/italian";
import { translations, Language } from "../utils/i18n";

// Web Audio API Alarm Sound Generator
function playGeofenceAlarmSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    // High-low-high-low urgent alarm beeps
    playTone(950, 0, 0.22);
    playTone(650, 0.25, 0.22);
    playTone(950, 0.50, 0.22);
    playTone(650, 0.75, 0.35);
  } catch (e) {
    console.warn("Audio alarm playback error", e);
  }
}

interface LiveClockInProps {
  logs: WorkLogEntry[];
  selectedWorker: WorkerProfile | null;
  workers: WorkerProfile[];
  onSelectWorker: (worker: WorkerProfile) => void;
  onRefresh: () => void;
  defaultLocation: string;
  lang: Language;
  userRole?: "worker" | "admin";
}

export const LiveClockIn: React.FC<LiveClockInProps> = ({
  logs,
  selectedWorker,
  workers,
  onSelectWorker,
  onRefresh,
  defaultLocation,
  lang,
  userRole = "worker",
}) => {
  const t = translations[lang];
  const workplaceZone = parseWorkplaceZone(defaultLocation);

  const [now, setNow] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState(workplaceZone.name || defaultLocation || "Ufficio Sede");
  const [customAddress, setCustomAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState("Ordinario");
  const [notes, setNotes] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Real-time Geofence monitoring
  const [isOutOfGeofence, setIsOutOfGeofence] = useState(false);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [whatsAppPromptData, setWhatsAppPromptData] = useState<{
    title: string;
    workerName: string;
    timeStr: string;
    dateStr: string;
    locationStr: string;
    url: string;
  } | null>(null);

  const activeWorkerName = selectedWorker?.name || "Mario Rossi";
  const activeWorkerRate = selectedWorker?.hourlyRate || "15.00";

  // Find active session for the CURRENT selected worker
  const currentActiveLog = logs.find(
    (l) =>
      (l.workerId === selectedWorker?.id || l.workerName === activeWorkerName) &&
      (l.isClockedIn === 1 || !l.endTime)
  ) || null;

  // Realtime digital clock update
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync default location
  useEffect(() => {
    if (defaultLocation && !selectedLocation) {
      setSelectedLocation(defaultLocation);
    }
  }, [defaultLocation]);

  const lastAlertedBreachTimeRef = useRef<number>(0);

  // Real-time Geofence watcher when clocked-in
  useEffect(() => {
    if (!currentActiveLog || typeof navigator === "undefined" || !navigator.geolocation) {
      setIsOutOfGeofence(false);
      return;
    }

    const checkPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const res = verifyWorkerGeofence(latitude, longitude, workplaceZone);
      setCurrentDistance(res.distanceKm);
      if (!res.allowed) {
        setIsOutOfGeofence(true);
        playGeofenceAlarmSound();
        if (navigator.vibrate) {
          navigator.vibrate([400, 200, 400, 200, 800]);
        }

        // Auto-send WhatsApp alert ONLY when worker leaves workplace during shift!
        const nowMs = Date.now();
        if (nowMs - lastAlertedBreachTimeRef.current > 180000) {
          lastAlertedBreachTimeRef.current = nowMs;
          const managerPhone = typeof window !== "undefined" ? localStorage.getItem("oralavoro_managerPhone") || "" : "";
          const cleanPhone = managerPhone.replace(/[^0-9]/g, "");
          const timeHHMM = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
          const dateStr = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
          
          const alertMsg = `🚨 *إنذار عاجل: خروج عامل من موقع العمل!*
━━━━━━━━━━━━━━━━━━━━━
👤 *اسم العامل / LAVORATORE:*
👉 *${activeWorkerName}* 👈
━━━━━━━━━━━━━━━━━━━━━
⚠️ *الحالة:* غادر نطاق العمل أثناء ساعات الدوام الرسمية!
📏 *المسافة الحالية عن الورشة:* ${res.distanceKm} كم (الحد المسموح: ${workplaceZone.radiusKm || 3.0} كم)
📍 *موقع الورشة المطلوب:* ${workplaceZone.name}
⏰ *الوقت:* ${timeHHMM}
📅 *التاريخ:* ${dateStr}
🌐 *موقع العامل الفعلي الحالي على الخريطة (GPS):*
https://www.google.com/maps?q=${latitude},${longitude}
━━━━━━━━━━━━━━━━━━━━━
_تنبيه تلقائي من نظام ElettroOre_`;

          const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(alertMsg)}`;
          
          setWhatsAppPromptData({
            title: "🚨 إنذار عاجل: خروج من موقع العمل!",
            workerName: activeWorkerName,
            timeStr: timeHHMM,
            dateStr,
            locationStr: `خارج النطاق (${res.distanceKm} كم عن الورشة)`,
            url: waUrl,
          });

          try {
            window.open(waUrl, "_blank");
          } catch {
            // Popup fallback
          }
        }
      } else {
        setIsOutOfGeofence(false);
      }
    };

    // Immediate check on mount/update
    navigator.geolocation.getCurrentPosition(checkPosition, () => {}, { enableHighAccuracy: true, timeout: 8000 });

    const watchId = navigator.geolocation.watchPosition(
      checkPosition,
      (err) => console.warn("Watch position error", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(checkPosition, () => {}, { enableHighAccuracy: true, timeout: 8000 });
    }, 15000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [currentActiveLog, workplaceZone]);

  // Request browser geolocation manually
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: "error", text: "Geolocalizzazione non supportata dal tuo browser." });
      return;
    }

    setGeoLoading(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        // Verify distance against Workplace 3km zone
        const geoCheck = verifyWorkerGeofence(latitude, longitude, workplaceZone);
        setCurrentDistance(geoCheck.distanceKm);

        // Reverse geocode to get street address
        const addr = await reverseGeocode(latitude, longitude);
        setCustomAddress(addr);
        setGeoLoading(false);

        if (geoCheck.allowed) {
          setStatusMessage({
            type: "success",
            text: `✅ Posizione GPS Verificata: ${addr} (Distanza dal cantiere: ${geoCheck.distanceKm} km)`,
          });
        } else {
          playGeofenceAlarmSound();
          setStatusMessage({
            type: "error",
            text: `⚠️ Attenzione: Sei a ${geoCheck.distanceKm} km dal cantiere (Limite: ${workplaceZone.radiusKm} km). Timbratura bloccata.`,
          });
        }
      },
      (err) => {
        console.warn("Geolocation error", err);
        setGeoLoading(false);
        setStatusMessage({
          type: "error",
          text: "Impossibile ottenere la posizione GPS. Attiva il GPS sul tuo telefono.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Clock In Action with AUTOMATIC LIVE GPS ACQUISITION & GEOFENCE ENFORCEMENT
  const handleClockIn = async () => {
    setLoading(true);
    setStatusMessage(null);

    let activeCoords = coords;
    let activeAddress = customAddress;

    // 1. AUTOMATIC REAL-TIME GPS ACQUISITION
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });

        const { latitude, longitude } = position.coords;
        activeCoords = { lat: latitude, lng: longitude };
        setCoords(activeCoords);

        const addr = await reverseGeocode(latitude, longitude);
        activeAddress = addr;
        setCustomAddress(addr);

        // 2. STRICT 3KM GEOFENCE VERIFICATION
        const geoCheck = verifyWorkerGeofence(latitude, longitude, workplaceZone);
        setCurrentDistance(geoCheck.distanceKm);

        if (!geoCheck.allowed) {
          playGeofenceAlarmSound();
          if (navigator.vibrate) {
            navigator.vibrate([400, 200, 400, 200, 800]);
          }

          setStatusMessage({
            type: "error",
            text: lang === "ar"
              ? `❌ تم رفض تسجيل الحضور! أنت تبعد مسافة (${geoCheck.distanceKm} كم) عن موقع العمل المحدد (${workplaceZone.name}). لا يمكن تسجيل الحضور من المنزل أو من خارج محيط الـ ${workplaceZone.radiusKm} كم!`
              : `❌ Timbratura Rifiutata! Sei a ${geoCheck.distanceKm} km dal cantiere (${workplaceZone.name}). Limite massimo: ${workplaceZone.radiusKm} km.`,
          });
          setLoading(false);
          return;
        }
      } catch (geoErr: any) {
        console.warn("Geolocation error during clock in:", geoErr);
        setStatusMessage({
          type: "error",
          text: lang === "ar"
            ? "⚠️ تنبيه أمني: لا يمكن تسجيل الحضور بدون تفعيل خدمة الـ GPS في هاتفك وإعطاء الإذن للمتصفح!"
            : "⚠️ Impossibile timbrare senza autorizzare la posizione GPS attiva sul dispositivo!",
        });
        setLoading(false);
        return;
      }
    } else {
      setStatusMessage({
        type: "error",
        text: "Geolocalizzazione GPS non supportata da questo dispositivo.",
      });
      setLoading(false);
      return;
    }

    // 3. PROCEED TO CREATE WORK LOG
    try {
      const dateISO = getCurrentDateISO();
      const timeHHMM = getCurrentTimeHHMM();

      await createWorkLog({
        workerId: selectedWorker?.id || null,
        workerName: activeWorkerName,
        date: dateISO,
        startTime: timeHHMM,
        endTime: null,
        breakMinutes: 0,
        totalHours: "0.00",
        hourlyRate: activeWorkerRate,
        totalPay: "0.00",
        workType: selectedWorkType,
        locationName: selectedLocation || workplaceZone.name,
        address: activeAddress || null,
        latitude: activeCoords ? String(activeCoords.lat) : null,
        longitude: activeCoords ? String(activeCoords.lng) : null,
        notes: notes || null,
        isClockedIn: 1,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }

      setStatusMessage({
        type: "success",
        text: lang === "ar"
          ? `✅ تم تسجيل الحضور بنجاح لـ ${activeWorkerName} الساعة ${timeHHMM}`
          : `Timbratura di Entrata registrata per ${activeWorkerName} alle ore ${timeHHMM}`,
      });
      onRefresh();
    } catch (e: any) {
      setStatusMessage({ type: "error", text: "Errore durante la timbratura: " + (e.message || "Errore sconosciuto") });
    } finally {
      setLoading(false);
    }
  };

  // Clock Out Action
  const handleClockOut = async () => {
    if (!currentActiveLog || !currentActiveLog.id) return;
    setLoading(true);
    setStatusMessage(null);

    try {
      const timeHHMM = getCurrentTimeHHMM();
      const netHours = calculateNetHours(currentActiveLog.startTime, timeHHMM, Number(breakMinutes));
      const rateToUse = currentActiveLog.hourlyRate ? String(currentActiveLog.hourlyRate) : activeWorkerRate;
      const totalPay = calculateTotalPay(netHours, rateToUse);

      await updateWorkLog({
        ...currentActiveLog,
        endTime: timeHHMM,
        breakMinutes: Number(breakMinutes),
        totalHours: netHours,
        hourlyRate: rateToUse,
        totalPay: totalPay,
        isClockedIn: 0,
        notes: notes || currentActiveLog.notes,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 80, 60]);
      }

      setStatusMessage({
        type: "success",
        text: `Timbratura di Uscita registrata alle ore ${timeHHMM}. Giornata completata (${netHours} ore)!`,
      });
      onRefresh();
    } catch (e: any) {
      setStatusMessage({ type: "error", text: "Errore durante l'uscita: " + (e.message || "Errore sconosciuto") });
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp direct report helper
  const sendWhatsAppReport = (type: "entrata" | "uscita" | "allarme") => {
    const managerPhone = typeof window !== "undefined" ? localStorage.getItem("oralavoro_managerPhone") || "" : "";
    const cleanPhone = managerPhone.replace(/[^0-9]/g, "");
    const workerName = selectedWorker ? selectedWorker.name : activeWorkerName;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dateStr = now.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    const locationStr = currentActiveLog?.address || currentActiveLog?.locationName || workplaceZone.name || "Cantiere";
    const gpsCoords = currentActiveLog?.latitude && currentActiveLog?.longitude 
      ? `${currentActiveLog.latitude},${currentActiveLog.longitude}` 
      : `${workplaceZone.lat},${workplaceZone.lng}`;
    
    let statusTitle = type === "entrata" ? "🟢 تسجيل دخول (TIMBRATURA ENTRATA)" : (type === "uscita" ? "🔴 تسجيل خروج (TIMBRATURA USCITA)" : "🚨 إنذار خروج عن الورشة (ALLARME FUORI CANTIERE)");
    
    const msg = `🚨 *NOTIFICA ELETTRO-ORE / إشعار حضور وانصراف*
━━━━━━━━━━━━━━━━━━━━━
👤 *اسم العامل / LAVORATORE:*
👉 *${workerName}* 👈
━━━━━━━━━━━━━━━━━━━━━
📝 *العملية / STATO:* ${statusTitle}
⏰ *الساعة / ORARIO:* ${timeStr}
📅 *التاريخ / DATA:* ${dateStr}
📍 *موقع العمل / CANTIERE:* ${workplaceZone.name}
🗺️ *العنوان الدقيق / INDIRIZZO:* ${locationStr}
🌐 *رابط الموقع الجغرافي (GPS MAP):*
https://www.google.com/maps?q=${gpsCoords}
━━━━━━━━━━━━━━━━━━━━━
_تم الإرسال تلقائياً من تطبيق ElettroOre Italia_`;

    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Calculate elapsed time if currently clocked in
  const getElapsedTime = () => {
    if (!currentActiveLog || !currentActiveLog.startTime) return "00:00";
    try {
      const [startH, startM] = currentActiveLog.startTime.split(":").map(Number);
      const start = new Date();
      start.setHours(startH, startM, 0, 0);

      const diffMs = Math.max(0, now.getTime() - start.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
    } catch {
      return "00:00";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* OUT OF GEOFENCE WARNING ALERT (Real-time detection) */}
      {isOutOfGeofence && currentActiveLog && (
        <div className="bg-rose-600 text-white p-5 rounded-2xl shadow-xl border-2 border-rose-400 animate-pulse flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 flex-shrink-0 text-amber-300 animate-bounce" />
          <div className="flex-1">
            <h3 className="font-black text-lg text-amber-200 uppercase tracking-wide">
              {lang === "ar" ? "🚨 تحذير: لقد خرجت عن موقع العمل!" : "🚨 ALLARME: SEI FUORI DAL POSTO DI LAVORO!"}
            </h3>
            <p className="text-base font-bold mt-1 text-white">
              {lang === "ar"
                ? "يرجى العودة فوراً إلى موقع العمل."
                : "Rientra immediatamente sul posto di lavoro."}
            </p>
          </div>
          <div className="flex items-center gap-2 self-center flex-wrap">
            <button
              type="button"
              onClick={() => playGeofenceAlarmSound()}
              className="px-3 py-1.5 bg-amber-400 text-slate-900 font-extrabold text-xs rounded-xl shadow hover:bg-amber-300 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>🔊 {lang === "ar" ? "صوت الإنذار" : "Allarme"}</span>
            </button>

            <button
              type="button"
              onClick={() => sendWhatsAppReport("allarme")}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1 border border-white/20 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === "ar" ? "واتساب المدير" : "WhatsApp"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Digital Clock & Status Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700/80 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-medium text-xs sm:text-sm tracking-wider uppercase mb-1">
              <Clock className="w-4 h-4" />
              <span>Orologio Digitale in Tempo Reale</span>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-white drop-shadow-sm">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <p className="text-sm text-slate-300 mt-1 capitalize font-medium">
              {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Current Status Badge */}
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl flex items-center gap-4 min-w-[240px]">
            <div
              className={`w-3.5 h-3.5 rounded-full animate-pulse ${
                currentActiveLog ? "bg-emerald-400 shadow-lg shadow-emerald-500/50" : "bg-amber-400 shadow-lg shadow-amber-500/50"
              }`}
            />
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Stato Attuale</span>
              <span className="text-base font-bold text-white">
                {currentActiveLog ? "IN SERVIZIO (Entrato)" : "FUORI SERVIZIO (Non Timbrato)"}
              </span>
              {currentActiveLog && (
                <div className="text-xs text-emerald-400 font-medium mt-0.5">
                  Dalle ore {currentActiveLog.startTime} ({getElapsedTime()})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification status message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 border transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* WORKER IDENTITY BAR (Allows picking or confirming worker) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-base shadow-md">
            {(activeWorkerName || "M")[0]}
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              {t.selectWorkerLabel}
            </span>
            <span className="text-base font-bold text-slate-900">
              {activeWorkerName}
            </span>
          </div>
        </div>

        {workers.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium hidden sm:block">Cambia:</label>
            <select
              value={selectedWorker?.id || workers[0]?.id}
              onChange={(e) => {
                const found = workers.find((w) => w.id === Number(e.target.value));
                if (found) {
                  onSelectWorker(found);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("oralavoro_selected_worker_id", String(found.id));
                  }
                }
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {userRole === "admin" ? `(${w.hourlyRate} €/h)` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Timbratrice Form */}
      {!currentActiveLog ? (
        /* CLOCK IN PANEL */
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-600 fill-emerald-600" />
              <span>Timbratura di Entrata (Inizio Lavoro)</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Registra il tuo inizio turno e seleziona o rileva la posizione GPS del luogo di lavoro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Work Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo di Lavoro</label>
              <div className="grid grid-cols-2 gap-2">
                {WORK_TYPES_IT.map((wt) => (
                  <button
                    key={wt.id}
                    type="button"
                    onClick={() => setSelectedWorkType(wt.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-all ${
                      selectedWorkType === wt.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Luogo / Sede di Lavoro</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRESET_LOCATIONS_IT.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* GPS Detection Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">Posizione GPS Geolocalizzata</span>
                  <span className="text-xs text-slate-500">Rileva l'indirizzo esatto per la scheda ore</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={geoLoading}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {geoLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <Navigation className="w-4 h-4 text-blue-600" />
                )}
                <span>{geoLoading ? "Rilevamento GPS..." : "Rileva Posizione GPS"}</span>
              </button>
            </div>

            <input
              type="text"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              placeholder="Indirizzo o dettagli cantiere (es: Via Roma 15, Milano)"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Note / Attività Previste</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descrizione breve delle attività di oggi..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Big Clock In Button */}
          <button
            type="button"
            onClick={handleClockIn}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Play className="w-6 h-6 fill-white" />
            )}
            <span>TIMBRA ENTRATA</span>
          </button>
        </div>
      ) : (
        /* CLOCK OUT PANEL */
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Square className="w-5 h-5 text-rose-600 fill-rose-600" />
                <span>Timbratura di Uscita (Fine Lavoro)</span>
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Conferma la fine del turno di oggi per calcolare le ore totali lavorate.
              </p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-300">
              Sessione Attiva
            </span>
          </div>

          {/* Current Active Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 block font-medium">{t.entryTime}</span>
              <span className="text-lg font-bold text-slate-900">{currentActiveLog.startTime}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">{t.locationLabel}</span>
              <span className="text-sm font-semibold text-slate-800">{currentActiveLog.locationName}</span>
              {currentActiveLog.address && (
                <span className="text-xs text-slate-500 block truncate">{currentActiveLog.address}</span>
              )}
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">{t.workTypeLabel}</span>
              <span className="text-sm font-semibold text-blue-700">{currentActiveLog.workType}</span>
            </div>
            <div>
              <span className="text-xs text-emerald-600 block font-bold">{t.totalPayLabel}</span>
              {(() => {
                const nowHHMM = getCurrentTimeHHMM();
                const netH = calculateNetHours(currentActiveLog.startTime, nowHHMM, Number(breakMinutes));
                const rateToUse = currentActiveLog.hourlyRate ? String(currentActiveLog.hourlyRate) : hourlyRate || "12.50";
                const payEst = calculateTotalPay(netH, rateToUse);
                return (
                  <span className="text-lg font-black text-emerald-700 block">€ {payEst} ({netH}h)</span>
                );
              })()}
            </div>
          </div>

          {/* Break & Notes Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Pausa / Intervallo (Minuti)
              </label>
              <select
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Nessuna pausa (0 min)</option>
                <option value={15}>15 Minuti</option>
                <option value={30}>30 Minuti</option>
                <option value={45}>45 Minuti</option>
                <option value={60}>1 Ora (60 min)</option>
                <option value={90}>1 Ora e 30 Minuti (90 min)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Note Finali / Attività Svolte</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aggiungi dettagli sulle attività svolte durante il turno..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Big Clock Out Button */}
          <button
            type="button"
            onClick={handleClockOut}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-rose-600/25 flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Square className="w-6 h-6 fill-white" />
            )}
            <span>TIMBRA USCITA</span>
          </button>
        </div>
      )}

      {/* WhatsApp Instant Notification Modal */}
      {whatsAppPromptData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {lang === "ar" ? "إشعار الواتساب الفوري للمدير" : "Notifica WhatsApp al Manager"}
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {lang === "ar" ? "تم تسجيل الختم بنجاح في النظام" : "Timbratura salvata con successo"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppPromptData(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-bold text-emerald-800 text-sm">{whatsAppPromptData.title}</p>
              <p>👷 <b>{whatsAppPromptData.workerName}</b></p>
              <p>⏰ {whatsAppPromptData.timeStr} | 📅 {whatsAppPromptData.dateStr}</p>
              <p>📍 {whatsAppPromptData.locationStr}</p>
              <p className="text-[11px] text-blue-600">🌐 مع رابط مباشر لخرائط جوجل GPS</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  window.open(whatsAppPromptData.url, "_blank");
                  setWhatsAppPromptData(null);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{lang === "ar" ? "فتح واتساب وإرسال الإشعار الآن 📲" : "Apri WhatsApp e Invia 📲"}</span>
              </button>
              <button
                onClick={() => setWhatsAppPromptData(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {lang === "ar" ? "إغلاق والتخطي" : "Chiudi e Salta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
