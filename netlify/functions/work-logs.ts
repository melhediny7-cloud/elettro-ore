import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { workLogs } from "../../db/schema.js";
import { eq, desc, like, and } from "drizzle-orm";

export default async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      const monthParam = url.searchParams.get("month"); // e.g. "2026-08"
      const dateParam = url.searchParams.get("date");   // e.g. "2026-08-06"
      const workerIdParam = url.searchParams.get("workerId");
      const workerNameParam = url.searchParams.get("workerName");
      const idParam = url.searchParams.get("id");

      if (idParam) {
        const result = await db.select().from(workLogs).where(eq(workLogs.id, parseInt(idParam, 10)));
        if (result.length === 0) {
          return Response.json({ error: "Record non trovato" }, { status: 404 });
        }
        return Response.json(result[0]);
      }

      // Build conditions
      const conditions = [];
      if (monthParam) {
        conditions.push(like(workLogs.date, `${monthParam}%`));
      }
      if (dateParam) {
        conditions.push(eq(workLogs.date, dateParam));
      }
      if (workerIdParam) {
        conditions.push(eq(workLogs.workerId, parseInt(workerIdParam, 10)));
      } else if (workerNameParam) {
        conditions.push(eq(workLogs.workerName, workerNameParam));
      }

      let query = db.select().from(workLogs);
      if (conditions.length > 0) {
        // @ts-ignore
        query = query.where(and(...conditions));
      }

      const logs = await query.orderBy(desc(workLogs.date), desc(workLogs.startTime)).limit(500);
      return Response.json(logs);
    }

    if (method === "POST") {
      const body = await req.json();

      // Calculate total hours if endTime is provided
      let totalHoursStr = body.totalHours || "0.00";
      if (body.startTime && body.endTime) {
        totalHoursStr = calculateHours(body.startTime, body.endTime, body.breakMinutes || 0);
      }

      const rateNum = parseFloat(body.hourlyRate) || 0;
      const totalHoursNum = parseFloat(totalHoursStr) || 0;
      const totalPayStr = (rateNum * totalHoursNum).toFixed(2);

      const [inserted] = await db
        .insert(workLogs)
        .values({
          workerId: body.workerId ? Number(body.workerId) : null,
          workerName: body.workerName ? String(body.workerName).trim() : "Mario Rossi",
          date: body.date,
          startTime: body.startTime,
          endTime: body.endTime || null,
          breakMinutes: Number(body.breakMinutes || 0),
          totalHours: totalHoursStr,
          workType: body.workType || "Ordinario",
          locationName: body.locationName || "Ufficio",
          address: body.address || null,
          latitude: body.latitude ? String(body.latitude) : null,
          longitude: body.longitude ? String(body.longitude) : null,
          notes: body.notes || null,
          isClockedIn: body.isClockedIn !== undefined ? Number(body.isClockedIn) : (body.endTime ? 0 : 1),
          hourlyRate: String(rateNum.toFixed(2)),
          totalPay: totalPayStr,
        })
        .returning();

      return Response.json(inserted, { status: 201 });
    }

    if (method === "PUT") {
      const body = await req.json();
      if (!body.id) {
        return Response.json({ error: "ID obbligatorio per l'aggiornamento" }, { status: 400 });
      }

      let totalHoursStr = body.totalHours;
      if (body.startTime && body.endTime) {
        totalHoursStr = calculateHours(body.startTime, body.endTime, body.breakMinutes || 0);
      }

      const rateNum = parseFloat(body.hourlyRate) || 0;
      const totalHoursNum = parseFloat(totalHoursStr) || 0;
      const totalPayStr = (rateNum * totalHoursNum).toFixed(2);

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (body.workerId !== undefined) updateData.workerId = body.workerId ? Number(body.workerId) : null;
      if (body.workerName !== undefined) updateData.workerName = String(body.workerName).trim();
      if (body.date !== undefined) updateData.date = body.date;
      if (body.startTime !== undefined) updateData.startTime = body.startTime;
      if (body.endTime !== undefined) updateData.endTime = body.endTime;
      if (body.breakMinutes !== undefined) updateData.breakMinutes = Number(body.breakMinutes);
      if (totalHoursStr !== undefined) updateData.totalHours = totalHoursStr;
      if (body.workType !== undefined) updateData.workType = body.workType;
      if (body.locationName !== undefined) updateData.locationName = body.locationName;
      if (body.address !== undefined) updateData.address = body.address;
      if (body.latitude !== undefined) updateData.latitude = String(body.latitude);
      if (body.longitude !== undefined) updateData.longitude = String(body.longitude);
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.isClockedIn !== undefined) updateData.isClockedIn = Number(body.isClockedIn);
      if (body.hourlyRate !== undefined) updateData.hourlyRate = String(rateNum.toFixed(2));
      updateData.totalPay = totalPayStr;

      const [updated] = await db
        .update(workLogs)
        .set(updateData)
        .where(eq(workLogs.id, Number(body.id)))
        .returning();

      return Response.json(updated);
    }

    if (method === "DELETE") {
      const idParam = url.searchParams.get("id");
      const allParam = url.searchParams.get("all");

      if (allParam === "true") {
        await db.delete(workLogs);
        return Response.json({ success: true, message: "Tutti i record eliminati con successo" });
      }

      if (!idParam) {
        return Response.json({ error: "ID obbligatorio per l'eliminazione" }, { status: 400 });
      }

      await db.delete(workLogs).where(eq(workLogs.id, parseInt(idParam, 10)));
      return Response.json({ success: true, message: "Record eliminato con successo" });
    }

    return Response.json({ error: "Metodo non consentito" }, { status: 405 });
  } catch (err: any) {
    console.error("Database error in work-logs function:", err);
    return Response.json({ error: err.message || "Errore interno del server" }, { status: 500 });
  }
};

function calculateHours(startTime: string, endTime: string, breakMinutes: number): string {
  try {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    let startTotalM = startH * 60 + startM;
    let endTotalM = endH * 60 + endM;

    // Handle overnight shifts (e.g. 22:00 to 06:00)
    if (endTotalM < startTotalM) {
      endTotalM += 24 * 60;
    }

    const netMinutes = Math.max(0, endTotalM - startTotalM - breakMinutes);
    const hours = netMinutes / 60;
    return hours.toFixed(2);
  } catch {
    return "0.00";
  }
}

export const config: Config = {
  path: "/api/work-logs",
};
