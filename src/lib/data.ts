import type { Category, City, CrewMember } from "@/lib/types";

export const CITIES: City[] = [
  { id: "andheri", name: "Andheri West", area: "Mumbai", lat: 19.136, lng: 72.829 },
  { id: "bandra", name: "Bandra West", area: "Mumbai", lat: 19.06, lng: 72.83 },
  { id: "goregaon", name: "Goregaon", area: "Mumbai", lat: 19.166, lng: 72.852 },
  { id: "kothrud", name: "Kothrud", area: "Pune", lat: 18.507, lng: 73.807 },
  { id: "sector62", name: "Sector 62", area: "Noida", lat: 28.535, lng: 77.391 },
];

export const CATEGORIES: Category[] = [
  { id: "helper", name: "Mazdoor", hindi: "Helper", blurb: "General civil labour on site", rate: 180 },
  { id: "mason", name: "Raj mistri", hindi: "Mason", blurb: "Brick, block, plaster", rate: 280 },
  { id: "steel", name: "Bar bender", hindi: "Steel", blurb: "TMT, stirrups, binding", rate: 320 },
  { id: "shutter", name: "Shuttering", hindi: "Centering", blurb: "Formwork and props", rate: 300 },
  { id: "tile", name: "Tiler", hindi: "Tile mistri", blurb: "Floor and wall tile", rate: 300 },
  { id: "paint", name: "Painter", hindi: "Painter", blurb: "Putty, paint, polish", rate: 260 },
  { id: "weld", name: "Welder", hindi: "Welder", blurb: "Grill, gate, steel", rate: 340 },
  { id: "load", name: "Loader", hindi: "Loading", blurb: "Material load and shift", rate: 200 },
];

export const CREW: CrewMember[] = [
  { id: "w1", name: "Rakesh Yadav", skillId: "mason", rating: 4.86, jobs: 412, rate: 280, etaMin: 6, distanceKm: 0.7, verified: true, x: 28, y: 30, years: 12 },
  { id: "w2", name: "Santosh More", skillId: "helper", rating: 4.71, jobs: 730, rate: 180, etaMin: 5, distanceKm: 0.6, verified: true, x: 84, y: 32, years: 4 },
  { id: "w3", name: "Imran Shaikh", skillId: "steel", rating: 4.9, jobs: 298, rate: 330, etaMin: 8, distanceKm: 1.1, verified: true, x: 68, y: 24, years: 9 },
  { id: "w4", name: "Vikram Singh", skillId: "shutter", rating: 4.81, jobs: 344, rate: 310, etaMin: 9, distanceKm: 1.3, verified: true, x: 22, y: 70, years: 14 },
  { id: "w5", name: "Deepak Tiwari", skillId: "tile", rating: 4.84, jobs: 276, rate: 300, etaMin: 10, distanceKm: 1.4, verified: true, x: 36, y: 80, years: 9 },
  { id: "w6", name: "Suresh Pawar", skillId: "paint", rating: 4.74, jobs: 267, rate: 250, etaMin: 11, distanceKm: 1.6, verified: true, x: 44, y: 62, years: 8 },
  { id: "w7", name: "Farhan Ali", skillId: "weld", rating: 4.69, jobs: 198, rate: 340, etaMin: 13, distanceKm: 2.0, verified: true, x: 16, y: 44, years: 6 },
  { id: "w8", name: "Ajay Verma", skillId: "load", rating: 4.77, jobs: 512, rate: 200, etaMin: 4, distanceKm: 0.5, verified: true, x: 58, y: 36, years: 5 },
  { id: "w9", name: "Manoj Kumar", skillId: "mason", rating: 4.88, jobs: 401, rate: 290, etaMin: 7, distanceKm: 0.9, verified: true, x: 80, y: 72, years: 10 },
  { id: "w10", name: "Lakshmi Devi", skillId: "helper", rating: 4.91, jobs: 621, rate: 190, etaMin: 5, distanceKm: 0.4, verified: true, x: 72, y: 48, years: 7 },
  { id: "w11", name: "Naveen Reddy", skillId: "steel", rating: 4.83, jobs: 309, rate: 320, etaMin: 9, distanceKm: 1.2, verified: true, x: 64, y: 78, years: 8 },
  { id: "w12", name: "Prakash Jha", skillId: "shutter", rating: 4.78, jobs: 221, rate: 300, etaMin: 12, distanceKm: 1.7, verified: true, x: 50, y: 18, years: 11 },
];

export const ADDRESSES = [
  "Plot 14, New Link Road, DN Nagar",
  "B-32, Lokhandwala site, Wing C",
  "Gate 2, Versova civil works",
  "Infinity Mall service lane plot",
  "Plot 9, SV Road, opposite depot",
];

export const MARKETPLACE_JOBS: Array<{
  customer: string;
  categoryId: string;
  crewSize: number;
  hours: number;
  note: string;
  address: string;
  distanceKm: number;
}> = [
  {
    customer: "Mehta Builders",
    categoryId: "mason",
    crewSize: 3,
    hours: 8,
    note: "Plaster the west wall and set door frames.",
    address: "Site 4, Link Road junction",
    distanceKm: 0.9,
  },
  {
    customer: "Sana Apartments",
    categoryId: "helper",
    crewSize: 4,
    hours: 8,
    note: "Site debris shift, mixing, and loading.",
    address: "Wing C basement, Juhu Scheme",
    distanceKm: 1.4,
  },
  {
    customer: "Patel Residence",
    categoryId: "steel",
    crewSize: 2,
    hours: 8,
    note: "Slab steel for first floor. 12mm TMT on site.",
    address: "12, Green Park, 4 Bungalows",
    distanceKm: 0.6,
  },
  {
    customer: "West Ward Society",
    categoryId: "shutter",
    crewSize: 3,
    hours: 8,
    note: "Centering for staircase landing.",
    address: "Society plot, SV Road",
    distanceKm: 1.1,
  },
  {
    customer: "Khan Warehouse",
    categoryId: "load",
    crewSize: 4,
    hours: 4,
    note: "Unload cement bags from tempo. Ground floor.",
    address: "Yard B, behind metro depot",
    distanceKm: 1.8,
  },
];

export function categoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;
}

export function crewById(id: string) {
  return CREW.find((w) => w.id === id);
}

export function cityById(id: string) {
  return CITIES.find((c) => c.id === id) ?? CITIES[0]!;
}

export function crewForSkill(skillId: string) {
  const matched = CREW.filter((w) => w.skillId === skillId);
  return matched.length > 0 ? matched : CREW;
}

export function nearestForSkill(skillId: string) {
  return [...crewForSkill(skillId)].sort((a, b) => a.etaMin - b.etaMin)[0]!;
}

export function quoteFare(categoryId: string, hours: number, crewSize: number) {
  const rate = categoryById(categoryId).rate;
  const sub = rate * hours * crewSize;
  const fee = Math.round(sub * 0.08);
  return { sub, fee, total: sub + fee, rate };
}

export const USER_POS = { x: 50, y: 54 };
