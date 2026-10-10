import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { CATALOG_CATEGORIES, CATALOG_SKILLS } from "@/lib/catalog";
import { ID_DOCUMENT_KINDS, isKycApproved, KYC_PENDING, KYC_PUBLIC_MESSAGE, KYC_REJECTED, KYC_UNVERIFIED, KYC_VERIFIED, normalizeKycWrite } from "@/lib/kyc";
import { quoteFromWorkerRate } from "@/lib/pricing";
import { getSql, type Sql } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import { digitsPhone, isValidInPhone, uid } from "@/lib/utils";

export type ProfileRow = {
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  locale: string;
  active_mode: string;
  location_label: string;
  lat: number | null;
  lng: number | null;
  is_admin: boolean;
  suspended: boolean;
  emergency_name?: string;
  emergency_phone?: string;
  phone_verified?: boolean;
  business_name?: string;
};

export type WorkerPublic = {
  userId: string;
  name: string;
  about: string;
  experienceYears: number;
  locationLabel: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  available: boolean;
  photoData: string | null;
  verificationStatus: string;
  idVerificationStatus: string;
  rateAmount: number;
  rateType: string;
  completedJobs: number;
  rating: number;
  ratingCount: number;
  skills: Array<{ id: string; name: string; rateAmount?: number | null }>;
  distanceKm: number | null;
};

