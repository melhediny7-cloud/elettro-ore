import { pgTable, serial, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 7, scale: 2 }).notNull().default("15.00"),
  role: text("role").default("Operaio"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workLogs = pgTable("work_logs", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id"),
  workerName: text("worker_name").notNull().default("Mario Rossi"),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:mm
  endTime: text("end_time"), // HH:mm (null if active clock-in)
  breakMinutes: integer("break_minutes").notNull().default(0),
  totalHours: numeric("total_hours", { precision: 5, scale: 2 }).default("0.00"),
  workType: text("work_type").notNull().default("Ordinario"),
  locationName: text("location_name").notNull().default("Ufficio"),
  address: text("address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  notes: text("notes"),
  isClockedIn: integer("is_clocked_in").default(0),
  hourlyRate: numeric("hourly_rate", { precision: 7, scale: 2 }).default("0.00"),
  totalPay: numeric("total_pay", { precision: 9, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Worker = typeof workers.$inferSelect;
export type NewWorker = typeof workers.$inferInsert;
export type WorkLog = typeof workLogs.$inferSelect;
export type NewWorkLog = typeof workLogs.$inferInsert;

