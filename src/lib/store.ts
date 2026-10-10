import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MARKETPLACE_JOBS, nearestForSkill, quoteFare } from "@/lib/data";
import type { HireJob, IncomingRequest, Role, WorkJob, WorkProfile } from "@/lib/types";
import { uid } from "@/lib/utils";

interface AppState {
  hydrated: boolean;
  role: Role;
  cityId: string;
  hireJobs: HireJob[];
  workProfile: WorkProfile | null;
  online: boolean;
  incoming: IncomingRequest | null;
  nextRequestAt: number | null;
  requestCursor: number;
  workJobs: WorkJob[];
  earningsToday: number;
  jobsToday: number;
  setHydrated: () => void;
  setRole: (role: Role) => void;
  setCity: (cityId: string) => void;
  book: (input: {
    categoryId: string;
    crewSize: number;
    hours: number;
    when: string;
    note: string;
    address: string;
  }) => string;
  assignHire: (jobId: string) => void;
  markOnsite: (jobId: string) => void;
  completeHire: (jobId: string, rating: number) => void;
  cancelHire: (jobId: string) => void;
  joinCrew: (profile: Omit<WorkProfile, "joinedAt">) => void;
  setOnline: (online: boolean) => void;
  spawnRequest: (now: number) => void;
  acceptIncoming: () => void;
  declineIncoming: () => void;
  markWorkOnsite: () => void;
  completeWork: () => void;
  tick: (now: number) => void;
  resetDemo: () => void;
}

const initial = {
  hydrated: false,
  role: "guest" as Role,
  cityId: "andheri",
  hireJobs: [] as HireJob[],
  workProfile: null as WorkProfile | null,
  online: false,
  incoming: null as IncomingRequest | null,
  nextRequestAt: null as number | null,
  requestCursor: 0,
  workJobs: [] as WorkJob[],
  earningsToday: 0,
  jobsToday: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,
      setHydrated: () => set({ hydrated: true }),
      setRole: (role) => set({ role }),
      setCity: (cityId) => set({ cityId }),
      book: (input) => {
        const quote = quoteFare(input.categoryId, input.hours, input.crewSize);
        const id = uid("job");
        const job: HireJob = {
          id,
          categoryId: input.categoryId,
          crewSize: input.crewSize,
          hours: input.hours,
          when: input.when,
          note: input.note,
          address: input.address,
          city: get().cityId,
          fare: quote.total,
          fee: quote.fee,
          status: "searching",
          createdAt: Date.now(),
        };
        set({ hireJobs: [job, ...get().hireJobs] });
        return id;
      },
      assignHire: (jobId) => {
        set({
          hireJobs: get().hireJobs.map((j) => {
            if (j.id !== jobId || j.status !== "searching") return j;
            const worker = nearestForSkill(j.categoryId);
            return { ...j, status: "assigned", workerId: worker.id };
          }),
        });
      },
      markOnsite: (jobId) => {
        set({
          hireJobs: get().hireJobs.map((j) =>
            j.id === jobId && j.status === "assigned" ? { ...j, status: "onsite" } : j,
          ),
        });
      },
      completeHire: (jobId, rating) => {
        set({
          hireJobs: get().hireJobs.map((j) =>
            j.id === jobId ? { ...j, status: "completed", rating } : j,
          ),
        });
      },
      cancelHire: (jobId) => {
        set({
          hireJobs: get().hireJobs.map((j) =>
            j.id === jobId ? { ...j, status: "cancelled" } : j,
          ),
        });
      },
      joinCrew: (profile) => {
        set({
          workProfile: { ...profile, joinedAt: Date.now() },
          role: "work",
        });
      },
      setOnline: (online) => {
        set({
          online,
          incoming: online ? get().incoming : null,
          nextRequestAt: online ? Date.now() + 2800 : null,
        });
      },
      spawnRequest: (now) => {
        const profile = get().workProfile;
        if (!profile) return;
        const pool = MARKETPLACE_JOBS.filter(
          (j) => profile.skillIds.length === 0 || profile.skillIds.includes(j.categoryId),
        );
        const source = (pool.length > 0 ? pool : MARKETPLACE_JOBS)[
          get().requestCursor % (pool.length > 0 ? pool.length : MARKETPLACE_JOBS.length)
        ]!;
        const quote = quoteFare(source.categoryId, source.hours, source.crewSize);
        const req: IncomingRequest = {
          id: uid("req"),
          customer: source.customer,
          categoryId: source.categoryId,
          crewSize: source.crewSize,
          hours: source.hours,
          fare: quote.total,
          distanceKm: source.distanceKm,
          address: source.address,
          note: source.note,
          createdAt: now,
          expiresAt: now + 15000,
        };
        set({
          incoming: req,
          nextRequestAt: null,
          requestCursor: get().requestCursor + 1,
        });
      },
      acceptIncoming: () => {
        const req = get().incoming;
        if (!req) return;
        const job: WorkJob = {
          id: uid("shift"),
          customer: req.customer,
          categoryId: req.categoryId,
          fare: req.fare,
          address: req.address,
          note: req.note,
          status: "enroute",
          startedAt: Date.now(),
        };
        set({
          incoming: null,
          workJobs: [job, ...get().workJobs],
          nextRequestAt: null,
        });
      },
      declineIncoming: () => {
        set({ incoming: null, nextRequestAt: Date.now() + 7000 });
      },
      markWorkOnsite: () => {
        set({
          workJobs: get().workJobs.map((j, i) =>
            i === 0 && j.status === "enroute" ? { ...j, status: "onsite" } : j,
          ),
        });
      },
      completeWork: () => {
        const current = get().workJobs.find((j) => j.status !== "completed");
        if (!current) return;
        set({
          workJobs: get().workJobs.map((j) =>
            j.id === current.id ? { ...j, status: "completed" } : j,
          ),
          earningsToday: get().earningsToday + current.fare,
          jobsToday: get().jobsToday + 1,
          nextRequestAt: get().online ? Date.now() + 5000 : null,
        });
      },
      tick: (now) => {
        const s = get();
        const searching = s.hireJobs.find((j) => j.status === "searching");
        if (searching && now - searching.createdAt > 2400) {
          get().assignHire(searching.id);
          return;
        }
        const liveWork = s.workJobs.find((j) => j.status !== "completed");
        if (
          s.online &&
          s.workProfile &&
          !s.incoming &&
          !liveWork &&
          s.nextRequestAt !== null &&
          now >= s.nextRequestAt
        ) {
          get().spawnRequest(now);
          return;
        }
        if (s.incoming && now >= s.incoming.expiresAt) {
          set({ incoming: null, nextRequestAt: now + 6000 });
        }
      },
      resetDemo: () => {
        set({
          ...initial,
          hydrated: true,
        });
      },
    }),
    {
      name: "inbook-v1",
      skipHydration: true,
      partialize: (s) => ({
        role: s.role,
        cityId: s.cityId,
        hireJobs: s.hireJobs,
        workProfile: s.workProfile,
        workJobs: s.workJobs,
        earningsToday: s.earningsToday,
        jobsToday: s.jobsToday,
        requestCursor: s.requestCursor,
      }),
    },
  ),
);
