export type Role = "guest" | "hire" | "work";

export type HireStatus = "searching" | "assigned" | "onsite" | "completed" | "cancelled";

export type WorkJobStatus = "enroute" | "onsite" | "completed";

export interface Category {
  id: string;
  name: string;
  hindi: string;
  blurb: string;
  rate: number;
}

export interface City {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
}

export interface CrewMember {
  id: string;
  name: string;
  skillId: string;
  rating: number;
  jobs: number;
  rate: number;
  etaMin: number;
  distanceKm: number;
  verified: boolean;
  x: number;
  y: number;
  years: number;
}

export interface HireJob {
  id: string;
  categoryId: string;
  crewSize: number;
  hours: number;
  when: string;
  note: string;
  address: string;
  city: string;
  fare: number;
  fee: number;
  status: HireStatus;
  workerId?: string;
  createdAt: number;
  rating?: number;
}

export interface WorkProfile {
  name: string;
  phone: string;
  skillIds: string[];
  rate: number;
  city: string;
  joinedAt: number;
}

export interface IncomingRequest {
  id: string;
  customer: string;
  categoryId: string;
  crewSize: number;
  hours: number;
  fare: number;
  distanceKm: number;
  address: string;
  note: string;
  createdAt: number;
  expiresAt: number;
}

export interface WorkJob {
  id: string;
  customer: string;
  categoryId: string;
  fare: number;
  address: string;
  note: string;
  status: WorkJobStatus;
  startedAt: number;
}
