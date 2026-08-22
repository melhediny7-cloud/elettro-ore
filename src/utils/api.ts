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
// WORKERS API & Local Storage
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
    const res = await fetch("/api/workers");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        saveLocalWorkers(data);
        return data;
      }
    }
  } catch (e) {
    console.warn("Could not fetch workers from server API, falling back to local storage", e);
  }
  return getLocalWorkers();
}

export async function createWorker(worker: Omit<WorkerProfile, "id">): Promise<WorkerProfile> {
  try {
    const res = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(worker),
    });
    if (res.ok) {
      const created = await res.json();
      const local = getLocalWorkers();
      saveLocalWorkers([...local, created]);
      return created;
    }
  } catch (e) {
    console.warn("API createWorker failed, using local storage", e);
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
    const res = await fetch("/api/workers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(worker),
    });
    if (res.ok) {
      const updated = await res.json();
      const local = getLocalWorkers();
      saveLocalWorkers(local.map((w) => (w.id === updated.id ? updated : w)));
      return updated;
    }
  } catch (e) {
    console.warn("API updateWorker failed, using local storage", e);
  }

  const local = getLocalWorkers();
  saveLocalWorkers(local.map((w) => (w.id === worker.id ? worker : w)));
  return worker;
}

export async function deleteWorker(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/workers?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      const local = getLocalWorkers();
      saveLocalWorkers(local.filter((w) => w.id !== id));
      return true;
    }
  } catch (e) {
    console.warn("API deleteWorker failed, using local storage", e);
  }

  const local = getLocalWorkers();
  saveLocalWorkers(local.filter((w) => w.id !== id));
  return true;
}

// -------------------------------------------------------------
// WORK LOGS API & Local Storage
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

export async function fetchWorkLogs(params?: {
  month?: string;
  workerId?: number;
  workerName?: string;
}): Promise<WorkLogEntry[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.append("month", params.month);
    if (params?.workerId) searchParams.append("workerId", String(params.workerId));
    if (params?.workerName) searchParams.append("workerName", params.workerName);

    const qs = searchParams.toString();
    const url = qs ? `/api/work-logs?${qs}` : "/api/work-logs";

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (!params || (!params.month && !params.workerId && !params.workerName)) {
          saveLocalLogs(data);
        }
        return data;
      }
    }
  } catch (e) {
    console.warn("Could not fetch from server API, falling back to local storage", e);
  }

  // Fallback to local storage
  let local = getLocalLogs();
  if (params?.month) {
    local = local.filter((l) => l.date && l.date.startsWith(params.month!));
  }
  if (params?.workerId) {
    local = local.filter((l) => l.workerId === params.workerId);
  } else if (params?.workerName && params.workerName !== "ALL") {
    local = local.filter((l) => l.workerName === params.workerName);
  }
  return local;
}

export async function createWorkLog(entry: Omit<WorkLogEntry, "id">): Promise<WorkLogEntry> {
  const netHours = entry.endTime
    ? calculateNetHours(entry.startTime, entry.endTime, entry.breakMinutes)
    : "0.00";
  const rate = entry.hourlyRate ? String(entry.hourlyRate) : "0.00";
  const pay = calculateTotalPay(netHours, rate);

  const calculatedEntry: Omit<WorkLogEntry, "id"> = {
    ...entry,
    workerName: entry.workerName || "Mario Rossi",
    totalHours: netHours,
    hourlyRate: rate,
    totalPay: pay,
  };

  try {
    const res = await fetch("/api/work-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calculatedEntry),
    });
    if (res.ok) {
      const created = await res.json();
      const local = getLocalLogs();
      saveLocalLogs([created, ...local.filter((l) => l.id !== created.id)]);
      return created;
    }
  } catch (e) {
    console.warn("API POST failed, using local storage", e);
  }

  // Local fallback
  const newLocal: WorkLogEntry = {
    ...calculatedEntry,
    id: Date.now(),
    createdAt: new Date().toISOString(),
  };
  const local = getLocalLogs();
  saveLocalLogs([newLocal, ...local]);
  return newLocal;
}

export async function updateWorkLog(entry: WorkLogEntry): Promise<WorkLogEntry> {
  const netHours = entry.endTime
    ? calculateNetHours(entry.startTime, entry.endTime, entry.breakMinutes)
    : entry.totalHours || "0.00";
  const rate = entry.hourlyRate ? String(entry.hourlyRate) : "0.00";
  const pay = calculateTotalPay(netHours, rate);

  const calculatedEntry: WorkLogEntry = {
    ...entry,
    totalHours: netHours,
    hourlyRate: rate,
    totalPay: pay,
  };

  try {
    const res = await fetch("/api/work-logs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calculatedEntry),
    });
    if (res.ok) {
      const updated = await res.json();
      const local = getLocalLogs();
      saveLocalLogs(local.map((l) => (l.id === updated.id ? updated : l)));
      return updated;
    }
  } catch (e) {
    console.warn("API PUT failed, using local storage", e);
  }

  // Local fallback
  const local = getLocalLogs();
  saveLocalLogs(local.map((l) => (l.id === calculatedEntry.id ? calculatedEntry : l)));
  return calculatedEntry;
}

export async function deleteWorkLog(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/work-logs?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      const local = getLocalLogs();
      saveLocalLogs(local.filter((l) => l.id !== id));
      return true;
    }
  } catch (e) {
    console.warn("API DELETE failed, updating local storage", e);
  }

  const local = getLocalLogs();
  saveLocalLogs(local.filter((l) => l.id !== id));
  return true;
}

export async function seedSampleData(): Promise<void> {
  try {
    const res = await fetch("/api/seed");
    if (res.ok) {
      const data = await res.json();
      if (data.workers) {
        saveLocalWorkers(data.workers);
      }
    }
  } catch (e) {
    console.warn("Seed API failed", e);
  }
}

export async function clearAllWorkLogs(): Promise<boolean> {
  try {
    const res = await fetch("/api/work-logs?all=true", { method: "DELETE" });
    saveLocalLogs([]);
    return res.ok;
  } catch (e) {
    console.warn("API clear all failed, clearing local storage", e);
    saveLocalLogs([]);
    return true;
  }
}

// -------------------------------------------------------------
// SECURE AUTH & ADMIN PIN VERIFICATION
// -------------------------------------------------------------

export async function verifyAdminPin(pin: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", pin }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Auth API unreachable, falling back to local verification", e);
  }

  // Fallback to local stored PIN
  const storedPin = (typeof window !== "undefined" && localStorage.getItem("oralavoro_adminPin")) || "1234";
  const isValid = pin && String(pin).trim() === storedPin.trim();
  return {
    success: isValid,
    message: isValid ? "Autenticato" : "PIN non corretto",
  };
}

export async function changeAdminPin(
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change", currentPin, newPin }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (typeof window !== "undefined") {
        localStorage.setItem("oralavoro_adminPin", newPin.trim());
      }
      return data;
    }
    return data;
  } catch (e) {
    console.warn("Auth API unreachable, changing local PIN", e);
  }

  // Fallback verification & change
  const storedPin = (typeof window !== "undefined" && localStorage.getItem("oralavoro_adminPin")) || "1234";
  if (currentPin.trim() !== storedPin.trim()) {
    return { success: false, message: "Il PIN attuale inserito non è corretto." };
  }

  if (!newPin || newPin.trim().length < 4) {
    return { success: false, message: "Il nuovo PIN deve contenere almeno 4 cifre." };
  }

  if (typeof window !== "undefined") {
    localStorage.setItem("oralavoro_adminPin", newPin.trim());
  }

  return { success: true, message: "PIN aggiornato con successo." };
}



