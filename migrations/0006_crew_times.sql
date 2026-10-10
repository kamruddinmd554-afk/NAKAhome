alter table booking_workers add column if not exists arrived_at timestamptz;
alter table booking_workers add column if not exists started_at timestamptz;
