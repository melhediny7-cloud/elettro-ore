CREATE TABLE "workers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"hourly_rate" numeric(7,2) DEFAULT '15.00' NOT NULL,
	"role" text DEFAULT 'Operaio',
	"phone" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "work_logs" ADD COLUMN "worker_id" integer;--> statement-breakpoint
ALTER TABLE "work_logs" ADD COLUMN "worker_name" text DEFAULT 'Mario Rossi' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_logs" ADD COLUMN "hourly_rate" numeric(7,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "work_logs" ADD COLUMN "total_pay" numeric(9,2) DEFAULT '0.00';