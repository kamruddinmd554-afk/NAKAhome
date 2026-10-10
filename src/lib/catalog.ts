import { quoteFromWorkerRate } from "@/lib/pricing";

export type CatalogCategory = {
  id: string;
  name: string;
  hindi: string;
  sort: number;
};

export type CatalogSkill = {
  id: string;
  categoryId: string;
  name: string;
  hindi: string;
  defaultRate: number;
  sort: number;
};

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  { id: "general", name: "General Labour", hindi: "जनरल लेबर", sort: 1 },
  { id: "masonry", name: "Masonry", hindi: "मिस्त्री काम", sort: 2 },
  { id: "rcc", name: "RCC & Structure", hindi: "आरसीसी", sort: 3 },
  { id: "finishing", name: "Flooring & Finishing", hindi: "फ्लोरिंग", sort: 4 },
  { id: "painting", name: "Painting & Interior", hindi: "पेंटिंग", sort: 5 },
  { id: "waterproof", name: "Waterproofing & Roofing", hindi: "वाटरप्रूफिंग", sort: 6 },
  { id: "mep", name: "Plumbing & Electrical", hindi: "प्लंबिंग / बिजली", sort: 7 },
  { id: "skilled", name: "Aluminium, Glass & Wood", hindi: "फिटिंग / बढ़ई", sort: 8 },
  { id: "earthwork", name: "Earthwork & Road Work", hindi: "खुदाई / रोड", sort: 9 },
  { id: "operators", name: "Machine & Equipment Operators", hindi: "ऑपरेटर", sort: 10 },
  { id: "professionals", name: "Engineering & Supervision", hindi: "इंजीनियरिंग", sort: 11 },
  { id: "contractors", name: "Contractor Services", hindi: "ठेकेदार", sort: 12 },
];

function skills(
  categoryId: string,
  rows: Array<[string, string, string, number]>,
): CatalogSkill[] {
  return rows.map(([id, name, hindi, defaultRate], i) => ({
    id,
    categoryId,
    name,
    hindi,
    defaultRate,
    sort: i + 1,
  }));
}