export type CrewMember = {
  id: string;
  slot: number;
  workerId: string | null;
  name: string | null;
  photo: string | null;
  phone: string | null;
  skillName: string | null;
  status: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type LiveTrack = {
  workerId: string;
  name: string | null;
  photo: string | null;
  skillName: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  sharing: boolean;
  lastSeenAt: string | null;
  permission: string;
  stale: boolean;
  accuracy?: number | null;
};

export type BookingRow = {
  id: string;
  customer_id: string;
  worker_id: string | null;
  skill_id: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  work_date: string;
  start_time: string;
  duration_hours: number;
  crew_size: number;
  rate_amount: number;
  rate_type: string;
  fee: number;
  total: number;
  unit_rate?: number;
  worker_charge?: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  skill_name: string;
  customer_name: string;
  worker_name: string | null;
  customer_phone: string;
  worker_phone: string | null;
  cancel_reason?: string;
  cancelled_by?: string | null;
  worker_photo?: string | null;
  accepted_count?: number;
  pending_count?: number;
  my_status?: string | null;
  crew?: CrewMember[];
  liveTracks?: LiveTrack[];
};

async function ensureCatalog(sql: Sql) {
  const existing = await sql<{ n: number }>`select count(*)::int as n from skills`;
  if ((existing[0]?.n ?? 0) >= CATALOG_SKILLS.length) return;
  for (const c of CATALOG_CATEGORIES) {
    await sql`
      insert into categories (id, name, hindi, sort_order)
      values (${c.id}, ${c.name}, ${c.hindi}, ${c.sort})
      on conflict (id) do update set name = excluded.name, hindi = excluded.hindi, sort_order = excluded.sort_order
    `;
  }
  for (const s of CATALOG_SKILLS) {
    await sql`
      insert into skills (id, category_id, name, hindi, default_rate, sort_order)
      values (${s.id}, ${s.categoryId}, ${s.name}, ${s.hindi}, ${s.defaultRate}, ${s.sort})
      on conflict (id) do update set
        category_id = excluded.category_id,
        name = excluded.name,
        hindi = excluded.hindi,
        default_rate = excluded.default_rate,
        sort_order = excluded.sort_order
    `;
  }
}

async function ensureProfile(sql: Sql, userId: string) {
  const admins = await sql<{ n: number }>`select count(*)::int as n from profiles where is_admin = true`;
  const makeAdmin = (admins[0]?.n ?? 0) === 0;
  let name = "Member";
  let phone = "";
  try {
    const users = await sql<{ name: string | null; email: string | null }>`
      select name, email from "user" where id = ${userId}
    `;
    const u = users[0];
    if (u?.name) name = u.name;
    const email = u?.email ?? "";
    if (email.endsWith("@phone.inbook.app")) {
      const digits = email.split("@")[0] ?? "";
      if (/^[6-9]\d{9}$/.test(digits)) phone = digits;
    }
  } catch {
    /* auth user table may be unavailable in some preview boots */
  }
  await sql`
    insert into profiles (user_id, name, phone, is_admin)
    values (${userId}, ${name}, ${phone}, ${makeAdmin})
    on conflict (user_id) do nothing
  `;
  if (phone) {
    await sql`
      update profiles set phone = ${phone}
      where user_id = ${userId} and phone = ''
    `;
  }
}

async function notify(
  sql: Sql,
  userId: string,
  type: string,
  title: string,
  body: string,
  bookingId?: string,
) {
  await sql`
    insert into notifications (id, user_id, type, title, body, booking_id)
    values (${uid("nt")}, ${userId}, ${type}, ${title}, ${body}, ${bookingId ?? null})
  `;
}

function ratingOf(sum: number, count: number) {
  if (count <= 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}

const LIVE_ASSIGN = new Set(["accepted", "on_the_way", "arrived", "in_progress"]);

async function assertNotSuspended(sql: Sql, userId: string) {
  const rows = await sql<{ suspended: boolean }>`select suspended from profiles where user_id = ${userId}`;
  if (rows[0]?.suspended) throw new Error("This account is suspended. You cannot create new bookings.");
}

async function requireWorkerKyc(sql: Sql, workerId: string, message = KYC_PUBLIC_MESSAGE) {
  const rows = await sql<{ id_verification_status: string }>`
    select id_verification_status from workers where user_id = ${workerId}
  `;
  if (!isKycApproved(rows[0]?.id_verification_status)) {
    throw new Error(message);
  }
}

/** If a document exists but worker status lagged (upload error / old row), repair it. Never auto-approves. */
async function syncWorkerKycFromDocuments(sql: Sql, workerId: string) {
  const worker = await sql<{ id_verification_status: string }>`
    select id_verification_status from workers where user_id = ${workerId}
  `;
  if (!worker[0]) return null;
  if (isKycApproved(worker[0].id_verification_status)) return KYC_VERIFIED;
  const docs = await sql<{ status: string }>`
    select status from worker_documents where worker_id = ${workerId} order by created_at desc limit 8
  `;
  if (!docs.length) return worker[0].id_verification_status;
  if (docs.some((d) => isKycApproved(d.status))) {
    await sql`
      update workers
      set id_verification_status = ${KYC_VERIFIED}, verification_status = ${KYC_VERIFIED}, updated_at = now()
      where user_id = ${workerId}
    `;
    return KYC_VERIFIED;
  }
  if (docs.some((d) => d.status === KYC_PENDING)) {
    if (worker[0].id_verification_status !== KYC_PENDING) {
      await sql`
        update workers
        set id_verification_status = ${KYC_PENDING}, available = false, updated_at = now()
        where user_id = ${workerId}
      `;
    }
    return KYC_PENDING;
  }
  if (docs.some((d) => d.status === KYC_REJECTED)) {
    if (worker[0].id_verification_status !== KYC_REJECTED) {
      await sql`
        update workers
        set id_verification_status = ${KYC_REJECTED}, available = false, updated_at = now()
        where user_id = ${workerId}
      `;
    }
    return KYC_REJECTED;
  }
  return worker[0].id_verification_status;
}

async function workerUnitRate(sql: Sql, workerId: string, skillId: string) {
  const rows = await sql<{ rate_amount: number; skill_rate: number | null; rate_type: string; available: boolean; approved: boolean; suspended: boolean; id_verification_status: string }>`
    select w.rate_amount, w.rate_type, w.available, w.approved, w.suspended, w.id_verification_status, ws.rate_amount as skill_rate
    from workers w
    left join worker_skills ws on ws.user_id = w.user_id and ws.skill_id = ${skillId}
    where w.user_id = ${workerId}
  `;
  const w = rows[0];
  if (!w) throw new Error("Worker not found");
  if (!w.approved || w.suspended) throw new Error("Worker is not available");
  if (!isKycApproved(w.id_verification_status)) throw new Error("KYC verification required before this worker can be booked.");
  const skillRate = w.skill_rate != null && w.skill_rate > 0 ? w.skill_rate : 0;
  const rate = skillRate > 0 ? skillRate : w.rate_amount;
  if (!rate || rate <= 0) throw new Error("This worker has not set a rate for the selected work.");
  return { rate, rateType: w.rate_type || "day", available: w.available };
}

async function conflictingLive(sql: Sql, workerId: string, workDate: string, exceptBooking?: string) {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from booking_workers bw
    join bookings b on b.id = bw.booking_id
    where bw.worker_id = ${workerId}
      and bw.status in ('accepted', 'on_the_way', 'arrived', 'in_progress')
      and b.status in ('accepted', 'on_the_way', 'arrived', 'in_progress')
      and (${workDate} = '' or b.work_date = ${workDate})
      and (${exceptBooking ?? ""} = '' or b.id <> ${exceptBooking ?? ""})
  `;
  return (rows[0]?.n ?? 0) > 0;
}

async function loadCrew(sql: Sql, bookingId: string): Promise<CrewMember[]> {
  const rows = await sql<{
    id: string;
    slot: number;
    worker_id: string | null;
    status: string;
    accepted_at: string | null;
    arrived_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    name: string | null;
    photo: string | null;
    phone: string | null;
    skill_name: string | null;
  }>`
    select bw.id, bw.slot, bw.worker_id, bw.status, bw.accepted_at, bw.arrived_at, bw.started_at, bw.completed_at,
      p.name, w.photo_data as photo, p.phone, s.name as skill_name
    from booking_workers bw
    join bookings b on b.id = bw.booking_id
    join skills s on s.id = b.skill_id
    left join profiles p on p.user_id = bw.worker_id
    left join workers w on w.user_id = bw.worker_id
    where bw.booking_id = ${bookingId}
    order by bw.slot
  `;
  return rows.map((r) => ({
    id: r.id,
    slot: r.slot,
    workerId: r.worker_id,
    name: r.name,
    photo: r.photo,
    phone: r.phone,
    skillName: r.skill_name,
    status: r.status,
    acceptedAt: r.accepted_at,
    arrivedAt: r.arrived_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));
}

async function loadTracks(sql: Sql, bookingId: string, crew: CrewMember[]): Promise<LiveTrack[]> {
  const rows = await sql<{
    worker_id: string;
    lat: number | null;
    lng: number | null;
    sharing: boolean;
    permission: string;
    last_seen_at: string;
    accuracy: number | null;
  }>`select worker_id, lat, lng, sharing, permission, last_seen_at, accuracy from booking_live_tracks where booking_id = ${bookingId}`;
  const byId = new Map(rows.map((r) => [r.worker_id, r]));
  return crew
    .filter((c) => c.workerId && LIVE_ASSIGN.has(c.status))
    .map((c) => {
      const r = byId.get(c.workerId!);
      const age = r?.last_seen_at ? Date.now() - new Date(r.last_seen_at).getTime() : Number.POSITIVE_INFINITY;
      return {
        workerId: c.workerId!,
        name: c.name,
        photo: c.photo,
        skillName: c.skillName,
        status: c.status,
        lat: r?.lat ?? null,
        lng: r?.lng ?? null,
        sharing: Boolean(r?.sharing),
        lastSeenAt: r?.last_seen_at ?? null,
        permission: r?.permission ?? "unknown",
        stale: !r?.sharing || age > 45_000,
        accuracy: r?.accuracy ?? null,
      };
    });
}

async function rollupBooking(sql: Sql, bookingId: string) {
  const slots = await sql<{ status: string }>`select status from booking_workers where booking_id = ${bookingId}`;
  if (slots.length === 0) return;
  const live = slots.filter((s) => LIVE_ASSIGN.has(s.status));
  const done = slots.filter((s) => s.status === "completed");
  const closed = slots.filter((s) => s.status === "cancelled" || s.status === "rejected" || s.status === "completed");
  const current = (await sql<{ status: string }>`select status from bookings where id = ${bookingId}`)[0];
  if (!current || current.status === "cancelled") return;
  let next = current.status;
  if (live.length === 0 && done.length === 0 && closed.length === slots.length) next = "cancelled";
  else if (live.length === 0 && done.length > 0 && closed.length === slots.length) next = "completed";
  else if (slots.some((s) => s.status === "in_progress")) next = "in_progress";
  else if (slots.some((s) => s.status === "arrived")) next = "arrived";
  else if (slots.some((s) => s.status === "on_the_way")) next = "on_the_way";
  else if (live.length > 0) next = "accepted";
  else next = "requested";
  if (next !== current.status) {
    await sql`update bookings set status = ${next}, updated_at = now() where id = ${bookingId}`;
  }
  if (next === "completed" || next === "cancelled") {
    await sql`delete from booking_live_tracks where booking_id = ${bookingId}`;
    await clearLive(sql, bookingId);
  }
}

function workerNetOf(row: { unit_rate?: number | null; rate_type?: string; duration_hours?: number; rate_amount?: number; worker_charge?: number | null; total: number; fee: number }) {
  const unit = row.unit_rate && row.unit_rate > 0 ? row.unit_rate : row.rate_amount ?? 0;
  try {
    return quoteFromWorkerRate(unit, row.rate_type || "day", row.duration_hours || 8, 1).unitCharge;
  } catch {
    return unit > 0 ? unit : Math.max(0, (row.worker_charge || row.total) - (row.fee || 0));
  }
}

async function ensureWorkerPayout(sql: Sql, booking: BookingRow, workerId: string) {
  const amount = workerNetOf(booking);
  await sql`
    insert into worker_payouts (id, booking_id, worker_id, amount, status)
    values (${uid("wp")}, ${booking.id}, ${workerId}, ${amount}, ${"pending"})
    on conflict (booking_id, worker_id) do nothing
  `;
}

async function ensureSlots(sql: Sql, booking: BookingRow) {
  const existing = await sql<{ n: number }>`select count(*)::int as n from booking_workers where booking_id = ${booking.id}`;
  if ((existing[0]?.n ?? 0) > 0) return;
  const crew = Math.max(1, booking.crew_size || 1);
  for (let slot = 1; slot <= crew; slot++) {
    const workerId = slot === 1 ? booking.worker_id : null;
    const status =
      booking.status === "cancelled" ? "cancelled" : booking.status === "completed" ? "completed" : workerId && booking.status !== "requested" ? booking.status : "pending";
    await sql`
      insert into booking_workers (id, booking_id, worker_id, slot, status)
      values (${uid("bw")}, ${booking.id}, ${workerId}, ${slot}, ${status})
      on conflict do nothing
    `;
  }
}


export const listCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureCatalog(sql);
  const categories = await sql<{ id: string; name: string; hindi: string; sort_order: number }>`
    select id, name, hindi, sort_order from categories order by sort_order
  `;
  const skills = await sql<{
    id: string;
    category_id: string;
    name: string;
    hindi: string;
    default_rate: number;
    status?: string;
  }>`
    select id, category_id, name, hindi, default_rate, status from skills
    where coalesce(status, 'approved') = 'approved'
    order by sort_order
  `;
  return { categories, skills };
});

export const proposeSkill = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; hindi?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    const name = data.name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (name.length < 2) throw new Error("Enter a skill name");
    const hindi = (data.hindi ?? "").trim().slice(0, 80);
    const existing = await sql<{ id: string; status: string | null; name: string }>`
      select id, status, name from skills
      where lower(name) = ${name.toLowerCase()}
         or (hindi <> '' and hindi = ${name})
      limit 1
    `;
    if (existing[0]) {
      return {
        id: existing[0].id,
        name: existing[0].name,
        status: existing[0].status || "approved",
        existing: true,
      };
    }
    const id = `custom-${uid("sk")}`;
    await sql`
      insert into skills (id, category_id, name, hindi, default_rate, sort_order, status, requested_by)
      values (${id}, ${"general"}, ${name}, ${hindi}, ${250}, ${900}, ${"pending"}, ${context.userId})
    `;
    return { id, name, status: "pending" as const, existing: false };
  });

export const adminListSkills = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<{
      id: string;
      name: string;
      hindi: string;
      default_rate: number;
      status: string;
      requested_by: string | null;
      category_id: string;
    }>`
      select id, name, hindi, default_rate, coalesce(status, 'approved') as status, requested_by, category_id
      from skills
      order by case when coalesce(status, 'approved') = 'pending' then 0 else 1 end, name
    `;
  });

export const adminSetSkillStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    if (data.status !== "approved" && data.status !== "rejected" && data.status !== "pending") {
      throw new Error("Invalid status");
    }
    await sql`update skills set status = ${data.status} where id = ${data.id}`;
    return { ok: true };
  });

export const searchWorkers = createServerFn({ method: "GET" })
  .validator(
    (d: {
      skillId?: string;
      q?: string;
      lat?: number | null;
      lng?: number | null;
      workDate?: string;
      minRate?: number;
      maxRate?: number;
      availableOnly?: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    const date = (data.workDate ?? "").trim();
    const busy = date
      ? await sql<{ worker_id: string }>`
          select distinct bw.worker_id from booking_workers bw
          join bookings b on b.id = bw.booking_id
          where bw.worker_id is not null
            and bw.status in ('accepted', 'on_the_way', 'arrived', 'in_progress')
            and b.work_date = ${date}
        `
      : await sql<{ worker_id: string }>`
          select distinct bw.worker_id from booking_workers bw
          join bookings b on b.id = bw.booking_id
          where bw.worker_id is not null
            and bw.status in ('accepted', 'on_the_way', 'arrived', 'in_progress')
        `;
    const busySet = new Set(busy.map((b) => b.worker_id));
    const rows = await sql<{
      user_id: string;
      name: string;
      about: string;
      experience_years: number;
      location_label: string;
      lat: number | null;
      lng: number | null;
      radius_km: number;
      available: boolean;
      photo_data: string | null;
      verification_status: string;
      id_verification_status: string;
      rate_amount: number;
      rate_type: string;
      completed_jobs: number;
      rating_sum: number;
      rating_count: number;
      skill_ids: string;
      skill_names: string;
      skill_rates: string;
    }>`
      select w.user_id, p.name, w.about, w.experience_years, w.location_label, w.lat, w.lng,
        w.radius_km, w.available, w.photo_data, w.verification_status, w.id_verification_status,
        w.rate_amount, w.rate_type, w.completed_jobs, w.rating_sum, w.rating_count,
        coalesce(string_agg(s.id, ','), '') as skill_ids,
        coalesce(string_agg(s.name, ','), '') as skill_names,
        coalesce(string_agg(coalesce(ws.rate_amount::text, ''), ','), '') as skill_rates
      from workers w
      join profiles p on p.user_id = w.user_id
      left join worker_skills ws on ws.user_id = w.user_id
      left join skills s on s.id = ws.skill_id and coalesce(s.status, 'approved') = 'approved'
      where w.approved = true and w.suspended = false and p.suspended = false
        and (w.id_verification_status = ${KYC_VERIFIED} or w.id_verification_status = 'approved')
      group by w.user_id, p.name, w.about, w.experience_years, w.location_label, w.lat, w.lng,
        w.radius_km, w.available, w.photo_data, w.verification_status, w.id_verification_status,
        w.rate_amount, w.rate_type, w.completed_jobs, w.rating_sum, w.rating_count
    `;
    const q = (data.q ?? "").trim().toLowerCase();
    const availableOnly = data.availableOnly !== false;
    const mapped: WorkerPublic[] = rows
      .map((r) => {
        const ids = r.skill_ids ? r.skill_ids.split(",") : [];
        const names = r.skill_names ? r.skill_names.split(",") : [];
        const rates = r.skill_rates ? r.skill_rates.split(",") : [];
        let distanceKm: number | null = null;
        if (data.lat != null && data.lng != null && r.lat != null && r.lng != null) {
          distanceKm = Math.round(haversineKm(data.lat, data.lng, r.lat, r.lng) * 10) / 10;
        }
        const skills = ids.map((id, i) => ({
          id,
          name: names[i] ?? id,
          rateAmount: rates[i] ? Number(rates[i]) : null,
        }));
        const skillMatch = data.skillId ? skills.find((s) => s.id === data.skillId) : null;
        const displayRate =
          skillMatch?.rateAmount && skillMatch.rateAmount > 0 ? skillMatch.rateAmount : r.rate_amount;
        return {
          userId: r.user_id,
          name: r.name,
          about: r.about,
          experienceYears: r.experience_years,
          locationLabel: r.location_label,
          lat: r.lat,
          lng: r.lng,
          radiusKm: r.radius_km,
          available: r.available,
          photoData: r.photo_data,
          verificationStatus: r.verification_status,
          idVerificationStatus: r.id_verification_status,
          rateAmount: displayRate,
          rateType: r.rate_type,
          completedJobs: r.completed_jobs,
          rating: ratingOf(r.rating_sum, r.rating_count),
          ratingCount: r.rating_count,
          skills,
          distanceKm,
        };
      })
      .filter((w) => {
        if (busySet.has(w.userId)) return false;
        if (availableOnly && !w.available) return false;
        if (data.skillId && !w.skills.some((s) => s.id === data.skillId)) return false;
        if (data.minRate != null && w.rateAmount < data.minRate) return false;
        if (data.maxRate != null && w.rateAmount > data.maxRate) return false;
        if (q) {
          const blob = `${w.name} ${w.locationLabel} ${w.skills.map((s) => s.name).join(" ")}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        if (availableOnly && w.distanceKm != null && w.distanceKm > w.radiusKm) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        const da = a.distanceKm ?? 99;
        const db = b.distanceKm ?? 99;
        if (da !== db) return da - db;
        return b.rating - a.rating;
      });
    return mapped;
  });

