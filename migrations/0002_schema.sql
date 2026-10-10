create table if not exists profiles (
  user_id text primary key,
  name text not null default '',
  phone text not null default '',
  email text,
  locale text not null default 'en',
  active_mode text not null default 'customer',
  location_label text not null default '',
  lat double precision,
  lng double precision,
  is_admin boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id text primary key,
  name text not null,
  hindi text not null default '',
  sort_order integer not null default 0
);

create table if not exists skills (
  id text primary key,
  category_id text not null references categories(id),
  name text not null,
  hindi text not null default '',
  default_rate integer not null default 250,
  sort_order integer not null default 0
);

create table if not exists workers (
  user_id text primary key references profiles(user_id),
  about text not null default '',
  experience_years integer not null default 0,
  location_label text not null default '',
  lat double precision,
  lng double precision,
  radius_km integer not null default 10,
  available boolean not null default false,
  photo_data text,
  verification_status text not null default 'unverified',
  id_verification_status text not null default 'unverified',
  rate_amount integer not null default 250,
  rate_type text not null default 'day',
  completed_jobs integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  approved boolean not null default true,
  suspended boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists worker_skills (
  user_id text not null references workers(user_id) on delete cascade,
  skill_id text not null references skills(id),
  primary key (user_id, skill_id)
);

create table if not exists bookings (
  id text primary key,
  customer_id text not null references profiles(user_id),
  worker_id text references workers(user_id),
  skill_id text not null references skills(id),
  description text not null default '',
  address text not null default '',
  lat double precision,
  lng double precision,
  work_date text not null default '',
  start_time text not null default '',
  duration_hours integer not null default 8,
  crew_size integer not null default 1,
  rate_amount integer not null default 0,
  rate_type text not null default 'day',
  fee integer not null default 0,
  total integer not null default 0,
  payment_method text not null default 'cash',
  payment_status text not null default 'due',
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_customer_idx on bookings (customer_id, created_at desc);
create index if not exists bookings_worker_idx on bookings (worker_id, created_at desc);
create index if not exists bookings_status_idx on bookings (status);

create table if not exists booking_declines (
  booking_id text not null references bookings(id) on delete cascade,
  worker_id text not null,
  primary key (booking_id, worker_id)
);

create table if not exists threads (
  id text primary key,
  customer_id text not null,
  worker_id text not null,
  booking_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists threads_pair_idx on threads (customer_id, worker_id);

create table if not exists messages (
  id text primary key,
  thread_id text not null references threads(id) on delete cascade,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on messages (thread_id, created_at);

create table if not exists ratings (
  id text primary key,
  booking_id text not null references bookings(id),
  from_user_id text not null,
  to_user_id text not null,
  stars integer not null,
  review text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists ratings_unique_idx on ratings (booking_id, from_user_id);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  type text not null,
  title text not null,
  body text not null default '',
  booking_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists reports (
  id text primary key,
  reporter_id text not null,
  target_user_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists blocks (
  user_id text not null,
  blocked_user_id text not null,
  primary key (user_id, blocked_user_id)
);

create table if not exists saved_workers (
  customer_id text not null,
  worker_id text not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, worker_id)
);

create table if not exists payments (
  id text primary key,
  booking_id text not null references bookings(id),
  amount integer not null,
  method text not null,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
