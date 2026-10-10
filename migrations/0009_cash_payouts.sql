alter table booking_workers add column if not exists rejected_at timestamptz;

alter table booking_live_tracks add column if not exists accuracy double precision;

alter table payments add column if not exists collected_at timestamptz;
alter table payments add column if not exists collected_by text;
alter table payments add column if not exists cash_amount integer not null default 0;

update payments set cash_amount = amount where cash_amount = 0 and amount > 0;
update payments set method = 'cash' where method is null or method = '' or method in ('upi', 'online', 'card', 'razorpay');

create table if not exists worker_payouts (
  id text primary key,
  booking_id text not null references bookings(id) on delete cascade,
  worker_id text not null,
  amount integer not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  paid_by text,
  note text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists worker_payouts_pair_idx on worker_payouts (booking_id, worker_id);
create index if not exists worker_payouts_worker_idx on worker_payouts (worker_id, status);