export const workerCount = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from workers w
    join profiles p on p.user_id = w.user_id
    where w.available = true and w.approved = true and w.suspended = false and p.suspended = false
      and (w.id_verification_status = ${KYC_VERIFIED} or w.id_verification_status = 'approved')
  `;
  return rows[0]?.n ?? 0;
});

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureProfile(sql, context.userId);
    const profiles = await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`;
    const profile = profiles[0]!;
    const workers = await sql<{
      user_id: string;
      about: string;
      experience_years: number;
      location_label: string;
      lat: number | null;
      lng: number | null;
      radius_km: number;
      available: boolean;
      photo_data: string | null;
      verification_status: string;
      id_verification_status: string;
      rate_amount: number;
      rate_type: string;
      completed_jobs: number;
      rating_sum: number;
      rating_count: number;
      approved: boolean;
      gender?: string;
      date_of_birth?: string;
      age_years?: number;
      village?: string;
      city_area?: string;
      overtime_rate?: number;
      insurance_status?: string;
      insurance_note?: string;
      availability_note?: string;
    }>`select * from workers where user_id = ${context.userId}`;
    const worker = workers[0] ?? null;
    if (worker) {
      const synced = await syncWorkerKycFromDocuments(sql, context.userId);
      if (synced) worker.id_verification_status = synced;
    }
    if (worker && !isKycApproved(worker.id_verification_status) && worker.available) {
      await sql`update workers set available = false, updated_at = now() where user_id = ${context.userId}`;
      worker.available = false;
    }
    const skillRows = worker
      ? await sql<{ id: string; name: string; status: string }>`
          select s.id, s.name, coalesce(s.status, 'approved') as status
          from worker_skills ws join skills s on s.id = ws.skill_id
          where ws.user_id = ${context.userId}
        `
      : [];
    const unread = await sql<{ n: number }>`
      select count(*)::int as n from notifications where user_id = ${context.userId} and read = false
    `;
    const blocked = await sql<{ blocked_user_id: string }>`
      select blocked_user_id from blocks where user_id = ${context.userId}
    `;
    return {
      profile,
      worker: worker
        ? {
            ...worker,
            skills: skillRows,
            rating: ratingOf(worker.rating_sum, worker.rating_count),
          }
        : null,
      unread: unread[0]?.n ?? 0,
      blockedIds: blocked.map((b) => b.blocked_user_id),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      name?: string;
      phone?: string;
      locale?: string;
      activeMode?: string;
      locationLabel?: string;
      lat?: number | null;
      lng?: number | null;
      emergencyName?: string;
      emergencyPhone?: string;
      businessName?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const cur = (await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`)[0]!;
    await sql`
      update profiles set
        name = ${data.name ?? cur.name},
        phone = ${data.phone ?? cur.phone},
        locale = ${data.locale ?? cur.locale},
        active_mode = ${data.activeMode ?? cur.active_mode},
        location_label = ${data.locationLabel ?? cur.location_label},
        lat = ${data.lat === undefined ? cur.lat : data.lat},
        lng = ${data.lng === undefined ? cur.lng : data.lng},
        emergency_name = ${data.emergencyName ?? cur.emergency_name ?? ""},
        emergency_phone = ${data.emergencyPhone ?? cur.emergency_phone ?? ""},
        business_name = ${data.businessName ?? cur.business_name ?? ""}
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const saveWorkerProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      about: string;
      experienceYears: number;
      locationLabel: string;
      lat?: number | null;
      lng?: number | null;
      radiusKm: number;
      rateAmount: number;
      rateType: string;
      skillIds: string[];
      photoData?: string | null;
      gender?: string;
      dateOfBirth?: string;
      ageYears?: number;
      village?: string;
      cityArea?: string;
      overtimeRate?: number;
      insuranceStatus?: string;
      insuranceNote?: string;
      availabilityNote?: string;
      available?: boolean;
      skillRates?: Record<string, number>;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const gender = (data.gender ?? "").slice(0, 16);
    const dob = (data.dateOfBirth ?? "").slice(0, 12);
    const age = Math.max(0, Math.min(90, Math.round(data.ageYears ?? 0)));
    const village = (data.village ?? "").slice(0, 80);
    const cityArea = (data.cityArea ?? "").slice(0, 80);
    const ot = Math.max(0, Math.round(data.overtimeRate ?? 0));
    const ins = ["none", "yes", "pending"].includes(data.insuranceStatus ?? "") ? data.insuranceStatus! : "none";
    const insNote = (data.insuranceNote ?? "").slice(0, 200);
    const availNote = (data.availabilityNote ?? "").slice(0, 40);
    const existing = await sql<{ id_verification_status: string }>`
      select id_verification_status from workers where user_id = ${context.userId}
    `;
    const canGoPublic = isKycApproved(existing[0]?.id_verification_status);
    const available = canGoPublic && Boolean(data.available);
    await sql`
      insert into workers (
        user_id, about, experience_years, location_label, lat, lng, radius_km, rate_amount, rate_type, photo_data,
        gender, date_of_birth, age_years, village, city_area, overtime_rate, insurance_status, insurance_note, availability_note,
        available
      )
      values (
        ${context.userId}, ${data.about}, ${data.experienceYears}, ${data.locationLabel}, ${data.lat ?? null}, ${data.lng ?? null},
        ${data.radiusKm}, ${data.rateAmount}, ${data.rateType}, ${data.photoData ?? null},
        ${gender}, ${dob}, ${age}, ${village}, ${cityArea}, ${ot}, ${ins}, ${insNote}, ${availNote},
        ${available}
      )
      on conflict (user_id) do update set
        about = excluded.about,
        experience_years = excluded.experience_years,
        location_label = excluded.location_label,
        lat = excluded.lat,
        lng = excluded.lng,
        radius_km = excluded.radius_km,
        rate_amount = excluded.rate_amount,
        rate_type = excluded.rate_type,
        photo_data = coalesce(excluded.photo_data, workers.photo_data),
        gender = excluded.gender,
        date_of_birth = excluded.date_of_birth,
        age_years = excluded.age_years,
        village = excluded.village,
        city_area = excluded.city_area,
        overtime_rate = excluded.overtime_rate,
        insurance_status = excluded.insurance_status,
        insurance_note = excluded.insurance_note,
        availability_note = excluded.availability_note,
        available = excluded.available,
        updated_at = now()
    `;
    const prev = await sql<{ skill_id: string; rate_amount: number | null }>`
      select skill_id, rate_amount from worker_skills where user_id = ${context.userId}
    `;
    const prevMap = new Map(prev.map((p) => [p.skill_id, p.rate_amount]));
    await sql`delete from worker_skills where user_id = ${context.userId}`;
    for (const id of data.skillIds) {
      const custom = data.skillRates?.[id];
      const kept = prevMap.get(id);
      const rate =
        custom != null && custom > 0 ? Math.round(custom) : kept != null && kept > 0 ? kept : data.rateAmount;
      await sql`
        insert into worker_skills (user_id, skill_id, rate_amount)
        values (${context.userId}, ${id}, ${rate})
        on conflict do nothing
      `;
    }
    await sql`update profiles set active_mode = 'worker' where user_id = ${context.userId}`;
    return { ok: true };
  });

