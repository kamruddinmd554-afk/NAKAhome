export const PLATFORM_FEE_RATE = 0.08;

export type QuoteSnapshot = {
  unitRate: number;
  rateType: string;
  hours: number;
  crewSize: number;
  unitCharge: number;
  workerCharge: number;
  fee: number;
  total: number;
};

export function quoteFromWorkerRate(
  unitRate: number,
  rateType: string,
  hours: number,
  crewSize: number,
): QuoteSnapshot {
  const rate = Math.round(unitRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("This worker has not set a rate for the selected work.");
  }
  const type = rateType === "hour" || rateType === "job" ? rateType : rateType === "day" ? "day" : "";
  if (!type) throw new Error("Unknown rate type");
  const crew = Math.max(1, Math.round(crewSize));
  const h = Math.max(1, Math.round(hours));
  let unitCharge = rate;
  if (type === "hour") unitCharge = rate * h;
  else if (type === "day") unitCharge = rate * Math.max(1, Math.ceil(h / 8));
  const workerCharge = unitCharge * crew;
  const fee = Math.round(workerCharge * PLATFORM_FEE_RATE);
  return { unitRate: rate, rateType: type, hours: h, crewSize: crew, unitCharge, workerCharge, fee, total: workerCharge + fee };
}
