import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProposeSkill, SkillPicker } from "@/components/skill-picker";
import { Logo } from "@/components/logo";
import { MicButton } from "@/components/mic-button";
import { PhotoPicker } from "@/components/photo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG_SKILLS } from "@/lib/catalog";
import { ID_DOCUMENT_KINDS, KYC_PUBLIC_MESSAGE, KYC_PUBLIC_MESSAGE_HI, isKycApproved } from "@/lib/kyc";
import { readDeviceLocation } from "@/lib/geo";
import { speakGuide, stopSpeech } from "@/lib/speech";
import {
  addWorkerDocument,
  saveWorkerProfile,
  updateProfile,
} from "@/lib/server/inbook";
import { describeFill, parseWorkerSpeech } from "@/lib/voice-parse";
import { cn, formatInPhone, inr, isValidInPhone } from "@/lib/utils";

export type JoinInitial = {
  name?: string;
  phone?: string;
  phoneVerified?: boolean;
  about?: string;
  experienceYears?: number;
  locationLabel?: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  rateAmount?: number;
  rateType?: "hour" | "day" | "job";
  skillIds?: string[];
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
  emergencyName?: string;
  emergencyPhone?: string;
  locale?: string;
  available?: boolean;
  idVerificationStatus?: string;
};

const STEPS = 8;