export const setAvailable = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { available: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.available) {
      await requireWorkerKyc(sql, context.userId, KYC_PUBLIC_MESSAGE);
    }
    await sql`
      update workers set available = ${data.available}, updated_at = now()
      where user_id = ${context.userId} and suspended = false
    `;
    return { ok: true };
  });

export const getWorker = createServerFn({ method: "GET" })
  .validator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      name: string;
      about: string;
      experience_years: number;
      location_label: string;
      lat: number | null;
      lng: number | null;
      radius_km: number;
      available: boolean;
      photo_data: string | null;
      verification_status: string;
      id_verification_status: string;
      rate_amount: number;
      rate_type: string;
      completed_jobs: number;
      rating_sum: number;
      rating_count: number;
      skill_ids: string;
      skill_names: string;
    }>`
      select w.user_id, p.name, w.about, w.experience_years, w.location_label, w.lat, w.lng,
        w.radius_km, w.available, w.photo_data, w.verification_status, w.id_verification_status,
        w.rate_amount, w.rate_type, w.completed_jobs, w.rating_sum, w.rating_count,
        coalesce(string_agg(s.id, ','), '') as skill_ids,
        coalesce(string_agg(s.name, ','), '') as skill_names
      from workers w
      join profiles p on p.user_id = w.user_id
      left join worker_skills ws on ws.user_id = w.user_id
      left join skills s on s.id = ws.skill_id and coalesce(s.status, 'approved') = 'approved'
      where w.user_id = ${data.userId} and w.approved = true and w.suspended = false and p.suspended = false
        and (w.id_verification_status = ${KYC_VERIFIED} or w.id_verification_status = 'approved')
      group by w.user_id, p.name, w.about, w.experience_years, w.location_label, w.lat, w.lng,
        w.radius_km, w.available, w.photo_data, w.verification_status, w.id_verification_status,
        w.rate_amount, w.rate_type, w.completed_jobs, w.rating_sum, w.rating_count
    `;
    const r = rows[0];
    if (!r) return null;
    const ids = r.skill_ids ? r.skill_ids.split(",") : [];
    const names = r.skill_names ? r.skill_names.split(",") : [];
    const worker: WorkerPublic = {
      userId: r.user_id,
      name: r.name,
      about: r.about,
      experienceYears: r.experience_years,
      locationLabel: r.location_label,
      lat: r.lat,
      lng: r.lng,
      radiusKm: r.radius_km,
      available: r.available,
      photoData: r.photo_data,
      verificationStatus: r.verification_status,
      idVerificationStatus: r.id_verification_status,
      rateAmount: r.rate_amount,
      rateType: r.rate_type,
      completedJobs: r.completed_jobs,
      rating: ratingOf(r.rating_sum, r.rating_count),
      ratingCount: r.rating_count,
      skills: ids.map((id, i) => ({ id, name: names[i] ?? id })),
      distanceKm: null,
    };
    return worker;
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      skillId: string;
      workerId?: string | null;
      description: string;
      address: string;
      lat?: number | null;
      lng?: number | null;
      workDate: string;
      startTime: string;
      durationHours: number;
      crewSize: number;
      rateAmount: number;
      rateType: string;
      paymentMethod: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    await assertNotSuspended(sql, context.userId);
    const crewSize = Math.min(20, Math.max(1, Math.round(Number(data.crewSize) || 1)));
    if (!data.workerId) {
      throw new Error("Select a worker so we can use their saved rate.");
    }
    if (data.workerId === context.userId) {
      throw new Error("You cannot book yourself.");
    }
    const priced = await workerUnitRate(sql, data.workerId, data.skillId);
    if (data.rateType && data.rateType !== priced.rateType) {
      throw new Error("This worker only quotes per " + priced.rateType + ". A different rate type is not available.");
    }
    const quote = quoteFromWorkerRate(priced.rate, priced.rateType, data.durationHours, crewSize);
    if (await conflictingLive(sql, data.workerId, data.workDate)) {
      throw new Error("Worker is already booked for this time.");
    }
    const id = uid("bk");
    await sql`
      insert into bookings (
        id, customer_id, worker_id, skill_id, description, address, lat, lng,
        work_date, start_time, duration_hours, crew_size, rate_amount, rate_type,
        unit_rate, worker_charge, fee, total, payment_method, payment_status, status
      ) values (
        ${id}, ${context.userId}, ${data.workerId}, ${data.skillId}, ${data.description},
        ${data.address}, ${data.lat ?? null}, ${data.lng ?? null}, ${data.workDate}, ${data.startTime},
        ${quote.hours}, ${quote.crewSize}, ${quote.unitRate}, ${quote.rateType},
        ${quote.unitRate}, ${quote.workerCharge}, ${quote.fee}, ${quote.total}, ${"cash"}, ${"due"}, ${"requested"}
      )
    `;
    await sql`
      insert into payments (id, booking_id, amount, method, status, note, customer_id, worker_id, gross, commission, worker_payout, payout_status, provider, cash_amount)
      values (
        ${uid("pay")}, ${id}, ${quote.total}, ${"cash"}, ${"due"},
        ${"Cash on site. Pending until cash is recorded."},
        ${context.userId}, ${data.workerId}, ${quote.total}, ${quote.fee}, ${quote.unitCharge}, ${"unpaid"}, ${""}, ${quote.total}
      )
    `;
    for (let slot = 1; slot <= quote.crewSize; slot++) {
      const assigned = slot === 1 ? data.workerId : null;
      await sql`
        insert into booking_workers (id, booking_id, worker_id, slot, status)
        values (${uid("bw")}, ${id}, ${assigned}, ${slot}, ${"pending"})
      `;
    }
    await notify(
      sql,
      data.workerId,
      "booking_created",
      "New booking request",
      "A customer requested you for a job.",
      id,
    );
    if (quote.crewSize > 1) {
      const matches = await sql<{ user_id: string }>`
        select w.user_id from workers w
        join worker_skills ws on ws.user_id = w.user_id
        where ws.skill_id = ${data.skillId}
          and w.available = true and w.approved = true and w.suspended = false
          and (w.id_verification_status = ${KYC_VERIFIED} or w.id_verification_status = 'approved')
          and w.user_id <> ${context.userId} and w.user_id <> ${data.workerId}
        limit 30
      `;
      for (const m of matches) {
        await notify(sql, m.user_id, "booking_created", "Crew seats open", "A multi-worker job has open seats in your trade.", id);
      }
    }
    return { id, total: quote.total, fee: quote.fee, workerCharge: quote.workerCharge, unitRate: quote.unitRate };
  });

async function loadBooking(sql: Sql, id: string): Promise<BookingRow | null> {
  const rows = await sql<BookingRow>`
    select b.*, s.name as skill_name, c.name as customer_name, c.phone as customer_phone,
      c.business_name as customer_business,
      w.name as worker_name, wp.phone as worker_phone, wr.photo_data as worker_photo
    from bookings b
    join skills s on s.id = b.skill_id
    join profiles c on c.user_id = b.customer_id
    left join profiles w on w.user_id = b.worker_id
    left join profiles wp on wp.user_id = b.worker_id
    left join workers wr on wr.user_id = b.worker_id
    where b.id = ${id}
  `;
  return rows[0] ?? null;
}

function canSee(row: BookingRow, userId: string, isAdmin: boolean) {
  return isAdmin || row.customer_id === userId || row.worker_id === userId;
}

async function canSeeBooking(sql: Sql, row: BookingRow, userId: string, isAdmin: boolean) {
  if (canSee(row, userId, isAdmin)) return true;
  const hit = await sql<{ n: number }>`
    select 1 as n from booking_workers where booking_id = ${row.id} and worker_id = ${userId} limit 1
  `;
  return Boolean(hit[0]);
}

const LIVE_OK = new Set(["accepted", "on_the_way", "arrived", "in_progress"]);

async function clearLive(sql: Sql, bookingId: string) {
  await sql`delete from booking_live_locations where booking_id = ${bookingId}`;
}

