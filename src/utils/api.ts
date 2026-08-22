export interface WorkerProfile {
  id: number;
  name: string;
  hourlyRate: string; // e.g. "15.00"
  role?: string; // e.g. "Operaio", "Caposquadra", "Tecnico"
  phone?: string | null;
  createdAt?: string;
}

export interface WorkLogEntry {
  id?: number;
  workerId?: number | null;
  workerName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string | null; // HH:mm
  breakMinutes: number;
  totalHours: string; // e.g. "8.00"
  hourlyRate?: string | number | null; // e.g. "15.00"
  totalPay?: string | null; // e.g. "120.00"
  workType: string; // "Ordinario", "Straordinario", "Smart Working", "Trasferta", "Ferie", "Permesso"
  locationName: string;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
  isClockedIn?: number; // 1 or 0
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  id: string;
  companyName: string;
  defaultLocation: string;
  adminPin: string;
}

const SUPABASE_URL = "https://kniadyyibpwszuwsslcn.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_YH7K73ymmcvScGJ_D6JKEQ_yPpWdlXz";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const LOCAL_STORAGE_LOGS_KEY = "oralavoro_work_logs_v1";
const LOCAL_STORAGE_WORKERS_KEY = "oralavoro_workers_v1";

export const DEFAULT_WORKERS: WorkerProfile[] = [
  { id: 1, name: "Mario Rossi", hourlyRate: "15.00", role: "Caposquadra", phone: "+39 340 1234567" },
  { id: 2, name: "Mohamed Ali", hourlyRate: "16.50", role: "Tecnico Specializzato", phone: "+39 349 9876543" },
  { id: 3, name: "Marco Bianchi", hourlyRate: "14.00", role: "Operaio Edile", phone: "+39 333 5551234" },
];

// Helper to calculate hours between HH:mm start and HH:mm end
export function calculateNetHours(startTime: string, endTime: string, breakMinutes: number = 0): string {
  try {
    if (!startTime || !endTime) return "0.00";
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    let startTotalM = startH * 60 + startM;
    let endTotalM = endH * 60 + endM;

    if (endTotalM < startTotalM) {
      endTotalM += 24 * 60; // Overnight shift
    }

    const netM = Math.max(0, endTotalM - startTotalM - breakMinutes);
    return (netM / 60).toFixed(2);
  } catch {
    return "0.00";
  }
}

export function calculateTotalPay(hoursStr: string, rateStrOrNum: string | number): string {
  try {
    const hours = parseFloat(hoursStr) || 0;
    const rate = typeof rateStrOrNum === "number" ? rateStrOrNum : parseFloat(rateStrOrNum) || 0;
    return (hours * rate).toFixed(2);
  } catch {
    return "0.00";
  }
}

// -------------------------------------------------------------
// WORKERS API (Supabase Cloud + LocalStorage Fallback)
// -------------------------------------------------------------

export function getLocalWorkers(): WorkerProfile[] {
  if (typeof window === "undefined") return DEFAULT_WORKERS;
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_WORKERS_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_WORKERS_KEY, JSON.stringify(DEFAULT_WORKERS));
      return DEFAULT_WORKERS;
    }
    return JSON.parse(data);
  } catch {
    return DEFAULT_WORKERS;
  }
}

export function saveLocalWorkers(workers: WorkerProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_WORKERS_KEY, JSON.stringify(workers));
  } catch (e) {
    console.error("Error saving local workers", e);
  }
}

export async function fetchWorkers(): Promise<WorkerProfile[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/workers?select=*&order=name.asc`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: WorkerProfile[] = data.map((w: any) => ({
          id: w.id,
          name: w.name,
          hourlyRate: String(w.hourly_rate || "15.00"),
          role: w.role || "Operaio",
          phone: w.phone || null,
          createdAt: w.created_at,
        }));
        saveLocalWorkers(mapped);
        return mapped;
      } else if (Array.isArray(data) && data.length === 0) {
        // Seed default workers to Supabase if table is empty
        for (const dw of DEFAULT_WORKERS) {
          await createWorker({ name: dw.name, hourlyRate: dw.hourlyRate, role: dw.role, phone: dw.phone });
        }
        return fetchWorkers();
      }
    }
  } catch (e) {
    console.warn("Could not fetch workers from Supabase, falling back to local storage", e);
  }
  return getLocalWorkers();
}

export async function createWorker(worker: Omit<WorkerProfile, "id">): Promise<WorkerProfile> {
  try {
    const res = await fetch(`${SUPABASE_URL}/workers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: worker.name.trim(),
        hourly_rate: parseFloat(worker.hourlyRate) || 15.0,
        role: worker.role || "Operaio",
        phone: worker.phone || null,
      }),
    });
    if (res.ok) {
      const result = await res.json();
      const created = Array.isArray(result) ? result[0] : result;
      const mapped: WorkerProfile = {
        id: created.id,
        name: created.name,
        hourlyRate: String(created.hourly_rate || "15.00"),
        role: created.role || "Operaio",
        phone: created.phone || null,
        createdAt: created.created_at,
      };
      const local = getLocalWorkers();
      saveLocalWorkers([...local.filter((w) => w.id !== mapped.id), mapped]);
      return mapped;
    }
  } catch (e) {
    console.warn("Supabase createWorker failed, using local storage", e);
  }

  const newLocal: WorkerProfile = {
    ...worker,
    id: Date.now(),
    createdAt: new Date().toISOString(),
  };
  const local = getLocalWorkers();
  saveLocalWorkers([...local, newLocal]);
  return newLocal;
}

