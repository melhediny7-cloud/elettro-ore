import React, { useState, useEffect } from "react";
import { Play, Square, MapPin, Navigation, Clock, CheckCircle2, AlertCircle, RefreshCw, User, ChevronDown } from "lucide-react";
import { WorkLogEntry, WorkerProfile, createWorkLog, updateWorkLog, calculateNetHours, calculateTotalPay } from "../utils/api";
import { getCurrentDateISO, getCurrentTimeHHMM, PRESET_LOCATIONS_IT, WORK_TYPES_IT, reverseGeocode } from "../utils/italian";
import { translations, Language } from "../utils/i18n";

interface LiveClockInProps {
  logs: WorkLogEntry[];
  selectedWorker: WorkerProfile | null;
  workers: WorkerProfile[];
  onSelectWorker: (worker: WorkerProfile) => void;
  onRefresh: () => void;
  defaultLocation: string;
  lang: Language;
}

export const LiveClockIn: React.FC<LiveClockInProps> = ({
  logs,
  selectedWorker,
  workers,
  onSelectWorker,
  onRefresh,
  defaultLocation,
  lang,
}) => {
  const t = translations[lang];
  const [now, setNow] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation || "Ufficio Sede");
  const [customAddress, setCustomAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState("Ordinario");
  const [notes, setNotes] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Request browser geolocation
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

        // Reverse geocode to get street address
        const addr = await reverseGeocode(latitude, longitude);
        setCustomAddress(addr);
        setGeoLoading(false);
        setStatusMessage({ type: "success", text: `Posizione GPS rilevata: ${addr}` });
      },
      (err) => {
        console.warn("Geolocation error", err);
        setGeoLoading(false);
        setStatusMessage({
          type: "error",
          text: "Impossibile ottenere la posizione GPS. Inserisci il luogo manualmente.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Clock In Action
  const handleClockIn = async () => {
    setLoading(true);
    setStatusMessage(null);
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
        locationName: selectedLocation,
        address: customAddress || null,
        latitude: coords ? String(coords.lat) : null,
        longitude: coords ? String(coords.lng) : null,
        notes: notes || null,
        isClockedIn: 1,
      });

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }

      setStatusMessage({
        type: "success",
        text: `Timbratura di Entrata registrata per ${activeWorkerName} alle ore ${timeHHMM}`,
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
                if (found) onSelectWorker(found);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.hourlyRate} €/h)
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
    </div>
  );
};