export const getBooking = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.id);
    if (!row) return null;
    const me = (await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`)[0];
    if (!row || !(await canSeeBooking(sql, row, context.userId, me?.is_admin ?? false))) return null;
    await ensureSlots(sql, row);
    const crew = await loadCrew(sql, row.id);
    const liveTracks = await loadTracks(sql, row.id, crew);
    return {
      ...row,
      crew,
      liveTracks,
      accepted_count: crew.filter((c) => LIVE_ASSIGN.has(c.status) || c.status === "completed").length,
      pending_count: crew.filter((c) => c.status === "pending").length,
      my_status: crew.find((c) => c.workerId === context.userId)?.status ?? null,
    };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<BookingRow>`
      select b.*, s.name as skill_name, c.name as customer_name, c.phone as customer_phone,
        w.name as worker_name, wp.phone as worker_phone,
        (select count(*)::int from booking_workers bw where bw.booking_id = b.id and bw.status in ('accepted','on_the_way','arrived','in_progress')) as accepted_count,
        (select count(*)::int from booking_workers bw where bw.booking_id = b.id and bw.status = 'pending') as pending_count,
        (select bw.status from booking_workers bw where bw.booking_id = b.id and bw.worker_id = ${context.userId} limit 1) as my_status
      from bookings b
      join skills s on s.id = b.skill_id
      join profiles c on c.user_id = b.customer_id
      left join profiles w on w.user_id = b.worker_id
      left join profiles wp on wp.user_id = b.worker_id
      where b.customer_id = ${context.userId} or b.worker_id = ${context.userId}
         or exists (select 1 from booking_workers bw where bw.booking_id = b.id and bw.worker_id = ${context.userId})
      order by b.created_at desc
    `;
  });

export const listOpenJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const kyc = await sql<{ id_verification_status: string; available: boolean }>`
      select id_verification_status, available from workers where user_id = ${context.userId}
    `;
    if (!isKycApproved(kyc[0]?.id_verification_status) || !kyc[0]?.available) return [] as BookingRow[];
    const skills = await sql<{ skill_id: string }>`select skill_id from worker_skills where user_id = ${context.userId}`;
    const ids = skills.map((s) => s.skill_id);
    if (ids.length === 0) return [] as BookingRow[];
    const declined = await sql<{ booking_id: string }>`select booking_id from booking_declines where worker_id = ${context.userId}`;
    const declinedSet = new Set(declined.map((d) => d.booking_id));
    const mine = await sql<{ booking_id: string }>`
      select booking_id from booking_workers
      where worker_id = ${context.userId} and status in ('accepted','on_the_way','arrived','in_progress','completed')
    `;
    const mineSet = new Set(mine.map((m) => m.booking_id));
    const rows = await sql<BookingRow>`
      select b.*, s.name as skill_name, c.name as customer_name, c.phone as customer_phone,
        w.name as worker_name, wp.phone as worker_phone,
        (select count(*)::int from booking_workers bw where bw.booking_id = b.id and bw.status = 'pending') as pending_count
      from bookings b
      join skills s on s.id = b.skill_id
      join profiles c on c.user_id = b.customer_id
      left join profiles w on w.user_id = b.worker_id
      left join profiles wp on wp.user_id = b.worker_id
      where b.status in ('requested', 'accepted', 'on_the_way', 'arrived', 'in_progress')
        and b.customer_id <> ${context.userId}
        and exists (
          select 1 from booking_workers bw
          where bw.booking_id = b.id
            and bw.status = 'pending'
            and (bw.worker_id is null or bw.worker_id = ${context.userId})
        )
      order by b.created_at desc
    `;
    return rows.filter((r) => ids.includes(r.skill_id) && !declinedSet.has(r.id) && !mineSet.has(r.id));
  });

const STATUSES = [
  "requested",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.id);
    if (!row) throw new Error("Booking not found");
    await ensureSlots(sql, row);
    const isCustomer = row.customer_id === context.userId;
    const next = data.status;
    if (next === "cancelled") {
      if (!isCustomer && row.worker_id !== context.userId) {
        const mine = await sql<{ id: string }>`select id from booking_workers where booking_id = ${data.id} and worker_id = ${context.userId}`;
        if (!mine[0]) throw new Error("Unauthorized");
        await sql`update booking_workers set status = 'cancelled' where booking_id = ${data.id} and worker_id = ${context.userId}`;
        await sql`delete from booking_live_tracks where booking_id = ${data.id} and worker_id = ${context.userId}`;
        await notify(sql, row.customer_id, "booking_cancelled", "A worker cancelled", "", data.id);
        await rollupBooking(sql, data.id);
        return { ok: true };
      }
      if (!isCustomer && row.worker_id !== context.userId) throw new Error("Unauthorized");
      await sql`update bookings set status = 'cancelled', cancelled_by = ${context.userId}, updated_at = now() where id = ${data.id}`;
      await sql`update booking_workers set status = 'cancelled' where booking_id = ${data.id} and status not in ('completed','rejected')`;
      await sql`delete from booking_live_tracks where booking_id = ${data.id}`;
      await clearLive(sql, data.id);
      const crew = await loadCrew(sql, data.id);
      for (const c of crew) {
        if (c.workerId && c.workerId !== context.userId) {
          await notify(sql, c.workerId, "booking_cancelled", "Booking cancelled", "", data.id);
        }
      }
      if (isCustomer === false) await notify(sql, row.customer_id, "booking_cancelled", "Booking cancelled", "", data.id);
      else if (row.worker_id) await notify(sql, row.worker_id, "booking_cancelled", "Booking cancelled", "", data.id);
      return { ok: true };
    }
    if (next === "accepted") {
      const worker = await sql<{ user_id: string; available: boolean; suspended: boolean; id_verification_status: string }>`
        select user_id, available, suspended, id_verification_status from workers where user_id = ${context.userId}
      `;
      if (!worker[0] || worker[0].suspended) throw new Error("Unauthorized");
      if (!isKycApproved(worker[0].id_verification_status)) {
        throw new Error("KYC verification required before you can accept bookings.");
      }
      if (!worker[0].available) throw new Error("Go available to accept jobs");
      const taken = await sql<{ id: string }>`
        with conflict as (
          select 1 as x
          from booking_workers bw
          join bookings b on b.id = bw.booking_id
          where bw.worker_id = ${context.userId}
            and bw.status in ('accepted', 'on_the_way', 'arrived', 'in_progress')
            and b.status in ('accepted', 'on_the_way', 'arrived', 'in_progress')
            and (${row.work_date} = '' or b.work_date = ${row.work_date})
            and b.id <> ${data.id}
          limit 1
        ),
        target as (
          select bw.id
          from booking_workers bw
          where bw.booking_id = ${data.id}
            and bw.status = 'pending'
            and (bw.worker_id is null or bw.worker_id = ${context.userId})
            and not exists (select 1 from conflict)
          order by bw.slot
          limit 1
        )
        update booking_workers bw
        set worker_id = ${context.userId}, status = 'accepted', accepted_at = now()
        from target
        where bw.id = target.id
        returning bw.id
      `;
      if (!taken[0]) {
        const busy = await conflictingLive(sql, context.userId, row.work_date, data.id);
        if (busy) throw new Error("Worker is already booked for this time.");
        throw new Error("No open seats on this booking.");
      }
      if (!row.worker_id) {
        await sql`update bookings set worker_id = ${context.userId}, updated_at = now() where id = ${data.id} and worker_id is null`;
      }
      await rollupBooking(sql, data.id);
      await notify(sql, row.customer_id, "booking_accepted", "Worker accepted", "Open tracking to see the crew.", data.id);
      return { ok: true };
    }
    const mine = await sql<{ id: string; status: string }>`
      select id, status from booking_workers where booking_id = ${data.id} and worker_id = ${context.userId}
    `;
    if (!mine[0]) throw new Error("Unauthorized");
    const order = ["accepted", "on_the_way", "arrived", "in_progress", "completed"];
    const idx = order.indexOf(mine[0].status);
    if (order[idx + 1] !== next && next !== mine[0].status) throw new Error("Invalid status");
    await sql`
      update booking_workers
      set status = ${next},
        arrived_at = case when ${next} = 'arrived' then coalesce(arrived_at, now()) else arrived_at end,
        started_at = case when ${next} = 'in_progress' then coalesce(started_at, now()) else started_at end,
        completed_at = case when ${next} = 'completed' then now() else completed_at end
      where id = ${mine[0].id} and worker_id = ${context.userId}
    `;
    if (next === "completed") {
      await sql`update workers set completed_jobs = completed_jobs + 1 where user_id = ${context.userId}`;
      await sql`delete from booking_live_tracks where booking_id = ${data.id} and worker_id = ${context.userId}`;
      await ensureWorkerPayout(sql, row, context.userId);
    }
    await rollupBooking(sql, data.id);
    const titles: Record<string, string> = {
      on_the_way: "Worker on the way",
      arrived: "Worker arrived",
      in_progress: "Work started",
      completed: "Work completed",
    };
    await notify(sql, row.customer_id, `booking_${next}`, titles[next] ?? "Booking update", "", data.id);
    return { ok: true };
  });

export const declineJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.id);
    if (!row) throw new Error("Not found");
    await ensureSlots(sql, row);
    const mine = await sql<{ id: string }>`
      select id from booking_workers where booking_id = ${data.id} and worker_id = ${context.userId} and status = 'pending'
    `;
    if (mine[0]) {
      await sql`update booking_workers set status = 'rejected', rejected_at = now() where id = ${mine[0].id}`;
      await notify(sql, row.customer_id, "booking_rejected", "Worker rejected", "A worker declined this seat.", data.id);
      await rollupBooking(sql, data.id);
    } else {
      await sql`insert into booking_declines (booking_id, worker_id) values (${data.id}, ${context.userId}) on conflict do nothing`;
    }
    return { ok: true };
  });

export const markCashCollected = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.id);
    if (!row) throw new Error("Unauthorized");
    await ensureSlots(sql, row);
    const me = (await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`)[0];
    const slot = await sql<{ id: string; status: string }>`
      select id, status from booking_workers where booking_id = ${data.id} and worker_id = ${context.userId}
    `;
    const allowed =
      Boolean(me?.is_admin) ||
      row.customer_id === context.userId ||
      row.worker_id === context.userId ||
      slot[0]?.status === "completed";
    if (!allowed) throw new Error("Unauthorized");
    if (row.status !== "completed" && slot[0]?.status !== "completed") {
      throw new Error("Finish the job first");
    }
    await sql`update bookings set payment_status = 'collected', payment_method = 'cash', updated_at = now() where id = ${data.id}`;
    await sql`
      update payments
      set status = 'collected', method = 'cash', collected_at = now(), collected_by = ${context.userId},
        cash_amount = coalesce(nullif(cash_amount, 0), amount),
        note = 'Cash collected on site.'
      where booking_id = ${data.id}
    `;
    await notify(sql, row.customer_id, "payment", "Cash collected", "Cash on site was recorded. Status: Cash Collected.", data.id);
    const crewPaid = await loadCrew(sql, data.id);
    for (const c of crewPaid) {
      if (c.workerId && c.workerId !== context.userId) {
        await notify(sql, c.workerId, "payment", "Cash collected", "Cash on site was recorded.", data.id);
      }
    }
    return { ok: true };
  });

