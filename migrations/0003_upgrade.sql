alter table bookings add column if not exists cancel_reason text not null default '';
alter table bookings add column if not exists cancelled_by text;

alter table profiles add column if not exists emergency_name text not null default '';
alter table profiles add column if not exists emergency_phone text not null default '';
alter table profiles add column if not exists phone_verified boolean not null default false;

create unique index if not exists profiles_phone_uq on profiles (phone) where phone <> '';

create table if not exists worker_photos (
  id text primary key,
  worker_id text not null references workers(user_id) on delete cascade,
  data_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists worker_documents (
  id text primary key,
  worker_id text not null references workers(user_id) on delete cascade,
  kind text not null default 'id',
  data_url text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists phone_pins (
  phone text primary key,
  fail_count integer not null default 0,
  locked_until timestamptz
);