export async function updateWorker(worker: WorkerProfile): Promise<WorkerProfile> {
  try {
    const res = await fetch(`${SUPABASE_URL}/workers?id=eq.${worker.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: worker.name.trim(),
        hourly_rate: parseFloat(worker.hourlyRate) || 15.0,
        role: worker.role || "Operaio",
        phone: worker.phone || null,
      }),
    });
    if (res.ok) {
      const result = await res.json();
      const updated = Array.isArray(result) && result[0] ? result[0] : worker;
      const mapped: WorkerProfile = {
        id: updated.id,
        name: updated.name,
        hourlyRate: String(updated.hourly_rate || worker.hourlyRate),
        role: updated.role || worker.role,
        phone: updated.phone || worker.phone,
        createdAt: updated.created_at,
      };
      const local = getLocalWorkers();
      saveLocalWorkers(local.map((w) => (w.id === mapped.id ? mapped : w)));
      return mapped;
    }
  } catch (e) {
    console.warn("Supabase updateWorker failed, using local storage", e);
  }

  const local = getLocalWorkers();
  saveLocalWorkers(local.map((w) => (w.id === worker.id ? worker : w)));
  return worker;
}

export async function deleteWorker(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/workers?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      const local = getLocalWorkers();
      saveLocalWorkers(local.filter((w) => w.id !== id));
      return true;
    }
  } catch (e) {
    console.warn("Supabase deleteWorker failed, using local storage", e);
  }

  const local = getLocalWorkers();
  saveLocalWorkers(local.filter((w) => w.id !== id));
  return true;
}

// -------------------------------------------------------------
// WORK LOGS API (Supabase Cloud + LocalStorage Fallback)
// -------------------------------------------------------------

export function getLocalLogs(): WorkLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalLogs(logs: WorkLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Error saving local logs", e);
  }
}

function mapSupabaseLogToApp(log: any): WorkLogEntry {
  return {
    id: log.id,
    workerId: log.worker_id,
    workerName: log.worker_name,
    date: log.date,
    startTime: log.start_time,
    endTime: log.end_time || null,
    breakMinutes: log.break_minutes || 0,
    totalHours: String(log.total_hours || "0.00"),
    hourlyRate: String(log.hourly_rate || "0.00"),
    totalPay: String(log.total_pay || "0.00"),
    workType: log.work_type || "Ordinario",
    locationName: log.location_name || "Ufficio",
    address: log.address || null,
    latitude: log.latitude || null,
    longitude: log.longitude || null,
    notes: log.notes || null,
    isClockedIn: log.is_clocked_in || 0,
    createdAt: log.created_at,
    updatedAt: log.updated_at,
  };
}

function mapAppLogToSupabase(log: Partial<WorkLogEntry>): any {
  const result: any = {};
  if (log.workerId !== undefined) result.worker_id = log.workerId;
  if (log.workerName !== undefined) result.worker_name = log.workerName;
  if (log.date !== undefined) result.date = log.date;
  if (log.startTime !== undefined) result.start_time = log.startTime;
  if (log.endTime !== undefined) result.end_time = log.endTime;
  if (log.breakMinutes !== undefined) result.break_minutes = log.breakMinutes;
  if (log.totalHours !== undefined) result.total_hours = parseFloat(String(log.totalHours)) || 0;
  if (log.hourlyRate !== undefined) result.hourly_rate = parseFloat(String(log.hourlyRate)) || 0;
  if (log.totalPay !== undefined) result.total_pay = parseFloat(String(log.totalPay)) || 0;
  if (log.workType !== undefined) result.work_type = log.workType;
  if (log.locationName !== undefined) result.location_name = log.locationName;
  if (log.address !== undefined) result.address = log.address;
  if (log.latitude !== undefined) result.latitude = log.latitude;
  if (log.longitude !== undefined) result.longitude = log.longitude;
  if (log.notes !== undefined) result.notes = log.notes;
  if (log.isClockedIn !== undefined) result.is_clocked_in = log.isClockedIn;
  result.updated_at = new Date().toISOString();
  return result;
}

export async function fetchWorkLogs(params?: { month?: string; year?: string; date?: string; workerId?: number }): Promise<WorkLogEntry[]> {
  try {
    let queryUrl = `${SUPABASE_URL}/work_logs?select=*&order=date.desc,start_time.desc`;
    if (params?.date) queryUrl += `&date=eq.${params.date}`;
    if (params?.workerId) queryUrl += `&worker_id=eq.${params.workerId}`;

    const res = await fetch(queryUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        let mapped = data.map(mapSupabaseLogToApp);
        if (params?.month && params?.year) {
          const prefix = `${params.year}-${params.month.padStart(2, "0")}`;
          mapped = mapped.filter((item) => item.date.startsWith(prefix));
        }
        saveLocalLogs(mapped);
        return mapped;
      }
    }
  } catch (e) {
    console.warn("Could not fetch logs from Supabase, using local fallback", e);
  }

  let logs = getLocalLogs();
  if (params?.month && params?.year) {
    const prefix = `${params.year}-${params.month.padStart(2, "0")}`;
    logs = logs.filter((item) => item.date.startsWith(prefix));
  }
  if (params?.date) {
    logs = logs.filter((item) => item.date === params.date);
  }
  if (params?.workerId) {
    logs = logs.filter((item) => item.workerId === params.workerId);
  }
  return logs;
}

export async function createWorkLog(log: Omit<WorkLogEntry, "id" | "createdAt" | "updatedAt">): Promise<WorkLogEntry> {
  const supabasePayload = mapAppLogToSupabase(log);

  try {
    const res = await fetch(`${SUPABASE_URL}/work_logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(supabasePayload),
    });
    if (res.ok) {
      const result = await res.json();
      const created = Array.isArray(result) ? result[0] : result;
      const mapped = mapSupabaseLogToApp(created);
      const local = getLocalLogs();
      saveLocalLogs([mapped, ...local.filter((l) => l.id !== mapped.id)]);
      return mapped;
    }
  } catch (e) {
    console.warn("Supabase createWorkLog failed, saving locally", e);
  }

  const newLog: WorkLogEntry = {
    ...log,
    id: Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const local = getLocalLogs();
  saveLocalLogs([newLog, ...local]);
  return newLog;
}