export const addRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookingId: string; stars: number; review: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.bookingId);
    if (!row || row.status !== "completed") throw new Error("Not rateable");
    const to = context.userId === row.customer_id ? row.worker_id : row.customer_id;
    if (!to) throw new Error("No counterpart");
    const stars = Math.min(5, Math.max(1, Math.round(data.stars)));
    const prev = await sql<{ stars: number }>`
      select stars from ratings where booking_id = ${data.bookingId} and from_user_id = ${context.userId}
    `;
    await sql`
      insert into ratings (id, booking_id, from_user_id, to_user_id, stars, review)
      values (${uid("rt")}, ${data.bookingId}, ${context.userId}, ${to}, ${stars}, ${data.review})
      on conflict (booking_id, from_user_id) do update set stars = excluded.stars, review = excluded.review
    `;
    if (to === row.worker_id) {
      if (prev[0]) {
        await sql`update workers set rating_sum = rating_sum - ${prev[0].stars} + ${stars} where user_id = ${to}`;
      } else {
        await sql`update workers set rating_sum = rating_sum + ${stars}, rating_count = rating_count + 1 where user_id = ${to}`;
      }
    }
    await notify(sql, to, "rating", "New rating", `${stars} stars`, data.bookingId);
    return { ok: true };
  });

export const openThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { workerId: string; bookingId?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<{ id: string }>`
      select id from threads where customer_id = ${context.userId} and worker_id = ${data.workerId}
    `;
    if (existing[0]) return { id: existing[0].id };
    const id = uid("th");
    await sql`
      insert into threads (id, customer_id, worker_id, booking_id)
      values (${id}, ${context.userId}, ${data.workerId}, ${data.bookingId ?? null})
    `;
    return { id };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      customer_id: string;
      worker_id: string;
      customer_name: string;
      worker_name: string;
      last_body: string | null;
      created_at: string;
    }>`
      select t.id, t.customer_id, t.worker_id, t.created_at,
        c.name as customer_name, w.name as worker_name,
        (select body from messages m where m.thread_id = t.id order by created_at desc limit 1) as last_body
      from threads t
      join profiles c on c.user_id = t.customer_id
      join profiles w on w.user_id = t.worker_id
      where t.customer_id = ${context.userId} or t.worker_id = ${context.userId}
      order by t.created_at desc
    `;
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { threadId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const th = await sql<{ customer_id: string; worker_id: string }>`
      select customer_id, worker_id from threads where id = ${data.threadId}
    `;
    const t = th[0];
    if (!t || (t.customer_id !== context.userId && t.worker_id !== context.userId)) return [];
    return sql<{ id: string; sender_id: string; body: string; created_at: string }>`
      select id, sender_id, body, created_at from messages where thread_id = ${data.threadId} order by created_at
    `;
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { threadId: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const body = data.body.trim();
    if (!body) return { ok: false };
    const th = await sql<{ customer_id: string; worker_id: string }>`
      select customer_id, worker_id from threads where id = ${data.threadId}
    `;
    const t = th[0];
    if (!t || (t.customer_id !== context.userId && t.worker_id !== context.userId)) throw new Error("Unauthorized");
    await sql`
      insert into messages (id, thread_id, sender_id, body)
      values (${uid("msg")}, ${data.threadId}, ${context.userId}, ${body})
    `;
    const other = t.customer_id === context.userId ? t.worker_id : t.customer_id;
    await notify(sql, other, "message", "New message", body.slice(0, 80), undefined);
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      type: string;
      title: string;
      body: string;
      booking_id: string | null;
      read: boolean;
      created_at: string;
    }>`
      select id, type, title, body, booking_id, read, created_at
      from notifications where user_id = ${context.userId}
      order by created_at desc limit 40
    `;
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read = true where user_id = ${context.userId}`;
    return { ok: true };
  });

export const saveWorker = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { workerId: string; saved: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.saved) {
      await sql`insert into saved_workers (customer_id, worker_id) values (${context.userId}, ${data.workerId}) on conflict do nothing`;
    } else {
      await sql`delete from saved_workers where customer_id = ${context.userId} and worker_id = ${data.workerId}`;
    }
    return { ok: true };
  });

export const listSaved = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const ids = await sql<{ worker_id: string }>`select worker_id from saved_workers where customer_id = ${context.userId}`;
    const all = await searchWorkers({ data: {} });
    return all.filter((w) => ids.some((i) => i.worker_id === w.userId));
  });

export const reportUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into reports (id, reporter_id, target_user_id, reason)
      values (${uid("rp")}, ${context.userId}, ${data.targetUserId}, ${data.reason})
    `;
    return { ok: true };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`insert into blocks (user_id, blocked_user_id) values (${context.userId}, ${data.targetUserId}) on conflict do nothing`;
    return { ok: true };
  });

export const workerEarnings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      unit_rate: number | null;
      worker_charge: number | null;
      rate_amount: number;
      total: number;
      payment_status: string;
      status: string;
      skill_name: string;
      created_at: string;
      fee: number;
      duration_hours: number;
      rate_type: string;
    }>`
      select b.id, b.unit_rate, b.worker_charge, b.rate_amount, b.total, b.payment_status, b.status, s.name as skill_name, b.created_at, b.fee, b.duration_hours, b.rate_type
      from booking_workers bw
      join bookings b on b.id = bw.booking_id
      join skills s on s.id = b.skill_id
      where bw.worker_id = ${context.userId} and bw.status = 'completed'
      order by b.created_at desc
    `;
    const netOf = (r: {
      unit_rate: number | null;
      rate_amount: number;
      worker_charge: number | null;
      total: number;
      fee: number;
      duration_hours: number;
      rate_type: string;
    }) =>
      workerNetOf({
        unit_rate: r.unit_rate,
        rate_amount: r.rate_amount,
        worker_charge: r.worker_charge,
        total: r.total,
        fee: r.fee,
        duration_hours: r.duration_hours,
        rate_type: r.rate_type,
      });
    const payouts = await sql<{ booking_id: string; status: string; amount: number }>`
      select booking_id, status, amount from worker_payouts where worker_id = ${context.userId}
    `;
    const byBooking = new Map(payouts.map((p) => [p.booking_id, p]));
    const jobs = rows.map((r) => {
      const payout = byBooking.get(r.id);
      return {
        id: r.id,
        total: payout?.amount ?? netOf(r),
        payment_status: r.payment_status,
        payout_status: payout?.status ?? "pending",
        status: r.status,
        skill_name: r.skill_name,
        created_at: r.created_at,
        fee: r.fee,
        customer_cash: r.total,
      };
    });
    const collected = jobs.filter((r) => r.payout_status === "paid").reduce((a, r) => a + r.total, 0);
    const due = jobs.filter((r) => r.payout_status !== "paid").reduce((a, r) => a + r.total, 0);
    return { collected, due, jobs };
  });

async function requireAdmin(sql: Sql, userId: string) {
  const rows = await sql<{ is_admin: boolean }>`select is_admin from profiles where user_id = ${userId}`;
  if (!rows[0]?.is_admin) throw new Error("Admin only");
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const users = await sql<{ n: number }>`select count(*)::int as n from profiles`;
    const workers = await sql<{ n: number }>`select count(*)::int as n from workers`;
    const bookings = await sql<{ n: number }>`select count(*)::int as n from bookings`;
    const collected = await sql<{ n: number }>`select coalesce(sum(total),0)::int as n from bookings where payment_status = 'collected'`;
    const reports = await sql<{ n: number }>`select count(*)::int as n from reports`;
    const pendingKyc = await sql<{ n: number }>`
      select count(*)::int as n from worker_documents where status = ${KYC_PENDING}
    `;
    return {
      users: users[0]?.n ?? 0,
      workers: workers[0]?.n ?? 0,
      bookings: bookings[0]?.n ?? 0,
      collected: collected[0]?.n ?? 0,
      reports: reports[0]?.n ?? 0,
      pendingKyc: pendingKyc[0]?.n ?? 0,
    };
  });

export const adminListWorkers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<{
      user_id: string;
      name: string;
      phone: string;
      available: boolean;
      approved: boolean;
      suspended: boolean;
      verification_status: string;
      id_verification_status: string;
      completed_jobs: number;
    }>`
      select w.user_id, p.name, p.phone, w.available, w.approved, w.suspended,
        w.verification_status, w.id_verification_status, w.completed_jobs
      from workers w join profiles p on p.user_id = w.user_id
      order by p.name
    `;
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<ProfileRow>`select * from profiles order by created_at desc`;
  });

