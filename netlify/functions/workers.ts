import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { workers } from "../../db/schema.js";
import { eq, asc } from "drizzle-orm";

export default async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      const idParam = url.searchParams.get("id");
      if (idParam) {
        const result = await db.select().from(workers).where(eq(workers.id, parseInt(idParam, 10)));
        if (result.length === 0) {
          return Response.json({ error: "Lavoratore non trovato" }, { status: 404 });
        }
        return Response.json(result[0]);
      }

      const allWorkers = await db
        .select()
        .from(workers)
        .orderBy(asc(workers.name));
      return Response.json(allWorkers);
    }

    if (method === "POST") {
      const body = await req.json();
      if (!body.name || !body.name.trim()) {
        return Response.json({ error: "Nome lavoratore obbligatorio" }, { status: 400 });
      }

      const rateNum = parseFloat(body.hourlyRate) || 15.0;

      const [inserted] = await db
        .insert(workers)
        .values({
          name: body.name.trim(),
          hourlyRate: rateNum.toFixed(2),
          role: body.role ? body.role.trim() : "Operaio",
          phone: body.phone ? body.phone.trim() : null,
        })
        .returning();

      return Response.json(inserted, { status: 201 });
    }

    if (method === "PUT") {
      const body = await req.json();
      if (!body.id) {
        return Response.json({ error: "ID obbligatorio" }, { status: 400 });
      }

      const updateData: Record<string, any> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.hourlyRate !== undefined) {
        const rateNum = parseFloat(body.hourlyRate) || 15.0;
        updateData.hourlyRate = rateNum.toFixed(2);
      }
      if (body.role !== undefined) updateData.role = body.role.trim();
      if (body.phone !== undefined) updateData.phone = body.phone ? body.phone.trim() : null;

      const [updated] = await db
        .update(workers)
        .set(updateData)
        .where(eq(workers.id, Number(body.id)))
        .returning();

      return Response.json(updated);
    }

    if (method === "DELETE") {
      const idParam = url.searchParams.get("id");
      if (!idParam) {
        return Response.json({ error: "ID obbligatorio" }, { status: 400 });
      }

      await db.delete(workers).where(eq(workers.id, parseInt(idParam, 10)));
      return Response.json({ success: true, message: "Lavoratore eliminato con successo" });
    }

    return Response.json({ error: "Metodo non consentito" }, { status: 405 });
  } catch (err: any) {
    console.error("Database error in workers function:", err);
    return Response.json({ error: err.message || "Errore interno del server" }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/workers",
};
