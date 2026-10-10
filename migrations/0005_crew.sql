alter table bookings add column if not exists unit_rate integer not null default 0;
alter table bookings add column if not exists worker_charge integer not null default 0;

update bookings set unit_rate = rate_amount where unit_rate = 0 and rate_amount > 0;
update bookings set worker_charge = greatest(total - fee, 0) where worker_charge = 0;

create table if not exists booking_workers (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  worker_id text,
  slot integer not null default 1,
  status text not null default 'pending',
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);
create index if not exists booking_workers_booking_idx on booking_workers (booking_id, slot);
create unique index if not exists booking_workers_pair_idx on booking_workers (booking_id, worker_id) where worker_id is not null;
create index if not exists booking_workers_worker_idx on booking_workers (worker_id, status);

insert into booking_workers (id, booking_id, worker_id, slot, status, assigned_at)
select 'bw_' || b.id, b.id, b.worker_id, 1,
  case
    when b.status = 'cancelled' then 'cancelled'
    when b.status = 'completed' then 'completed'
    when b.status = 'requested' then 'pending'
    else b.status
  end,
  b.created_at
from bookings b
where not exists (select 1 from booking_workers bw where bw.booking_id = b.id);

create table if not exists booking_live_tracks (
  booking_id text not null references bookings(id) on delete cascade,
  worker_id text not null,
  lat double precision,
  lng double precision,
  sharing boolean not null default false,
  permission text not null default 'unknown',
  last_seen_at timestamptz not null default now(),
  primary key (booking_id, worker_id)
);

insert into booking_live_tracks (booking_id, worker_id, lat, lng, sharing, permission, last_seen_at)
select booking_id, worker_id, lat, lng, sharing, permission, last_seen_at
from booking_live_locations
where worker_id is not null
on conflict do nothing;

alter table payments add column if not exists payment_id text;
alter table payments add column if not exists provider text not null default '';
alter table payments add column if not exists customer_id text;
alter table payments add column if not exists worker_id text;
alter table payments add column if not exists gross integer not null default 0;
alter table payments add column if not exists commission integer not null default 0;
alter table payments add column if not exists worker_payout integer not null default 0;
alter table payments add column if not exists payout_status text not null default 'unpaid';