export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<BookingRow>`
      select b.*, s.name as skill_name, c.name as customer_name, c.phone as customer_phone,
        w.name as worker_name, wp.phone as worker_phone
      from bookings b
      join skills s on s.id = b.skill_id
      join profiles c on c.user_id = b.customer_id
      left join profiles w on w.user_id = b.worker_id
      left join profiles wp on wp.user_id = b.worker_id
      order by b.created_at desc
      limit 80
    `;
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<{
      id: string;
      reporter_id: string;
      target_user_id: string;
      reason: string;
      created_at: string;
    }>`select * from reports order by created_at desc`;
  });

export const adminSetWorker = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      userId: string;
      approved?: boolean;
      suspended?: boolean;
      verificationStatus?: string;
      idVerificationStatus?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const cur = (await sql<{
      approved: boolean;
      suspended: boolean;
      verification_status: string;
      id_verification_status: string;
    }>`select approved, suspended, verification_status, id_verification_status from workers where user_id = ${data.userId}`)[0];
    if (!cur) throw new Error("Worker not found");
    const idStatus = normalizeKycWrite(data.idVerificationStatus ?? cur.id_verification_status);
    if (isKycApproved(idStatus) && !isKycApproved(cur.id_verification_status)) {
      const docs = await sql<{ n: number }>`
        select count(*)::int as n from worker_documents
        where worker_id = ${data.userId} and (status = ${KYC_VERIFIED} or status = 'approved')
      `;
      if (!(docs[0]?.n ?? 0)) {
        throw new Error("Approve a submitted ID document before marking KYC as approved.");
      }
    }
    await sql`
      update workers set
        approved = ${data.approved ?? cur.approved},
        suspended = ${data.suspended ?? cur.suspended},
        verification_status = ${data.verificationStatus ?? cur.verification_status},
        id_verification_status = ${idStatus},
        available = case when ${idStatus} = ${KYC_VERIFIED} then available else false end
      where user_id = ${data.userId}
    `;
    return { ok: true };
  });

export const adminSuspendUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; suspended: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`update profiles set suspended = ${data.suspended} where user_id = ${data.userId}`;
    return { ok: true };
  });

