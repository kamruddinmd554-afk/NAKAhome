import { CATALOG_SKILLS } from "@/lib/catalog";

export type VoiceFill = {
  skillIds: string[];
  experienceYears?: number;
  rateAmount?: number;
  rateType?: "hour" | "day" | "job";
  overtimeRate?: number;
  name?: string;
  location?: string;
  village?: string;
  about?: string;
  raw: string;
};

const HI_ONES: Record<string, number> = {
  zero: 0,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  gyarah: 11,
  barah: 12,
  terah: 13,
  chaudah: 14,
  pandrah: 15,
  solah: 16,
  satrah: 17,
  atharah: 18,
  unnees: 19,
  bees: 20,
  tees: 30,
  chalees: 40,
  pachaas: 50,
  saath: 60,
  sattar: 70,
  assi: 80,
  nabbe: 90,
  "एक": 1,
  "दो": 2,
  "तीन": 3,
  "चार": 4,
  "पांच": 5,
  "पाँच": 5,
  "छह": 6,
  "सात": 7,
  "आठ": 8,
  "नौ": 9,
  "दस": 10,
  "ग्यारह": 11,
  "बारह": 12,
  "पंद्रह": 15,
  "बीस": 20,
  "तीस": 30,
  "पचास": 50,
};

function asciiDigits(s: string) {
  return s.replace(/[०-९]/g, (c) => String("०१२३४५६७८९".indexOf(c)));
}

