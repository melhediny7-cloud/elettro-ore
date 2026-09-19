import React, { useState, useEffect } from "react";
import { Building2, MapPin, Database, RefreshCw, Check, Trash2, ShieldCheck, Lock, Shield, KeyRound, AlertCircle, Navigation, Compass, ShieldAlert, MessageSquare, Phone, Send, Smartphone } from "lucide-react";
import { seedSampleData, clearAllWorkLogs, clearAllWorkers, changeAdminPin, updateAppSettings } from "../utils/api";
import { parseWorkplaceZone, formatWorkplaceZone, reverseGeocode } from "../utils/italian";
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

  // WhatsApp Manager Phone
  const [managerPhone, setManagerPhone] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("oralavoro_managerPhone") || "+39 351 000 0000" : "+39 351 000 0000";
  });
  const [whatsappSaved, setWhatsappSaved] = useState(false);

  // Geofence Zone state
  const initialZone = parseWorkplaceZone(defaultLocation);
  const [zoneName, setZoneName] = useState(initialZone.name);
  const [zoneLat, setZoneLat] = useState(String(initialZone.lat));
  const [zoneLng, setZoneLng] = useState(String(initialZone.lng));
  const [zoneRadius, setZoneRadius] = useState(String(initialZone.radiusKm || 3.0));
  const [geoLocLoading, setGeoLocLoading] = useState(false);

  // Sync if defaultLocation prop updates
  useEffect(() => {
    const z = parseWorkplaceZone(defaultLocation);
    setZoneName(z.name);
    setZoneLat(String(z.lat));
    setZoneLng(String(z.lng));
    setZoneRadius(String(z.radiusKm || 3.0));
  }, [defaultLocation]);

  // Presets of famous Italian cantieri / work places
  const WORKPLACE_PRESETS = [
    { name: "Ospedale Luigi Sacco - Milano", lat: "45.5204", lng: "9.1303", icon: "🏥" },
    { name: "Ufficio Sede Centrale - Milano (Via Dante)", lat: "45.4642", lng: "9.1900", icon: "🏢" },
    { name: "Cantiere Baranzate (Via Gradisca)", lat: "45.5278", lng: "9.1172", icon: "🏗️" },
    { name: "Cantiere Milano Certosa (Raccordo A8)", lat: "45.5020", lng: "9.1450", icon: "🛣️" },
    { name: "Impianto Industriale - Monza", lat: "45.5845", lng: "9.2744", icon: "🏭" },
  ];

  // Address search state
  const [addressSearchQuery, setAddressSearchQuery] = useState("");
  const [addressSearchResults, setAddressSearchResults] = useState<any[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [showCoordsDetails, setShowCoordsDetails] = useState(false);

  // Instant Address Search
  const handleSearchAddress = async (query: string) => {
    setAddressSearchQuery(query);
    if (!query || query.trim().length < 3) {
      setAddressSearchResults([]);
      return;
    }

    // Check if query is Google Maps URL or raw coordinates
    const gmapsCoords = query.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || query.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/) || query.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (gmapsCoords) {
      const lat = parseFloat(gmapsCoords[1]);
      const lng = parseFloat(gmapsCoords[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setZoneLat(String(lat.toFixed(5)));
        setZoneLng(String(lng.toFixed(5)));
        setZoneName(`Posizione GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        setAddressSearchResults([]);
        return;
      }
    }

    setAddressSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=it,eg,fr,de,ch&limit=5`, {
        headers: { "User-Agent": "OraLavoroApp/1.0" },
      });
      if (res.ok) {
        const data = await res.json();
        setAddressSearchResults(data || []);
      }
    } catch (e) {
      console.warn("Search error", e);
    } finally {
      setAddressSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setZoneLat(String(lat.toFixed(5)));
    setZoneLng(String(lng.toFixed(5)));
    setZoneName(result.display_name.split(",").slice(0, 3).join(","));
    setAddressSearchQuery("");
    setAddressSearchResults([]);
  };

  const handleSelectPreset = (preset: typeof WORKPLACE_PRESETS[0]) => {
    setZoneName(preset.name);
    setZoneLat(preset.lat);
    setZoneLng(preset.lng);
  };

  const handleDetectAdminGPS = () => {
    if (!navigator.geolocation) {
      alert(lang === "ar" ? "المتصفح لا يدعم تحديد الموقع" : "Geolocalizzazione non supportata");
      return;
    }
    setGeoLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setZoneLat(String(latitude.toFixed(5)));
        setZoneLng(String(longitude.toFixed(5)));
        const addr = await reverseGeocode(latitude, longitude);
        if (addr) setZoneName(addr);
        setGeoLocLoading(false);
      },
      (err) => {
        setGeoLocLoading(false);
        console.warn("Admin GPS error", err);
        alert(lang === "ar" ? "تعذر تحديد الموقع، يرجى تفعيل الـ GPS في جهازك." : "Impossibile rilevare GPS. Attiva i permessi.");
      },
      { enableHighAccuracy: true }
    );
  };

  // PIN Change State
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const encodedLocation = formatWorkplaceZone(zoneName, zoneLat, zoneLng, zoneRadius);
    setDefaultLocation(encodedLocation);

    if (typeof window !== "undefined") {
      localStorage.setItem("oralavoro_companyName", companyName);
      localStorage.setItem("oralavoro_defaultLocation", encodedLocation);
    }

    try {
      await updateAppSettings({
        companyName,
        defaultLocation: encodedLocation,
      });
    } catch (e) {
      console.warn("Could not sync settings to cloud", e);
    }

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
        await clearAllWorkers();
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
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
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
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
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
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
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

      {/* 2. COMPANY METADATA & SUPER EASY GEOFENCING SETTINGS */}
      <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              <span>{lang === "ar" ? "تحديد موقع العمل ونطاق الـ 3 كم (Geofencing GPS)" : "Zona Geofencing Cantiere (GPS 3 km)"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === "ar"
                ? "ابحث باسم الشارع أو المستشفى أو اختر من المواقع السريعة الجاهزة بنقرة واحدة."
                : "Cerca per indirizzo, scegli tra i luoghi rapidi o rileva la tua posizione attuale."}
            </p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> GPS 3 KM
          </span>
        </div>

        <form onSubmit={handleSaveCompanySettings} className="space-y-5">
          
          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>{t.companyNameLabel}</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="es: Power / Edilizia s.r.l."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 🌟 1. SMART ADDRESS SEARCH BOX */}
          <div className="space-y-2 relative">
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-600" />
                <span>{lang === "ar" ? "🔍 ابحث عن عنوان الورشة أو المستشفى / الصق رابط خرائط جوجل:" : "🔍 Cerca Indirizzo o Incolla Link Google Maps:"}</span>
              </span>
              {addressSearching && <span className="text-[11px] text-blue-600 font-bold flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> جاري البحث...</span>}
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={addressSearchQuery}
                onChange={(e) => handleSearchAddress(e.target.value)}
                placeholder={lang === "ar" ? "مثال: Ospedale Sacco Milano أو Via Felice Orsini أو Via Dante..." : "es: Ospedale Sacco Milano, Via Felice Orsini, Via Dante..."}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleDetectAdminGPS}
                disabled={geoLocLoading}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all flex-shrink-0"
              >
                {geoLocLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                <span>{lang === "ar" ? "موقعي الحالي 📍" : "Mia Posizione 📍"}</span>
              </button>
            </div>

            {/* Search Results Dropdown */}
            {addressSearchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 divide-y max-h-48 overflow-y-auto">
                {addressSearchResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(r)}
                    className="w-full text-left p-3 hover:bg-blue-50 text-xs font-medium text-slate-800 flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <span>{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 🌟 2. ONE-CLICK PRESET LOCATIONS */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">
              {lang === "ar" ? "⚡ أو اختر موقعاً جاهزاً بنقرة واحدة:" : "⚡ Oppure seleziona un cantiere rapido:"}
            </span>
            <div className="flex flex-wrap gap-2">
              {WORKPLACE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    zoneName.includes(p.name.split(" ")[0])
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 🌟 3. ACTIVE SELECTED LOCATION CARD */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-xl shadow border border-slate-700 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {lang === "ar" ? "موقع العمل المعتمد حالياً للعمال:" : "Cantiere Attivo Configurato:"}
                </span>
                <h4 className="text-base font-black text-white mt-0.5">
                  {zoneName}
                </h4>
              </div>
              <span className="px-2.5 py-1 bg-amber-400 text-slate-900 font-extrabold text-xs rounded-lg shadow flex-shrink-0">
                محيط {zoneRadius} كم
              </span>
            </div>

            {/* Radius Selector */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-slate-300 font-medium">
                {lang === "ar" ? "نطاق السماح للـ GPS:" : "Raggio di tolleranza:"}
              </span>
              <select
                value={zoneRadius}
                onChange={(e) => setZoneRadius(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="1.0">1.0 km (نطاق ضيق 1 كم)</option>
                <option value="2.0">2.0 km (نطاق 2 كم)</option>
                <option value="3.0">3.0 km (الموصى به - محيط 3 كم)</option>
                <option value="5.0">5.0 km (نطاق واسع 5 كم)</option>
                <option value="10.0">10.0 km (نطاق مدينة 10 كم)</option>
              </select>
            </div>

            {/* Collapsible Manual Coordinates */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowCoordsDetails(!showCoordsDetails)}
                className="text-[11px] text-blue-300 hover:text-white underline font-semibold flex items-center gap-1"
              >
                <span>{showCoordsDetails ? "إخفاء التفاصيل الإحداثية" : "عرض الأرقام الإحداثية (Latitude / Longitude)"}</span>
              </button>

              {showCoordsDetails && (
                <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono mb-0.5">Latitude</label>
                    <input
                      type="text"
                      value={zoneLat}
                      onChange={(e) => setZoneLat(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-mono mb-0.5">Longitude</label>
                    <input
                      type="text"
                      value={zoneLng}
                      onChange={(e) => setZoneLng(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {saved ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> {t.settingsSaved}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Tutte le impostazioni sono salvate sul cloud Supabase</span>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{t.btnSaveSettings}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. WHATSAPP MANAGER NOTIFICATIONS */}
      <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <span>{lang === "ar" ? "إشعارات الواتساب الفورية للمدير (Notifiche WhatsApp)" : "Notifiche WhatsApp al Manager"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === "ar"
                ? "حدد رقم هاتف المدير لاستلام تقارير الحضور والانصراف وموقع الـ GPS للعمال فورياً على واتساب."
                : "Imposta il numero WhatsApp del titolare per ricevere le notifiche di entrata/uscita dei lavoratori con GPS."}
            </p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" /> WhatsApp
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>{lang === "ar" ? "رقم هاتف المدير (مع كود الدولة):" : "Numero WhatsApp Titolare (con prefisso):"}</span>
            </label>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                placeholder="+39 351 123 4567"
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={async () => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("oralavoro_managerPhone", managerPhone);
                  }
                  await updateAppSettings({ managerPhone, companyName });
                  setWhatsappSaved(true);
                  setTimeout(() => setWhatsappSaved(false), 3000);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{lang === "ar" ? "حفظ على السحابة" : "Salva Numero"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const cleanPhone = managerPhone.replace(/[^0-9]/g, "");
                  const msg = encodeURIComponent(`🧪 *TEST NOTIFICA ELETTRO-ORE*\n✅ Il numero WhatsApp del Manager è configurato e funzionante con successo!`);
                  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}`, "_blank");
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === "ar" ? "تجربة الإرسال 💬" : "Test Invio 💬"}</span>
              </button>
            </div>
            {whatsappSaved && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
                <Check className="w-3.5 h-3.5" /> {lang === "ar" ? "تم حفظ رقم المدير وتزامنه على كافة هواتف العمال بنجاح!" : "Numero sincronizzato con successo su tutti i dispositivi!"}
              </span>
            )}
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 font-medium">
            💡 {lang === "ar" 
              ? "عند قيام أي عامل بختم الدخول أو الخروج، يمكن إرسال إشعار فوري يحتوي على اسم العامل، التوقيت، ورابط جوجل ماب لموقعه الجغرافي."
              : "Ogni timbratura genera un riepilogo con orario, nome lavoratore e link diretto Google Maps della posizione."}
          </div>
        </div>
      </div>

      {/* 4. DATABASE & CLOUD TOOLS */}
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

      {/* 4. IMPORT HISTORICAL DATA MODAL / CARD */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <span>{lang === "ar" ? "استيراد بيانات أو سجلات سابقة" : "Importa Dati e Registri Precedenti"}</span>
        </h3>
        <p className="text-xs text-slate-500">
          {lang === "ar" 
            ? "إذا كان لديك كود بيانات محفوظ سابقاً، يمكنك لصقه هنا لإضافته فوراً إلى قاعدة البيانات السحابية." 
            : "Incolla il JSON dei dati salvati precedentemente per importarli direttamente su Supabase Cloud."}
        </p>

        <textarea
          id="jsonImportBox"
          rows={3}
          placeholder='[{"date":"2026-08-20","workerName":"Mario Rossi","startTime":"08:00","endTime":"17:00","totalHours":"8.00"}]'
          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={async () => {
            const el = document.getElementById("jsonImportBox") as HTMLTextAreaElement;
            if (!el || !el.value.trim()) {
              alert(lang === "ar" ? "الرجاء لصق البيانات أولاً" : "Incolla prima i dati JSON");
              return;
            }
            try {
              const res = await (await import("../utils/api")).importDataFromJson(el.value);
              if (res.success) {
                alert(res.message);
                el.value = "";
                onRefresh();
              } else {
                alert(res.message);
              }
            } catch (e: any) {
              alert("Errore: " + e.message);
            }
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all"
        >
          {lang === "ar" ? "📥 استيراد وحفظ في السحابة الآن" : "📥 Importa su Cloud Ora"}
        </button>
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