export const checkPhone = createServerFn({ method: "GET" })
  .validator((d: { phone: string }) => d)
  .handler(async ({ data }) => {
    const phone = digitsPhone(data.phone);
    if (!isValidInPhone(phone)) throw new Error("Enter a valid 10-digit Indian mobile");
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from profiles where phone = ${phone}`;
    const lock = await sql<{ locked_until: string | null }>`select locked_until from phone_pins where phone = ${phone}`;
    const lockedUntil = lock[0]?.locked_until ? new Date(lock[0].locked_until).getTime() : 0;
    return { exists: (rows[0]?.n ?? 0) > 0, lockedMs: Math.max(0, lockedUntil - Date.now()) };
  });

export const notePhoneAttempt = createServerFn({ method: "POST" })
  .validator((d: { phone: string; success: boolean }) => d)
  .handler(async ({ data }) => {
    const phone = digitsPhone(data.phone);
    if (!isValidInPhone(phone)) throw new Error("Enter a valid 10-digit Indian mobile");
    const sql = await getSql();
    if (data.success) {
      await sql`
        insert into phone_pins (phone, fail_count, locked_until)
        values (${phone}, 0, null)
        on conflict (phone) do update set fail_count = 0, locked_until = null
      `;
      return { lockedMs: 0 };
    }
    const cur = await sql<{ fail_count: number; locked_until: string | null }>`
      select fail_count, locked_until from phone_pins where phone = ${phone}
    `;
    const lockedUntil = cur[0]?.locked_until ? new Date(cur[0].locked_until).getTime() : 0;
    if (lockedUntil > Date.now()) return { lockedMs: lockedUntil - Date.now() };
    const fails = (cur[0]?.fail_count ?? 0) + 1;
    const lock = fails >= 5 ? new Date(Date.now() + 60_000).toISOString() : null;
    await sql`
      insert into phone_pins (phone, fail_count, locked_until)
      values (${phone}, ${fails}, ${lock})
      on conflict (phone) do update set fail_count = ${fails}, locked_until = ${lock}
    `;
    return { lockedMs: lock ? 60_000 : 0 };
  });

export const listWorkerReviews = createServerFn({ method: "GET" })
  .validator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<{ stars: number; review: string; created_at: string; name: string }>`
      select r.stars, r.review, r.created_at, p.name
      from ratings r
      join profiles p on p.user_id = r.from_user_id
      where r.to_user_id = ${data.userId}
      order by r.created_at desc
      limit 20
    `;
  });

export const listWorkerPhotos = createServerFn({ method: "GET" })
  .validator((d: { workerId: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<{ id: string; data_url: string }>`
      select id, data_url from worker_photos where worker_id = ${data.workerId} order by created_at desc limit 8
    `;
  });

export const addWorkerPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { dataUrl: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const exists = await sql<{ n: number }>`select count(*)::int as n from workers where user_id = ${context.userId}`;
    if (!exists[0]?.n) throw new Error("Join as worker first");
    const count = await sql<{ n: number }>`select count(*)::int as n from worker_photos where worker_id = ${context.userId}`;
    if ((count[0]?.n ?? 0) >= 8) throw new Error("Maximum 8 work photos");
    if (!data.dataUrl.startsWith("data:image/")) throw new Error("Image required");
    await sql`
      insert into worker_photos (id, worker_id, data_url)
      values (${uid("ph")}, ${context.userId}, ${data.dataUrl})
    `;
    return { ok: true };
  });

export const addWorkerDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { kind: string; dataUrl: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const exists = await sql<{ n: number }>`select count(*)::int as n from workers where user_id = ${context.userId}`;
    if (!exists[0]?.n) throw new Error("Join as worker first");
    if (!data.dataUrl.startsWith("data:image/")) throw new Error("Image required");
    const kind = ID_DOCUMENT_KINDS.some((k) => k.id === data.kind) ? data.kind : "other_gov_id";
    const current = await sql<{ id_verification_status: string }>`
      select id_verification_status from workers where user_id = ${context.userId}
    `;
    await sql`
      insert into worker_documents (id, worker_id, kind, data_url, status)
      values (${uid("doc")}, ${context.userId}, ${kind}, ${data.dataUrl}, ${KYC_PENDING})
    `;
    if (!isKycApproved(current[0]?.id_verification_status)) {
      await sql`
        update workers
        set id_verification_status = ${KYC_PENDING}, available = false, updated_at = now()
        where user_id = ${context.userId}
      `;
    }
    return { ok: true, status: isKycApproved(current[0]?.id_verification_status) ? KYC_VERIFIED : KYC_PENDING };
  });

export const listMyDocuments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: string; kind: string; status: string; created_at: string }>`
      select id, kind, status, created_at from worker_documents where worker_id = ${context.userId} order by created_at desc
    `;
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.id);
    if (!row) throw new Error("Booking not found");
    const isCustomer = row.customer_id === context.userId;
    const isWorker = row.worker_id === context.userId;
    const slot = await sql<{ id: string }>`
      select id from booking_workers where booking_id = ${data.id} and worker_id = ${context.userId}
    `;
    if (!isCustomer && !isWorker && !slot[0]) throw new Error("Unauthorized");
    if (row.status === "completed" || row.status === "cancelled") throw new Error("Cannot cancel");
    const reason = data.reason.trim().slice(0, 280) || "No reason given";
    await sql`
      update bookings set status = 'cancelled', cancel_reason = ${reason}, cancelled_by = ${context.userId}, updated_at = now()
      where id = ${data.id}
    `;
    await sql`update booking_workers set status = 'cancelled' where booking_id = ${data.id} and status not in ('completed','rejected')`;
    await sql`delete from booking_live_tracks where booking_id = ${data.id}`;
    await clearLive(sql, data.id);
    const crew = await loadCrew(sql, data.id);
    for (const c of crew) {
      if (c.workerId && c.workerId !== context.userId) {
        await notify(sql, c.workerId, "booking_cancelled", "Booking cancelled", reason, data.id);
      }
    }
    if (isCustomer && row.worker_id && row.worker_id !== context.userId) {
      /* already notified via crew if assigned */
    } else if (!isCustomer) {
      await notify(sql, row.customer_id, "booking_cancelled", "Booking cancelled", reason, data.id);
    }
    return { ok: true };
  });

export const openBookingThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookingId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.bookingId);
    if (!row) throw new Error("Chat opens after a worker accepts");
    const workerId = data.workerId || row.worker_id;
    if (!workerId) throw new Error("Chat opens after a worker accepts");
    const onCrew = await sql<{ n: number }>`
      select 1 as n from booking_workers
      where booking_id = ${data.bookingId} and worker_id = ${workerId}
        and status in ('accepted','on_the_way','arrived','in_progress','completed')
      limit 1
    `;
    const allowed =
      row.customer_id === context.userId ||
      workerId === context.userId ||
      Boolean(onCrew[0]);
    if (!allowed) throw new Error("Unauthorized");
    const existing = await sql<{ id: string }>`
      select id from threads where customer_id = ${row.customer_id} and worker_id = ${workerId}
    `;
    if (existing[0]) return { id: existing[0].id };
    const id = uid("th");
    await sql`
      insert into threads (id, customer_id, worker_id, booking_id)
      values (${id}, ${row.customer_id}, ${workerId}, ${data.bookingId})
    `;
    return { id };
  });

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<{
      id: string;
      booking_id: string;
      amount: number;
      method: string;
      status: string;
      note: string;
      created_at: string;
      cash_amount: number | null;
      commission: number | null;
      worker_payout: number | null;
      payout_status: string | null;
      collected_at: string | null;
      collected_by: string | null;
      customer_id: string | null;
      worker_id: string | null;
    }>`select * from payments order by created_at desc limit 80`;
  });

export const adminListPayouts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<{
      id: string;
      booking_id: string;
      worker_id: string;
      amount: number;
      status: string;
      paid_at: string | null;
      worker_name: string | null;
      created_at: string;
    }>`
      select wp.id, wp.booking_id, wp.worker_id, wp.amount, wp.status, wp.paid_at, wp.created_at, p.name as worker_name
      from worker_payouts wp
      left join profiles p on p.user_id = wp.worker_id
      order by wp.created_at desc
      limit 80
    `;
  });

export const adminSetPayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const next = data.status === "paid" ? "paid" : "pending";
    await sql`
      update worker_payouts
      set status = ${next},
        paid_at = case when ${next} = 'paid' then now() else null end,
        paid_by = case when ${next} = 'paid' then ${context.userId} else null end
      where id = ${data.id}
    `;
    const row = await sql<{ worker_id: string; booking_id: string }>`
      select worker_id, booking_id from worker_payouts where id = ${data.id}
    `;
    if (row[0]) {
      await notify(
        sql,
        row[0].worker_id,
        "payment",
        next === "paid" ? "Payout marked paid" : "Payout pending",
        "Admin updated your payout. No automatic bank transfer.",
        row[0].booking_id,
      );
    }
    return { ok: true };
  });

export const adminMarkCashPaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookingId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`update bookings set payment_status = 'paid', updated_at = now() where id = ${data.bookingId}`;
    await sql`
      update payments set status = 'paid', collected_by = coalesce(collected_by, ${context.userId}),
        collected_at = coalesce(collected_at, now()), note = 'Admin confirmed cash payment.'
      where booking_id = ${data.bookingId}
    `;
    const booking = await loadBooking(sql, data.bookingId);
    if (booking) {
      await notify(sql, booking.customer_id, "payment", "Payment marked Paid", "Admin recorded cash as Paid. No online gateway.", data.bookingId);
      const crew = await loadCrew(sql, data.bookingId);
      for (const c of crew) {
        if (c.workerId) {
          await notify(sql, c.workerId, "payment", "Customer cash marked Paid", "Admin recorded cash. Worker payout is still separate and manual.", data.bookingId);
        }
      }
    }
    return { ok: true };
  });

export const adminListDocuments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return sql<{
      id: string;
      worker_id: string;
      kind: string;
      status: string;
      name: string;
      data_url: string;
    }>`
      select d.id, d.worker_id, d.kind, d.status, p.name, d.data_url
      from worker_documents d
      join profiles p on p.user_id = d.worker_id
      order by d.created_at desc
      limit 40
    `;
  });

export const adminSetDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; status: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const doc = await sql<{ worker_id: string }>`select worker_id from worker_documents where id = ${data.id}`;
    if (!doc[0]) throw new Error("Not found");
    const status = normalizeKycWrite(data.status) === KYC_UNVERIFIED ? KYC_PENDING : normalizeKycWrite(data.status);
    await sql`update worker_documents set status = ${status} where id = ${data.id}`;
    if (isKycApproved(status)) {
      await sql`
        update workers
        set id_verification_status = ${KYC_VERIFIED}, verification_status = ${KYC_VERIFIED}, updated_at = now()
        where user_id = ${doc[0].worker_id}
      `;
      await notify(sql, doc[0].worker_id, "kyc", "KYC Approved", "Your ID is verified. You can go available and receive bookings.");
    } else if (status === KYC_REJECTED) {
      await sql`
        update workers
        set id_verification_status = ${KYC_REJECTED}, available = false, updated_at = now()
        where user_id = ${doc[0].worker_id}
      `;
      await notify(sql, doc[0].worker_id, "kyc", "KYC Rejected", "Your ID was rejected. Please resubmit a valid government ID.");
    } else {
      await sql`
        update workers
        set id_verification_status = ${KYC_PENDING}, available = false, updated_at = now()
        where user_id = ${doc[0].worker_id}
      `;
    }
    return { ok: true, status, workerId: doc[0].worker_id };
  });

export const adminSaveSkill = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; name: string; defaultRate: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`update skills set name = ${data.name}, default_rate = ${data.defaultRate} where id = ${data.id}`;
    return { ok: true };
  });

export const pingLiveLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { bookingId: string; lat?: number; lng?: number; permission: string; accuracy?: number }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.bookingId);
    if (!row) throw new Error("Unauthorized");
    const slot = await sql<{ id: string; status: string }>`
      select id, status from booking_workers where booking_id = ${data.bookingId} and worker_id = ${context.userId}
    `;
    if (!slot[0] || !LIVE_ASSIGN.has(slot[0].status)) {
      throw new Error("Live location is only for an active booking");
    }
    const perm = ["granted", "denied", "gps_off", "unknown"].includes(data.permission)
      ? data.permission
      : "unknown";
    const sharing = perm === "granted" && data.lat != null && data.lng != null;
    const lat = sharing ? data.lat! : null;
    const lng = sharing ? data.lng! : null;
    const existing = await sql<{ lat: number | null; lng: number | null }>`
      select lat, lng from booking_live_tracks where booking_id = ${data.bookingId} and worker_id = ${context.userId}
    `;
    const keepLat = lat ?? existing[0]?.lat ?? null;
    const keepLng = lng ?? existing[0]?.lng ?? null;
    await sql`
      insert into booking_live_tracks (booking_id, worker_id, lat, lng, sharing, permission, last_seen_at, accuracy)
      values (${data.bookingId}, ${context.userId}, ${keepLat}, ${keepLng}, ${sharing}, ${perm}, now(), ${data.accuracy ?? null})
      on conflict (booking_id, worker_id) do update set
        lat = coalesce(excluded.lat, booking_live_tracks.lat),
        lng = coalesce(excluded.lng, booking_live_tracks.lng),
        sharing = excluded.sharing,
        permission = excluded.permission,
        accuracy = coalesce(excluded.accuracy, booking_live_tracks.accuracy),
        last_seen_at = case when ${sharing} then now() else booking_live_tracks.last_seen_at end
    `;
    if (row.worker_id === context.userId) {
      await sql`
        insert into booking_live_locations (booking_id, worker_id, lat, lng, sharing, permission, last_seen_at)
        values (${data.bookingId}, ${context.userId}, ${keepLat}, ${keepLng}, ${sharing}, ${perm}, now())
        on conflict (booking_id) do update set
          worker_id = excluded.worker_id,
          lat = coalesce(excluded.lat, booking_live_locations.lat),
          lng = coalesce(excluded.lng, booking_live_locations.lng),
          sharing = excluded.sharing,
          permission = excluded.permission,
          last_seen_at = case when ${sharing} then now() else booking_live_locations.last_seen_at end
      `;
    }
    if (
      sharing &&
      keepLat != null &&
      keepLng != null &&
      row.lat != null &&
      row.lng != null &&
      slot[0].status === "on_the_way"
    ) {
      const km = haversineKm(keepLat, keepLng, row.lat, row.lng);
      if (km <= 0.06) {
        await sql`
          update booking_workers
          set status = 'arrived', arrived_at = coalesce(arrived_at, now())
          where id = ${slot[0].id} and status = 'on_the_way'
        `;
        await rollupBooking(sql, data.bookingId);
        await notify(sql, row.customer_id, "booking_arrived", "Worker arrived", "GPS is at the site.", data.bookingId);
      }
    }
    return { ok: true, sharing };
  });

export const getLiveLocation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { bookingId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.bookingId);
    if (!row) return null;
    const me = (await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`)[0];
    if (!(await canSeeBooking(sql, row, context.userId, me?.is_admin ?? false))) return null;
    const crew = await loadCrew(sql, row.id);
    const tracks = await loadTracks(sql, row.id, crew);
    const mine = tracks.find((t) => t.workerId === context.userId) ?? tracks[0];
    if (!mine) {
      return {
        sharing: false,
        lat: null,
        lng: null,
        lastSeenAt: null,
        permission: LIVE_OK.has(row.status) ? "unknown" : "off",
        stale: true,
        workerId: row.worker_id,
        tracks,
      };
    }
    return {
      sharing: mine.sharing,
      lat: mine.lat,
      lng: mine.lng,
      lastSeenAt: mine.lastSeenAt,
      permission: mine.permission,
      stale: mine.stale,
      workerId: mine.workerId,
      tracks,
    };
  });

export const stopLiveLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookingId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = await loadBooking(sql, data.bookingId);
    if (!row) throw new Error("Unauthorized");
    const me = (await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`)[0];
    if (!(await canSeeBooking(sql, row, context.userId, me?.is_admin ?? false))) {
      throw new Error("Unauthorized");
    }
    await sql`
      update booking_live_tracks set sharing = false, permission = 'paused'
      where booking_id = ${data.bookingId} and worker_id = ${context.userId}
    `;
    if (row.worker_id === context.userId) {
      await sql`
        update booking_live_locations set sharing = false, permission = 'paused'
        where booking_id = ${data.bookingId} and worker_id = ${context.userId}
      `;
    }
    if (!LIVE_OK.has(row.status)) {
      await sql`delete from booking_live_tracks where booking_id = ${data.bookingId}`;
      await clearLive(sql, data.bookingId);
    }
    return { ok: true };
  });


