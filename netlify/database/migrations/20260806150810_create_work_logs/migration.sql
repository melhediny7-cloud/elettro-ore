CREATE TABLE "work_logs" (
	"id" serial PRIMARY KEY,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"total_hours" numeric(5,2) DEFAULT '0.00',
	"work_type" text DEFAULT 'Ordinario' NOT NULL,
	"location_name" text DEFAULT 'Ufficio' NOT NULL,
	"address" text,
	"latitude" text,
	"longitude" text,
	"notes" text,
	"is_clocked_in" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
