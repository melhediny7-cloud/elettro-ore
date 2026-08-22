import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { workLogs, workers } from "../../db/schema.js";

export default async (req: Request) => {
  try {
    // 1. Seed or get workers
    let existingWorkers = await db.select().from(workers);
    if (existingWorkers.length === 0) {
      existingWorkers = await db
        .insert(workers)
        .values([
          { name: "Mario Rossi", hourlyRate: "15.00", role: "Caposquadra", phone: "+39 340 1234567" },
          { name: "Mohamed Ali", hourlyRate: "16.50", role: "Tecnico Specializzato", phone: "+39 349 9876543" },
          { name: "Marco Bianchi", hourlyRate: "14.00", role: "Operaio Edile", phone: "+39 333 5551234" },
        ])
        .returning();
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');

    // 2. Generate sample logs for these workers
    const w1 = existingWorkers[0] || { id: 1, name: "Mario Rossi", hourlyRate: "15.00" };
    const w2 = existingWorkers[1] || { id: 2, name: "Mohamed Ali", hourlyRate: "16.50" };
    const w3 = existingWorkers[2] || { id: 3, name: "Marco Bianchi", hourlyRate: "14.00" };

    const sampleEntries = [
      {
        workerId: w1.id,
        workerName: w1.name,
        date: `${currentYear}-${currentMonth}-01`,
        startTime: "08:30",
        endTime: "17:30",
        breakMinutes: 60,
        totalHours: "8.00",
        hourlyRate: String(w1.hourlyRate),
        totalPay: (8.0 * parseFloat(String(w1.hourlyRate))).toFixed(2),
        workType: "Ordinario",
        locationName: "Ufficio Sede - Milano",
        address: "Via Dante 14, 20121 Milano MI, Italia",
        latitude: "45.4668",
        longitude: "9.1860",
        notes: "Lavori di manutenzione e coordinamento cantiere",
        isClockedIn: 0,
      },
      {
        workerId: w2.id,
        workerName: w2.name,
        date: `${currentYear}-${currentMonth}-01`,
        startTime: "08:00",
        endTime: "17:00",
        breakMinutes: 60,
        totalHours: "8.00",
        hourlyRate: String(w2.hourlyRate),
        totalPay: (8.0 * parseFloat(String(w2.hourlyRate))).toFixed(2),
        workType: "Ordinario",
        locationName: "Cantiere Roma Centro",
        address: "Via del Corso 100, 00186 Roma RM, Italia",
        latitude: "41.9058",
        longitude: "12.4786",
        notes: "Installazione impianti elettrici e collaudo",
        isClockedIn: 0,
      },
      {
        workerId: w1.id,
        workerName: w1.name,
        date: `${currentYear}-${currentMonth}-02`,
        startTime: "08:30",
        endTime: "18:00",
        breakMinutes: 60,
        totalHours: "8.50",
        hourlyRate: String(w1.hourlyRate),
        totalPay: (8.5 * parseFloat(String(w1.hourlyRate))).toFixed(2),
        workType: "Straordinario",
        locationName: "Cantiere San Siro",
        address: "Piazzale Angelo Moratti, Milano, Italia",
        latitude: "45.4780",
        longitude: "9.1239",
        notes: "Completamento intonaci e messa in sicurezza",
        isClockedIn: 0,
      },
      {
        workerId: w3.id,
        workerName: w3.name,
        date: `${currentYear}-${currentMonth}-02`,
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
        totalHours: "8.00",
        hourlyRate: String(w3.hourlyRate),
        totalPay: (8.0 * parseFloat(String(w3.hourlyRate))).toFixed(2),
        workType: "Ordinario",
        locationName: "Sede Torino",
        address: "Via Roma 45, 10121 Torino TO, Italia",
        latitude: "45.0678",
        longitude: "7.6824",
        notes: "Scarico materiali e rifiniture",
        isClockedIn: 0,
      },
    ];

    const inserted = await db.insert(workLogs).values(sampleEntries).returning();
    return Response.json({
      message: "Dati iniziali e lavoratori inseriti con successo",
      workers: existingWorkers,
      records: inserted,
    });
  } catch (err: any) {
    console.error("Error seeding sample data:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/seed",
};