export const CATALOG_SKILLS: CatalogSkill[] = [
  ...skills("general", [
    ["mazdoor", "Mazdoor", "मजदूर", 700],
    ["construction-helper", "Construction Helper", "हेल्पर", 650],
    ["loading-labour", "Loading/Unloading Labour", "लोडिंग लेबर", 650],
    ["demolition-worker", "Demolition Worker", "तोड़-फोड़", 750],
    ["site-cleaning-worker", "Site Cleaning Worker", "साइट सफाई", 600],
  ]),
  ...skills("masonry", [
    ["raj-mistri", "Raj Mistri / Mason", "राज मिस्त्री", 900],
    ["brick-mason", "Brick Mason", "ईंट मिस्त्री", 850],
    ["block-mason", "Block Mason", "ब्लॉक मिस्त्री", 850],
    ["plaster-mason", "Plaster Mason", "प्लास्टर मिस्त्री", 900],
    ["stone-mason", "Stone Mason", "पत्थर मिस्त्री", 950],
    ["boundary-wall-mason", "Boundary Wall Mason", "बाउंड्री वॉल", 850],
  ]),
  ...skills("rcc", [
    ["sariya-fitter", "Sariya Fitter / Bar Bender", "सरिया फिटर", 950],
    ["shuttering-carpenter", "Shuttering Carpenter", "शटरिंग कारपेंटर", 900],
    ["shuttering-fitter", "Shuttering Fitter", "शटरिंग फिटर", 850],
    ["rcc-worker", "RCC Worker", "आरसीसी वर्कर", 800],
    ["concrete-worker", "Concrete Worker", "कंक्रीट वर्कर", 750],
    ["steel-structure-worker", "Steel Structure Worker", "स्टील स्ट्रक्चर", 1000],
    ["scaffolding-worker", "Scaffolding Worker", "स्कैफोल्डिंग", 850],
  ]),
  ...skills("finishing", [
    ["tile-fitter", "Tile Fitter", "टाइल फिटर", 900],
    ["marble-fitter", "Marble Fitter", "मार्बल फिटर", 1000],
    ["granite-fitter", "Granite Fitter", "ग्रेनाइट फिटर", 1000],
    ["flooring-worker", "Flooring Worker", "फ्लोरिंग", 850],
    ["kota-stone-worker", "Kota Stone Worker", "कोटा स्टोन", 850],
    ["polishing-worker", "Polishing Worker", "पॉलिशिंग", 800],
  ]),
  ...skills("painting", [
    ["painter", "Painter", "पेंटर", 800],
    ["wall-putty-worker", "Wall Putty Worker", "पुट्टी वर्कर", 750],
    ["pop-worker", "POP Worker", "पीओपी वर्कर", 850],
    ["gypsum-worker", "Gypsum Worker", "जिप्सम वर्कर", 850],
    ["false-ceiling-worker", "False Ceiling Worker", "फॉल्स सीलिंग", 900],
    ["texture-painter", "Texture Painter", "टेक्सचर पेंटर", 900],
  ]),
  ...skills("waterproof", [
    ["waterproofing-worker", "Waterproofing Worker", "वाटरप्रूफिंग", 900],
    ["terrace-waterproofing-worker", "Terrace Waterproofing Worker", "टेरिस वाटरप्रूफिंग", 950],
    ["roof-worker", "Roof Worker", "रूफ वर्कर", 850],
    ["roofing-sheet-fitter", "Roofing Sheet Fitter", "रूफिंग शीट", 850],
  ]),
  ...skills("mep", [
    ["plumber", "Plumber", "प्लंबर", 900],
    ["electrician", "Electrician", "इलेक्ट्रीशियन", 950],
    ["pipe-fitter", "Pipe Fitter", "पाइप फिटर", 850],
    ["drainage-worker", "Drainage Worker", "ड्रेनेज वर्कर", 800],
    ["sanitary-fitter", "Sanitary Fitter", "सैनिटरी फिटर", 900],
  ]),
  ...skills("skilled", [
    ["aluminium-fitter", "Aluminium Fitter", "एल्युमिनियम फिटर", 950],
    ["glass-fitter", "Glass Fitter", "ग्लास फिटर", 900],
    ["upvc-fitter", "UPVC Fitter", "यूपीवीसी फिटर", 900],
    ["carpenter", "Carpenter", "बढ़ई", 900],
    ["door-window-fitter", "Door/Window Fitter", "डोर / विंडो फिटर", 850],
  ]),
  ...skills("earthwork", [
    ["excavation", "Excavation Worker", "खुदाई वर्कर", 750],
    ["earthwork-labour", "Earthwork Labour", "अर्थवर्क लेबर", 700],
    ["road-worker", "Road Worker", "रोड वर्कर", 750],
    ["paver-block-fitter", "Paver Block Fitter", "पेवर ब्लॉक", 800],
    ["kerb-stone-fitter", "Kerb Stone Fitter", "कर्ब स्टोन", 800],
    ["drain-construction-worker", "Drain Construction Worker", "ड्रेन कंस्ट्रक्शन", 800],
  ]),
  ...skills("operators", [
    ["jcb", "JCB Operator", "जेसीबी ऑपरेटर", 1500],
    ["excavator-operator", "Excavator Operator", "एक्सकेवेटर ऑपरेटर", 1600],
    ["crane-operator", "Crane Operator", "क्रेन ऑपरेटर", 1800],
    ["loader-operator", "Loader Operator", "लोडर ऑपरेटर", 1400],
    ["tractor-operator", "Tractor Operator", "ट्रैक्टर ऑपरेटर", 1200],
    ["dumper-truck-driver", "Dumper/Truck Driver", "डम्पर / ट्रक ड्राइवर", 1200],
    ["concrete-mixer-operator", "Concrete Mixer Operator", "मिक्सर ऑपरेटर", 1100],
  ]),
  ...skills("professionals", [
    ["civil-engineer", "Civil Engineer", "सिविल इंजीनियर", 2500],
    ["site-engineer", "Site Engineer", "साइट इंजीनियर", 2000],
    ["site-supervisor", "Site Supervisor", "साइट सुपरवाइजर", 1500],
    ["architect", "Architect", "आर्किटेक्ट", 3000],
    ["quantity-surveyor", "Quantity Surveyor", "क्वांटिटी सर्वेयर", 2200],
    ["land-surveyor", "Land Surveyor", "लैंड सर्वेयर", 1800],
  ]),
  ...skills("contractors", [
    ["civil-contractor", "Civil Contractor", "सिविल ठेकेदार", 0],
    ["rcc-contractor", "RCC Contractor", "आरसीसी ठेकेदार", 0],
    ["shuttering-contractor", "Shuttering Contractor", "शटरिंग ठेकेदार", 0],
    ["mason-contractor", "Mason Contractor", "मिस्त्री ठेकेदार", 0],
    ["painting-contractor", "Painting Contractor", "पेंटिंग ठेकेदार", 0],
    ["tile-marble-contractor", "Tile/Marble Contractor", "टाइल / मार्बल ठेकेदार", 0],
    ["waterproofing-contractor", "Waterproofing Contractor", "वाटरप्रूफिंग ठेकेदार", 0],
    ["road-contractor", "Road Contractor", "रोड ठेकेदार", 0],
  ]),
];

export function skillById(id: string): CatalogSkill | undefined {
  return CATALOG_SKILLS.find((s) => s.id === id);
}

export function quoteTotal(
  rateAmount: number,
  rateType: string,
  hours: number,
  crewSize: number,
) {
  try {
    return quoteFromWorkerRate(rateAmount, rateType, hours, crewSize);
  } catch {
    return null;
  }
}