export function JoinWorker({
  initial,
  onDone,
}: {
  initial?: JoinInitial;
  onDone: () => void;
}) {
  const [hi, setHi] = useState(initial?.locale === "hi");
  const lang = hi ? "hi-IN" : "en-IN";
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [dob, setDob] = useState(initial?.dateOfBirth ?? "");
  const [age, setAge] = useState(initial?.ageYears ?? 0);
  const [about, setAbout] = useState(initial?.about ?? "");
  const [years, setYears] = useState(initial?.experienceYears ?? 0);
  const [village, setVillage] = useState(initial?.village ?? "");
  const [cityArea, setCityArea] = useState(initial?.cityArea ?? "");
  const [location, setLocation] = useState(initial?.locationLabel ?? "");
  const [radius, setRadius] = useState(initial?.radiusKm ?? 10);
  const [rate, setRate] = useState(initial?.rateAmount ?? 900);
  const [rateType, setRateType] = useState<"hour" | "day" | "job">(initial?.rateType ?? "day");
  const [overtime, setOvertime] = useState(initial?.overtimeRate ?? 0);
  const [avail, setAvail] = useState(initial?.availabilityNote ?? "daily");
  const [skills, setSkills] = useState<string[]>(initial?.skillIds ?? []);
  const [pendingSkills, setPendingSkills] = useState<Array<{ id: string; name: string; status?: string }>>([]);
  const [photo, setPhoto] = useState<string | null>(initial?.photoData ?? null);
  const [kyc, setKyc] = useState<string | null>(null);
  const [kycKind, setKycKind] = useState<string>("aadhaar");
  const [insurance, setInsurance] = useState(initial?.insuranceStatus ?? "none");
  const [insuranceNote, setInsuranceNote] = useState(initial?.insuranceNote ?? "");
  const [emName, setEmName] = useState(initial?.emergencyName ?? "");
  const [emPhone, setEmPhone] = useState(initial?.emergencyPhone ?? "");
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);
  const [busy, setBusy] = useState(false);
  const [goAvailable, setGoAvailable] = useState(
    Boolean(initial?.available) && isKycApproved(initial?.idVerificationStatus),
  );

  const t = hi
    ? {
        brand: "सिविल लेबर",
        titles: ["बोलकर भरो", "फोटो", "आपकी जानकारी", "जगह", "आपका काम", "रोज़ाना रेट", "और जानकारी", "प्रोफ़ाइल देखें"],
        speakAll: "माइक दबाएँ और बोलें",
        example: "उदाहरण: मैं राजमिस्त्री हूँ, 10 साल का अनुभव है, मेरा रेट 900 रुपये रोज़ है",
        typeInstead: "टाइप करके भरें",
        takePhoto: "फोटो",
        name: "पूरा नाम",
        mobile: "मोबाइल",
        age: "उम्र",
        dob: "जन्म तारीख",
        gender: "लिंग",
        male: "पुरुष",
        female: "महिला",
        other: "अन्य",
        village: "गाँव / इलाका",
        city: "शहर",
        area: "सेवा क्षेत्र",
        radius: "सेवा दूरी (किमी)",
        gps: "अभी की लोकेशन",
        trades: "अपना काम चुनें",
        daily: "मेरा रोज़ाना रेट",
        overtime: "ओवरटाइम रेट",
        years: "अनुभव (साल)",
        avail: "उपलब्धता",
        about: "अपने काम के बारे में",
        emergency: "इमरजेंसी संपर्क",
        kyc: "पहचान पत्र (KYC)",
        kycRule: KYC_PUBLIC_MESSAGE_HI,
        kycHelp: "आधार या कोई अन्य सरकारी आईडी अपलोड करें। एडमिन अप्रूव के बाद ही प्रोफ़ाइल पब्लिक होगी।",
        insurance: "बीमा",
        none: "नहीं",
        yes: "हाँ",
        pending: "लगवा रहे हैं",
        back: "वापस",
        next: "आगे",
        publish: "प्रोफ़ाइल पब्लिश करें",
        confirm: "यह जानकारी सही है। पब्लिश करें।",
        goOn: "पब्लिश के बाद उपलब्ध रहें",
      }
    : {
        brand: "Civil labour",
        titles: ["Speak to fill", "Photo", "Your details", "Location", "Your trade", "My daily rate", "More details", "Review profile"],
        speakAll: "Tap the mic and speak",
        example: "Example: Main rajmistri hoon, 10 saal ka experience hai, mera rate 900 rupaye roz hai",
        typeInstead: "Fill by typing",
        takePhoto: "Photo",
        name: "Full name",
        mobile: "Mobile",
        age: "Age",
        dob: "Date of birth",
        gender: "Gender",
        male: "Male",
        female: "Female",
        other: "Other",
        village: "Village / area",
        city: "City",
        area: "Service area",
        radius: "Service radius (km)",
        gps: "Use current location",
        trades: "Select your trades",
        daily: "My daily rate",
        overtime: "Overtime rate",
        years: "Experience (years)",
        avail: "Availability",
        about: "About your work",
        emergency: "Emergency contact",
        kyc: "ID document (KYC)",
        kycRule: KYC_PUBLIC_MESSAGE,
        kycHelp: "Upload Aadhaar or another government-issued ID. Your profile stays private until an admin approves it.",
        insurance: "Insurance",
        none: "None",
        yes: "Yes",
        pending: "Applying",
        back: "Back",
        next: "Continue",
        publish: "Publish profile",
        confirm: "This looks correct. Publish my profile.",
        goOn: "Go available after publishing",
      };

  useEffect(() => {
    if (step !== 0) return;
    speakGuide(
      hi
        ? "माइक दबाकर बोलें। अपना काम, अनुभव और रोज़ाना रेट बताएँ।"
        : "Tap the microphone and say your trade, years of experience, and daily rate.",
      lang,
    );
    return () => stopSpeech();
  }, [step, hi, lang]);

  function applySpeech(text: string) {
    const fill = parseWorkerSpeech(text);
    if (fill.name) setName(fill.name);
    if (fill.location) {
      setLocation((v) => v || fill.location || "");
      setVillage((v) => v || fill.village || "");
    }
    if (fill.skillIds.length) {
      setSkills((c) => [...new Set([...c, ...fill.skillIds])]);
    }
    if (fill.experienceYears != null) setYears(fill.experienceYears);
    if (fill.rateAmount != null) setRate(fill.rateAmount);
    if (fill.rateType) setRateType(fill.rateType);
    if (fill.overtimeRate != null) setOvertime(fill.overtimeRate);
    if (fill.about) setAbout((v) => v || fill.about || "");
    const summary = describeFill(fill, hi);
    toast(summary || (hi ? "सुन लिया। फिर से बोलें या टाइप करें।" : "Heard. Speak again or type."));
  }

  function toggle(id: string) {
    setSkills((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function areaLabel() {
    return [village, cityArea, location].filter(Boolean).join(", ");
  }

  async function publish() {
    if (name.trim().length < 2) {
      toast(hi ? "नाम लिखें" : "Enter your name");
      return;
    }
    if (!isValidInPhone(phone)) {
      toast(hi ? "सही 10 अंकों का मोबाइल डालें" : "Enter a valid 10-digit Indian mobile");
      return;
    }
    if (skills.length === 0) {
      toast(hi ? "कम से कम एक काम चुनें" : "Select at least one trade");
      return;
    }
    setBusy(true);
    try {
      const loc = areaLabel();
      await updateProfile({
        data: {
          name: name.trim(),
          phone: phone.replace(/\D/g, "").slice(-10),
          activeMode: "worker",
          locationLabel: loc,
          lat,
          lng,
          locale: hi ? "hi" : "en",
          emergencyName: emName.trim(),
          emergencyPhone: emPhone.replace(/\D/g, "").slice(-10),
        },
      });
      await saveWorkerProfile({
        data: {
          about,
          experienceYears: years,
          locationLabel: loc,
          lat,
          lng,
          radiusKm: radius,
          rateAmount: rate,
          rateType,
          skillIds: skills,
          photoData: photo,
          gender,
          dateOfBirth: dob,
          ageYears: age,
          village,
          cityArea,
          overtimeRate: overtime,
          insuranceStatus: insurance,
          insuranceNote,
          availabilityNote: avail,
          available: goAvailable,
        },
      });
      if (kyc) {
        await addWorkerDocument({ data: { kind: kycKind, dataUrl: kyc } });
      }
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save profile");
      setBusy(false);
    }
  }

  const canNext =
    step === 0 ||
    step === 1 ||
    (step === 2 && name.trim().length >= 2 && isValidInPhone(phone)) ||
    step === 3 ||
    (step === 4 && skills.length > 0) ||
    (step === 5 && rate >= 50) ||
    step === 6;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-bg px-5 py-8 text-fg">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <button
          type="button"
          className="h-10 rounded-full bg-raised px-3 text-xs font-medium"
          onClick={() => setHi((v) => !v)}
        >
          {hi ? "English" : "हिन्दी"}
        </button>
      </div>
      <p className="mt-8 text-xs font-medium tracking-wide text-muted">{t.brand}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{t.titles[step]}</h1>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: STEPS }).map((_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-line")} />
        ))}
      </div>

      <div className="mt-6 flex-1">
        {step === 0 ? (
          <div className="flex flex-col items-center gap-5 pt-4">
            <p className="text-center text-sm leading-relaxed text-muted">{t.example}</p>
            <MicButton lang={lang} size="lg" label={t.speakAll} onText={applySpeech} />
            <p className="text-xs text-muted">
              {hi ? "हिन्दी या English में बोलें।" : "Speak in Hindi or English."}
            </p>
            <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
              {t.typeInstead}
            </Button>
            <Button className="w-full" onClick={() => setStep(1)}>
              {t.next}
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <PhotoPicker value={photo} onChange={setPhoto} hi={hi} />
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <Field label={t.name} value={name} onChange={setName} lang={lang} onSpeech={applySpeech} />
            <div className="flex flex-col gap-1.5">
              <Label>{t.mobile}</Label>
              <div className="flex gap-2">
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
                <MicButton lang={lang} onText={applySpeech} />
              </div>
              {phone ? <p className="text-xs text-muted">{formatInPhone(phone)}</p> : null}
              {initial?.phoneVerified ? (
                <p className="text-xs text-good">{hi ? "मोबाइल वेरिफाइड" : "Mobile verified"}</p>
              ) : (
                <p className="text-xs text-muted">
                  {hi
                    ? "बुकिंग कॉल इसी नंबर पर जाएँगे। अकाउंट से OTP वेरिफाई करें।"
                    : "Job calls use this number. Verify with OTP from Account if you have not."}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t.age}</Label>
                <Input
                  type="number"
                  min={18}
                  max={80}
                  value={age || ""}
                  onChange={(e) => setAge(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t.dob}</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm">{t.gender}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["male", t.male],
                  ["female", t.female],
                  ["other", t.other],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setGender(id)}
                    className={cn(
                      "h-14 rounded-2xl text-sm font-medium",
                      gender === id ? "bg-accent text-accent-fg" : "bg-surface shadow-[var(--shadow-border)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <Field label={t.village} value={village} onChange={setVillage} lang={lang} onSpeech={applySpeech} placeholder="Andheri / गाँव" />
            <Field label={t.city} value={cityArea} onChange={setCityArea} lang={lang} onSpeech={applySpeech} placeholder="Mumbai" />
            <Field label={t.area} value={location} onChange={setLocation} lang={lang} onSpeech={applySpeech} />
            <Button
              type="button"
              variant="secondary"
              className="h-14 w-full"
              onClick={() => {
                void readDeviceLocation()
                  .then((pos) => {
                    setLat(pos.lat);
                    setLng(pos.lng);
                    setLocation((v) => v || "Current location");
                    toast(hi ? "लोकेशन सेव हुई" : "Location saved");
                  })
                  .catch((e: Error) => toast(e.message));
              }}
            >
              {t.gps}
            </Button>
            {lat != null ? <p className="text-xs text-good">{hi ? "GPS सेव है" : "GPS saved for nearby matching"}</p> : null}
            <div className="flex flex-col gap-1.5">
              <Label>{t.radius}</Label>
              <Input type="number" min={1} max={80} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {hi
                ? "एक से ज़्यादा काम चुनें। सूची में नहीं है तो नया जोड़ें — एडमिन अप्रूव करेगा।"
                : "Select more than one trade. If it is missing, add it for admin approval."}
            </p>
            <MicButton lang={lang} size="lg" label={hi ? "काम बोलें" : "Speak your trade"} onText={applySpeech} />
            <SkillPicker
              selected={skills}
              onToggle={toggle}
              extra={pendingSkills}
              hi={hi}
            />
            <ProposeSkill
              hi={hi}
              onAdded={(s) => {
                if (!skills.includes(s.id)) setSkills((c) => [...c, s.id]);
                if (s.status === "pending") {
                  setPendingSkills((c) => (c.some((x) => x.id === s.id) ? c : [...c, s]));
                }
              }}
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">{t.daily}</p>
                <MicButton lang={lang} onText={applySpeech} />
              </div>
              <p className="mt-1 font-display text-4xl font-semibold tabular-nums">{inr(rate)}</p>
              <p className="text-sm text-muted">/ {rateType === "hour" ? (hi ? "घंटा" : "hour") : rateType === "job" ? (hi ? "जॉब" : "job") : hi ? "दिन" : "day"}</p>
              <input
                type="range"
                min={150}
                max={8000}
                step={10}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="mt-6 w-full accent-accent"
              />
              <Input
                className="mt-3"
                type="number"
                min={50}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
              <div className="mt-4 flex gap-2">
                {(["day", "hour", "job"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRateType(r)}
                    className={cn(
                      "h-11 flex-1 rounded-full text-sm capitalize",
                      rateType === r ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                    )}
                  >
                    {r === "day" ? (hi ? "रोज़" : "Per day") : r === "hour" ? (hi ? "घंटा" : "Per hour") : hi ? "जॉब" : "Per job"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.overtime}</Label>
              <Input type="number" min={0} value={overtime || ""} onChange={(e) => setOvertime(Number(e.target.value))} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t.years}</Label>
              <Input type="number" min={0} max={50} value={years} onChange={(e) => setYears(Number(e.target.value))} />
            </div>
            <div>
              <p className="mb-2 text-sm">{t.avail}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["daily", hi ? "रोज़" : "Daily"],
                  ["weekdays", hi ? "सप्ताह" : "Weekdays"],
                  ["weekends", hi ? "वीकेंड" : "Weekends"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAvail(id)}
                    className={cn(
                      "h-12 rounded-2xl text-sm",
                      avail === id ? "bg-accent text-accent-fg" : "bg-surface shadow-[var(--shadow-border)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>{t.about}</Label>
                <MicButton lang={lang} onText={applySpeech} />
              </div>
              <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} />
            </div>
            <p className="text-sm font-medium">{t.emergency}</p>
            <Input value={emName} onChange={(e) => setEmName(e.target.value)} placeholder={hi ? "नाम" : "Name"} />
            <Input inputMode="tel" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} placeholder="98765 43210" />
            <p className="text-sm font-medium">{t.kyc}</p>
            <div className="rounded-2xl bg-paper/10 px-4 py-3 text-sm text-paper">{t.kycRule}</div>
            <p className="text-xs text-muted">{t.kycHelp}</p>
            <div className="flex flex-wrap gap-2">
              {ID_DOCUMENT_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKycKind(k.id)}
                  className={cn(
                    "h-11 rounded-full px-3.5 text-sm",
                    kycKind === k.id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {hi ? k.hi : k.en}
                </button>
              ))}
            </div>
            <PhotoPicker value={kyc} onChange={setKyc} hi={hi} variant="document" />
            <p className="text-sm font-medium">{t.insurance}</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["none", t.none],
                ["yes", t.yes],
                ["pending", t.pending],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInsurance(id)}
                  className={cn(
                    "h-12 rounded-2xl text-sm",
                    insurance === id ? "bg-accent text-accent-fg" : "bg-surface shadow-[var(--shadow-border)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {insurance !== "none" ? (
              <Input value={insuranceNote} onChange={(e) => setInsuranceNote(e.target.value)} placeholder={hi ? "पॉलिसी नोट" : "Policy note"} />
            ) : null}
          </div>
        ) : null}

        {step === 7 ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
              <div className="flex items-center gap-3">
                {photo ? (
                  <img src={photo} alt="" className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="grid size-16 place-items-center rounded-full bg-raised text-sm text-muted">
                    {name.slice(0, 1) || "?"}
                  </div>
                )}
                <div>
                  <p className="font-display text-xl font-semibold">{name || "—"}</p>
                  <p className="text-sm text-muted">{formatInPhone(phone)}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <span className="text-muted">{hi ? "काम" : "Skills"} · </span>
                  {skills
                    .map((id) => {
                      const catalog = CATALOG_SKILLS.find((x) => x.id === id);
                      if (catalog) return hi ? catalog.hindi || catalog.name : catalog.name;
                      const pending = pendingSkills.find((x) => x.id === id);
                      return pending?.name;
                    })
                    .filter(Boolean)
                    .join(", ") || "—"}
                </li>
                <li>
                  <span className="text-muted">{hi ? "जगह" : "Location"} · </span>
                  {areaLabel() || "—"}
                </li>
                <li>
                  <span className="text-muted">{t.years} · </span>
                  {years}
                </li>
                <li>
                  <span className="text-muted">{t.avail} · </span>
                  {avail}
                </li>
                <li className="font-display text-lg tabular-nums">
                  {t.daily}: {inr(rate)} / {rateType}
                  {overtime ? ` · OT ${inr(overtime)}` : ""}
                </li>
                <li>
                  <span className="text-muted">KYC · </span>
                  {kyc
                    ? hi
                      ? "दस्तावेज़ अपलोड — अप्रूवल के बाद पब्लिक"
                      : "Document attached — public after admin approval"
                    : hi
                      ? "अभी पेंडिंग — पब्लिक नहीं होगा"
                      : "KYC Pending — profile stays private"}
                </li>
              </ul>
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-raised p-4 text-sm">
              <input
                type="checkbox"
                checked={goAvailable && Boolean(kyc || isKycApproved(initial?.idVerificationStatus))}
                disabled={!kyc && !isKycApproved(initial?.idVerificationStatus)}
                onChange={(e) => setGoAvailable(e.target.checked)}
              />
              {t.goOn}
            </label>
            <p className="text-xs text-muted">{t.kycRule}</p>
            <p className="text-xs text-muted">{t.confirm}</p>
          </div>
        ) : null}
      </div>

      {step > 0 ? (
        <div className="sticky bottom-0 mt-6 flex gap-2 bg-bg py-2">
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            {t.back}
          </Button>
          {step < 7 ? (
            <Button className="flex-1" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              {t.next}
            </Button>
          ) : (
            <Button className="flex-1" disabled={busy} onClick={() => void publish()}>
              {busy ? (hi ? "सेव…" : "Saving…") : t.publish}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  lang,
  onSpeech,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lang: "hi-IN" | "en-IN";
  onSpeech: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <MicButton lang={lang} onText={onSpeech} />
      </div>
    </div>
  );
}
