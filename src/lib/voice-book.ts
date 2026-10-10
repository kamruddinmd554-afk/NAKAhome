import { CATALOG_SKILLS } from "@/lib/catalog";

export type BookDraft = {
  skillId?: string;
  skillName?: string;
  location?: string;
  lat?: number;
  lng?: number;
  date?: string;
  time?: string;
  crewSize?: number;
  hours?: number;
  rateType?: "hour" | "day" | "job";
  raw: string;
};

const HI_NUM: Record<string, number> = {
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
};

const AREAS: Array<{ name: string; aliases: string[]; lat: number; lng: number; label: string }> = [
  { name: "chembur", aliases: ["chembur", "चेंबूर", "चेम्बुर"], lat: 19.0622, lng: 72.901, label: "Chembur, Mumbai" },
  { name: "andheri", aliases: ["andheri", "अंधेरी"], lat: 19.136, lng: 72.829, label: "Andheri West, Mumbai" },
  { name: "bandra", aliases: ["bandra", "बांद्रा"], lat: 19.06, lng: 72.83, label: "Bandra West, Mumbai" },
  { name: "goregaon", aliases: ["goregaon", "गोरेगाव"], lat: 19.166, lng: 72.852, label: "Goregaon, Mumbai" },
  { name: "dadar", aliases: ["dadar", "दादर"], lat: 19.018, lng: 72.844, label: "Dadar, Mumbai" },
  { name: "thane", aliases: ["thane", "ठाणे"], lat: 19.218, lng: 72.978, label: "Thane" },
  { name: "kothrud", aliases: ["kothrud", "कोथरुड"], lat: 18.507, lng: 73.807, label: "Kothrud, Pune" },
  { name: "pune", aliases: ["pune", "पुणे"], lat: 18.52, lng: 73.856, label: "Pune" },
  { name: "noida", aliases: ["noida", "नोएडा"], lat: 28.535, lng: 77.391, label: "Noida" },
  { name: "mumbai", aliases: ["mumbai", "bombay", "मुंबई"], lat: 19.076, lng: 72.877, label: "Mumbai" },
];

function asciiDigits(s: string) {
  return s.replace(/[०-९]/g, (c) => String("०१२३४५६७८९".indexOf(c)));
}

