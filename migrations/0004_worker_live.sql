alter table workers add column if not exists gender text not null default '';
alter table workers add column if not exists date_of_birth text not null default '';
alter table workers add column if not exists age_years integer not null default 0;
alter table workers add column if not exists village text not null default '';
alter table workers add column if not exists city_area text not null default '';
alter table workers add column if not exists overtime_rate integer not null default 0;
alter table workers add column if not exists insurance_status text not null default 'none';
alter table workers add column if not exists insurance_note text not null default '';
alter table workers add column if not exists availability_note text not null default '';

alter table worker_skills add column if not exists rate_amount integer;

create table if not exists booking_live_locations (
  booking_id text primary key references bookings(id) on delete cascade,
  worker_id text not null,
  lat double precision,
  lng double precision,
  sharing boolean not null default false,
  permission text not null default 'unknown',
  last_seen_at timestamptz not null default now()
);
create index if not exists booking_live_worker_idx on booking_live_locations (worker_id);
