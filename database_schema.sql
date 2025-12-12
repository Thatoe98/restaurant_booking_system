-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_log (
  id bigint NOT NULL DEFAULT nextval('audit_log_id_seq'::regclass),
  table_id bigint,
  booking_id uuid,
  action_type character varying NOT NULL,
  action_by character varying NOT NULL,
  notes text,
  previous_status character varying,
  new_status character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id),
  CONSTRAINT audit_log_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_code character varying NOT NULL UNIQUE,
  table_id bigint,
  customer_name character varying NOT NULL,
  customer_email character varying NOT NULL,
  customer_phone character varying NOT NULL,
  booking_date date NOT NULL,
  booking_time time without time zone NOT NULL,
  duration_minutes integer DEFAULT 120,
  party_size integer NOT NULL CHECK (party_size >= 1),
  special_requests text,
  status USER-DEFINED DEFAULT 'pending'::booking_status,
  created_at timestamp with time zone DEFAULT now(),
  checked_in_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id)
);
CREATE TABLE public.tables (
  id bigint NOT NULL DEFAULT nextval('tables_id_seq'::regclass),
  table_number character varying NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 1 AND capacity <= 20),
  properties ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tables_pkey PRIMARY KEY (id)
);