function normalize(s: string) {
  return asciiDigits(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ymd(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function padTime(h: number, m = 0) {
  const hh = Math.min(23, Math.max(0, h));
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function skillAliases(id: string, name: string, hindi: string) {
  const extra = [id.replace(/-/g, " "), name.toLowerCase(), hindi];
  const first = name.split(/[/,]/)[0]?.trim().toLowerCase();
  if (first) extra.push(first);
  const more: Record<string, string[]> = {
    "raj-mistri": ["rajmistri", "raj mistri", "mistri", "mason", "मिस्त्री", "राजमिस्त्री", "राज मिस्त्री", "राजगीर"],
    "plaster-mason": ["plaster", "प्लास्टर", "plaster wale", "प्लास्टर वाले", "प्लास्टर वाले मजदूर"],
    mazdoor: ["labour", "labor", "lebar", "लेबर", "मजदूर", "mazdoor"],
    "construction-helper": ["helper", "हेल्पर"],
    plumber: ["plumber", "नलसाज"],
    electrician: ["electrician", "बिजली"],
    painter: ["painter", "पेंटर"],
    "tile-fitter": ["tile", "टाइल"],
    "sariya-fitter": ["sariya", "सरिया"],
  };
  return [...extra, ...(more[id] ?? [])].filter(Boolean);
}

function parseSkill(n: string): { id: string; name: string } | undefined {
  const hits: Array<{ id: string; name: string; score: number }> = [];
  for (const s of CATALOG_SKILLS) {
    let score = 0;
    for (const a of skillAliases(s.id, s.name, s.hindi)) {
      const token = normalize(a);
      if (token.length >= 3 && n.includes(token)) score = Math.max(score, token.length);
    }
    if (score) hits.push({ id: s.id, name: s.name, score });
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits[0];
  if (!top) {
    if (/\b(mistri|मिस्त्री|mason)\b/.test(n)) {
      const s = CATALOG_SKILLS.find((x) => x.id === "raj-mistri");
      if (s) return { id: s.id, name: s.name };
    }
    return undefined;
  }
  return { id: top.id, name: top.name };
}

function parseCrew(n: string): number | undefined {
  const stripped = n
    .replace(/\b(subah|subha|सुबह|morning|shaam|sham|शाम|dopahar|दोपहर)\s*\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}\s*(baje|bajee|बजे|:00|am|pm|a m|p m)\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const trade = stripped.match(
    /\b(\d{1,2}|ek|do|teen|char|paanch|panch|das|एक|दो|तीन|चार|पांच|पाँच|दस)\s*(राजमिस्त्री|राज मिस्त्री|मिस्त्री|मजदूर|लेबर|प्लास्टर|labour|labor|lebar|mazdoor|mistri|mason|workers?|helper|हेल्पर|वर्कर)/,
  );
  if (trade) {
    const raw = trade[1] ?? "";
    const nCrew = HI_NUM[raw] ?? Number(raw);
    if (nCrew >= 1 && nCrew <= 40) return nCrew;
  }
  const digit = stripped.match(/\b(\d{1,2})\b/);
  if (digit) {
    const nCrew = Number(digit[1]);
    if (nCrew >= 1 && nCrew <= 40) return nCrew;
  }
  const word = stripped.match(/\b(ek|do|teen|char|paanch|panch|das|एक|दो|तीन|चार|पांच|पाँच|दस)\b/);
  if (word) return HI_NUM[word[1]!] ?? undefined;
  return undefined;
}

export function parseBookingSpeech(text: string, previous?: BookDraft): BookDraft {
  const raw = text.trim();
  const n = normalize(raw);
  const fill: BookDraft = { ...(previous ?? {}), raw: [previous?.raw, raw].filter(Boolean).join(" | ") };

  if (/\b(kal|कल|tomorrow)\b/.test(n)) fill.date = ymd(1);
  else if (/\b(aaj|आज|today)\b/.test(n)) fill.date = ymd(0);
  else if (/\b(parson|परसों|day after)\b/.test(n)) fill.date = ymd(2);

  const clock = n.match(/\b(\d{1,2}):(\d{2})\b/);
  const baje = n.match(/\b(\d{1,2})\s*(baje|bajee|बजे)\b/);
  const morning = n.match(/\b(subah|subha|सुबह|morning)\s*(\d{1,2})\b/) || n.match(/\b(\d{1,2})\s*(am|a m)\b/);
  const evening = n.match(/\b(shaam|sham|शाम|evening|raat|रात)\s*(\d{1,2})\b/) || n.match(/\b(\d{1,2})\s*(pm|p m)\b/);
  const noon = n.match(/\b(dopahar|dophar|दोपहर|afternoon)\s*(\d{1,2})\b/);
  if (clock) fill.time = padTime(Number(clock[1]), Number(clock[2]));
  else if (evening) {
    let h = Number(evening[2] ?? evening[1]);
    if (h < 12) h += 12;
    fill.time = padTime(h);
  } else if (noon) {
    const nh = Number(noon[2]);
    fill.time = padTime(nh === 12 ? 12 : nh < 12 ? nh + 12 : nh);
  } else if (morning) fill.time = padTime(Number(morning[2] ?? morning[1]));
  else if (baje) {
    const h = Number(baje[1]);
    const dusk = /\b(shaam|sham|शाम|raat|रात|evening|night)\b/.test(n);
    fill.time = padTime(dusk && h < 12 ? h + 12 : h);
  }

  if (/\b(poore din|poora din|full day|fullday|पूरे दिन|पूरा दिन|whole day)\b/.test(n)) {
    fill.hours = 8;
    fill.rateType = "day";
  }
  const hourM = n.match(/\b(\d{1,2})\s*(ghante|ghanta|hours?|hrs?|घंटे|घंटा)\b/);
  if (hourM) {
    fill.hours = Number(hourM[1]);
    if (fill.hours !== 8) fill.rateType = fill.rateType ?? "hour";
  }

  const crew = parseCrew(n);
  if (crew) fill.crewSize = crew;

  const skill = parseSkill(n);
  if (skill) {
    fill.skillId = skill.id;
    fill.skillName = skill.name;
  }

  for (const a of AREAS) {
    if (a.aliases.some((al) => n.includes(normalize(al)))) {
      fill.location = a.label;
      fill.lat = a.lat;
      fill.lng = a.lng;
      break;
    }
  }
  if (!fill.location) {
    const loc = n.match(/\b(?:mein|me|में|in|at)\s+([\p{L}]{3,24})\b/u);
    if (loc && !/kal|aaj|subah|shaam|baje|liye|चाहिए/.test(loc[1]!)) {
      fill.location = loc[1];
    }
  }

  return fill;
}

export function missingBookingFields(d: BookDraft): Array<keyof BookDraft> {
  const need: Array<keyof BookDraft> = [];
  if (!d.skillId) need.push("skillId");
  if (!d.location) need.push("location");
  if (!d.date) need.push("date");
  if (!d.time) need.push("time");
  if (!d.crewSize) need.push("crewSize");
  if (!d.hours) need.push("hours");
  return need;
}

export function nextBookingPrompt(d: BookDraft, hi: boolean): string | null {
  const miss = missingBookingFields(d);
  const first = miss[0];
  if (!first) return null;
  const hiQ: Record<string, string> = {
    skillId: "कौन सा काम चाहिए? जैसे राजमिस्त्री, लेबर, प्लास्टर।",
    location: "किस जगह चाहिए?",
    date: "किस तारीख को चाहिए?",
    time: "कितने बजे से चाहिए?",
    crewSize: "कितने वर्कर चाहिए?",
    hours: "कितने घंटे या पूरा दिन?",
  };
  const enQ: Record<string, string> = {
    skillId: "Which trade do you need?",
    location: "Where is the site?",
    date: "Which date?",
    time: "What start time?",
    crewSize: "How many workers?",
    hours: "Full day or how many hours?",
  };
  return hi ? hiQ[first]! : enQ[first]!;
}

export function formatDraftTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hour = h ?? 0;
  const am = hour < 12;
  const h12 = hour % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}