export async function updateWorkLog(log: WorkLogEntry): Promise<WorkLogEntry> {
  if (!log.id) throw new Error("ID log mancante per l'aggiornamento");

  const supabasePayload = mapAppLogToSupabase(log);

  try {
    const res = await fetch(`${SUPABASE_URL}/work_logs?id=eq.${log.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(supabasePayload),
    });
    if (res.ok) {
      const result = await res.json();
      const updated = Array.isArray(result) && result[0] ? result[0] : log;
      const mapped = mapSupabaseLogToApp(updated);
      const local = getLocalLogs();
      saveLocalLogs(local.map((item) => (item.id === mapped.id ? mapped : item)));
      return mapped;
    }
  } catch (e) {
    console.warn("Supabase updateWorkLog failed, saving locally", e);
  }

  const local = getLocalLogs();
  saveLocalLogs(local.map((item) => (item.id === log.id ? { ...log, updatedAt: new Date().toISOString() } : item)));
  return log;
}

export async function deleteWorkLog(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/work_logs?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      const local = getLocalLogs();
      saveLocalLogs(local.filter((item) => item.id !== id));
      return true;
    }
  } catch (e) {
    console.warn("Supabase deleteWorkLog failed, saving locally", e);
  }

  const local = getLocalLogs();
  saveLocalLogs(local.filter((item) => item.id !== id));
  return true;
}

export async function clearAllWorkLogs(): Promise<boolean> {
  try {
    await fetch(`${SUPABASE_URL}/work_logs?id=gt.0`, {
      method: "DELETE",
      headers,
    });
  } catch (e) {
    console.warn("Failed to clear Supabase work_logs", e);
  }

  saveLocalLogs([]);
  return true;
}

export async function seedSampleData(): Promise<{ success: boolean; count: number }> {
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const monthStr = String(currentMonthNum).padStart(2, "0");

  const workersList = await fetchWorkers();
  const sampleLogs: any[] = [];

  const locations = [
    { name: "Cantiere Residenziale - Milano", addr: "Via Dante 12, Milano" },
    { name: "Impianto Industriale - Monza", addr: "Viale Brianza 45, Monza" },
    { name: "Sede Azienda - Ufficio", addr: "Via Roma 100, Sesto San Giovanni" },
    { name: "Manutenzione Hotel - Como", addr: "Lungolago Trieste 8, Como" },
  ];

  const types = ["Ordinario", "Straordinario", "Trasferta"];

  for (let day = 1; day <= 22; day++) {
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getUTCDay();

    // Skip Sundays
    if (dayOfWeek === 0) continue;

    for (const w of workersList.slice(0, 3)) {
      const loc = locations[(day + w.id) % locations.length];
      const wType = types[(day + w.id) % types.length];
      const startH = 8;
      const endH = 17;
      const breakM = 60;
      const totalH = "8.00";
      const totalPay = calculateTotalPay(totalH, w.hourlyRate);

      sampleLogs.push({
        worker_id: w.id,
        worker_name: w.name,
        date: dateStr,
        start_time: "08:00",
        end_time: "17:00",
        break_minutes: breakM,
        total_hours: 8.0,
        hourly_rate: parseFloat(w.hourlyRate) || 15.0,
        total_pay: parseFloat(totalPay) || 120.0,
        work_type: wType,
        location_name: loc.name,
        address: loc.addr,
        latitude: "45.4642",
        longitude: "9.1900",
        notes: `Attività ordinaria eseguita da ${w.name}`,
        is_clocked_in: 0,
      });
    }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/work_logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(sampleLogs),
    });
    if (res.ok) {
      return { success: true, count: sampleLogs.length };
    }
  } catch (e) {
    console.error("Failed to seed Supabase", e);
  }

  return { success: true, count: sampleLogs.length };
}

// -------------------------------------------------------------
// APP SETTINGS & PIN AUTH (Supabase Cloud + Local Fallback)
// -------------------------------------------------------------

export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const res = await fetch(`${SUPABASE_URL}/app_settings?id=eq.general`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        return {
          id: data[0].id,
          companyName: data[0].company_name || "Azienda s.r.l.",
          defaultLocation: data[0].default_location || "Ufficio Sede - Milano",
          adminPin: data[0].admin_pin || "1234",
        };
      } else if (Array.isArray(data) && data.length === 0) {
        // Auto-create general row
        await fetch(`${SUPABASE_URL}/app_settings`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: "general",
            company_name: "Azienda s.r.l.",
            default_location: "Ufficio Sede - Milano",
            admin_pin: "1234",
          }),
        });
      }
    }
  } catch (e) {
    console.warn("Could not fetch app_settings from Supabase", e);
  }

  return {
    id: "general",
    companyName: typeof window !== "undefined" ? localStorage.getItem("oralavoro_company_name") || "Azienda s.r.l." : "Azienda s.r.l.",
    defaultLocation: typeof window !== "undefined" ? localStorage.getItem("oralavoro_default_location") || "Ufficio Sede - Milano" : "Ufficio Sede - Milano",
    adminPin: typeof window !== "undefined" ? localStorage.getItem("oralavoro_admin_pin") || "1234" : "1234",
  };
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<boolean> {
  try {
    const payload: any = { id: "general" };
    if (settings.companyName !== undefined) payload.company_name = settings.companyName;
    if (settings.defaultLocation !== undefined) payload.default_location = settings.defaultLocation;
    if (settings.adminPin !== undefined) payload.admin_pin = settings.adminPin;

    const res = await fetch(`${SUPABASE_URL}/app_settings`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
  } catch (e) {
    console.warn("Failed to update app_settings in Supabase", e);
  }
  return true;
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const settings = await fetchAppSettings();
    return settings.adminPin.trim() === String(pin).trim();
  } catch {
    const local = typeof window !== "undefined" ? localStorage.getItem("oralavoro_admin_pin") || "1234" : "1234";
    return local.trim() === String(pin).trim();
  }
}

export async function changeAdminPin(currentPin: string, newPin: string): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await fetchAppSettings();
    if (settings.adminPin.trim() !== String(currentPin).trim()) {
      return { success: false, message: "Il PIN attuale non è corretto." };
    }

    if (!newPin || String(newPin).trim().length < 4) {
      return { success: false, message: "Il nuovo PIN deve avere almeno 4 cifre." };
    }

    const updated = await updateAppSettings({ adminPin: String(newPin).trim() });
    if (typeof window !== "undefined") {
      localStorage.setItem("oralavoro_admin_pin", String(newPin).trim());
    }
    return { success: updated, message: "PIN aggiornato con successo su Cloud Database." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Errore durante l'aggiornamento del PIN." };
  }
}