function normalize(s: string) {
  return asciiDigits(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordNumber(text: string): number | undefined {
  const m = text.match(
    /\b(nau|नौ|ek|एक|do|दो|teen|तीन|char|चार|paanch|panch|पांच|पाँच|das|दस|bees|बीस|pachaas|पचास)\s+(sau|सौ)\b/,
  );
  if (m) {
    const n = HI_ONES[m[1]!] ?? 0;
    if (n) return n * 100;
  }
  for (const [w, n] of Object.entries(HI_ONES)) {
    if (text.includes(w)) return n;
  }
  return undefined;
}

function aliasesFor(id: string, name: string, hindi: string) {
  const extra: string[] = [id.replace(/-/g, " "), id.replace(/-/g, ""), name.toLowerCase(), hindi];
  const first = name.split(/[/,]/)[0]?.trim().toLowerCase();
  if (first && first.length > 2) extra.push(first);
  if (hindi) extra.push(hindi.replace(/\s+/g, ""));
  const more: Record<string, string[]> = {
    "raj-mistri": ["rajmistri", "raj mistri", "mistri", "mason", "राजमिस्त्री", "राज मिस्त्री", "राजगीर"],
    mazdoor: ["labour", "labor", "लेबर", "मजदूर"],
    plumber: ["नलसाज", "plumber"],
    electrician: ["बिजली", "electric"],
    "sariya-fitter": ["sariya", "bar bender", "barbender", "सरिया"],
    carpenter: ["badhai", "बढ़ई"],
    painter: ["पेंटर", "painting"],
    "tile-fitter": ["tile", "टाइल"],
    jcb: ["jcb"],
    "civil-engineer": ["civil engineer", "सिविल इंजीनियर"],
  };
  return [...extra, ...(more[id] ?? [])].filter(Boolean);
}

export function parseWorkerSpeech(text: string): VoiceFill {
  const raw = text.trim();
  const n = normalize(raw);
  const fill: VoiceFill = { skillIds: [], raw };

  const hits: Array<{ id: string; score: number }> = [];
  for (const s of CATALOG_SKILLS) {
    const al = aliasesFor(s.id, s.name, s.hindi);
    let score = 0;
    for (const a of al) {
      const token = normalize(a);
      if (token.length >= 3 && n.includes(token)) score = Math.max(score, token.length);
    }
    if (score) hits.push({ id: s.id, score });
  }
  hits.sort((a, b) => b.score - a.score);
  fill.skillIds = [...new Set(hits.slice(0, 4).map((h) => h.id))];

  const yearM =
    n.match(/(\d{1,2})\s*(saal|sal|year|years|yr|yrs|साल|वर्ष)/) ||
    n.match(/(experience|anubhav|अनुभव)\s*(of|ka|की|के)?\s*(\d{1,2})/);
  if (yearM) {
    fill.experienceYears = Number(yearM[1] && /^\d+$/.test(yearM[1]) ? yearM[1] : yearM[3]);
  } else {
    const around = n.match(/(saal|साल|year).{0,12}$/) ? n : "";
    if (around) {
      const w = wordNumber(n);
      if (w && w <= 50) fill.experienceYears = w;
    }
    const hiYear = n.match(
      /(ek|do|teen|char|paanch|das|एक|दो|तीन|चार|पांच|पाँच|दस|बीस)\s*(saal|साल)/,
    );
    if (hiYear) fill.experienceYears = HI_ONES[hiYear[1]!] ?? fill.experienceYears;
  }

  const rateM = n.match(
    /(\d{2,5})\s*(rs|inr|rupee|rupees|rupaye|rupaya|₹|रुपये|रुपए|रुपये)?\s*(roz|roj|din|daily|day|per day|ghanta|hour|hr|रोज|रोज़|दिन|घंटा)?/,
  );
  const rateNear = n.match(
    /(rate|wage|dihadi|दिहाड़ी|रेट|मजदूरी)\s*(hai|is|of)?\s*(\d{2,5})/,
  );
  if (rateM) fill.rateAmount = Number(rateM[1]);
  else if (rateNear) fill.rateAmount = Number(rateNear[3]);
  else {
    const nums = [...n.matchAll(/\b(\d{3,5})\b/g)].map((m) => Number(m[1]));
    const wage = nums.find((x) => x >= 150 && x <= 20000);
    if (wage) fill.rateAmount = wage;
  }
  if (/\b(roz|roj|din|daily|day|रोज|रोज़|दिन)\b/.test(n)) fill.rateType = "day";
  else if (/\b(hour|hr|ghanta|घंटा)\b/.test(n)) fill.rateType = "hour";
  else if (/\b(job|theka|ठेका)\b/.test(n)) fill.rateType = "job";
  else if (fill.rateAmount) fill.rateType = "day";

  const ot = n.match(/(overtime|ot|ओवरटाइम)\s*(\d{2,5})/) || n.match(/(\d{2,5})\s*(overtime|ot|ओवरटाइम)/);
  if (ot) fill.overtimeRate = Number(ot[2] && /^\d+$/.test(ot[2]) ? ot[2] : ot[1]);

  const nameM = raw.match(
    /(?:mera naam|meraa naam|my name is|naam)\s+([A-Za-z\u0900-\u097F ]{2,40})/i,
  );
  if (nameM) fill.name = nameM[1]!.replace(/\b(hai|hoon|hun|is)\b/gi, "").trim();

  const locM = n.match(
    /(?:se hoon|se hun|se hu|rehta|rehti|from|in|village|gaon|गाँव|गांव|शहर)\s+([\p{L} ]{2,40})/u,
  );
  if (locM) {
    fill.location = locM[1]!.trim();
    fill.village = locM[1]!.trim();
  }

  if (fill.skillIds.length || fill.experienceYears || fill.rateAmount) {
    fill.about = raw;
  }
  return fill;
}

export function describeFill(fill: VoiceFill, hi: boolean) {
  const bits: string[] = [];
  if (fill.skillIds[0]) {
    const s = CATALOG_SKILLS.find((x) => x.id === fill.skillIds[0]);
    bits.push(hi ? `स्किल: ${s?.hindi || s?.name}` : `Skill: ${s?.name}`);
  }
  if (fill.experienceYears != null) {
    bits.push(hi ? `अनुभव: ${fill.experienceYears} साल` : `Experience: ${fill.experienceYears} years`);
  }
  if (fill.rateAmount != null) {
    bits.push(hi ? `रेट: ₹${fill.rateAmount}/${fill.rateType === "hour" ? "घंटा" : "दिन"}` : `Rate: ₹${fill.rateAmount}/${fill.rateType ?? "day"}`);
  }
  if (fill.name) bits.push(hi ? `नाम: ${fill.name}` : `Name: ${fill.name}`);
  if (fill.location) bits.push(hi ? `जगह: ${fill.location}` : `Location: ${fill.location}`);
  return bits.join(" · ");
}
