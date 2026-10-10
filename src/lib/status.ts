export const BOOKING_STEPS = [
  "requested",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
] as const;

export const LIVE_STATUSES = ["accepted", "on_the_way", "arrived", "in_progress"] as const;

export function isLiveStatus(status: string) {
  return (LIVE_STATUSES as readonly string[]).includes(status);
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Not started",
  invited: "Invited",
  requested: "Requested",
  accepted: "Accepted",
  on_the_way: "On the way",
  arrived: "Arrived",
  in_progress: "Working",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  offline: "Offline",
};

export const NEXT_STATUS: Record<string, string> = {
  accepted: "on_the_way",
  on_the_way: "arrived",
  arrived: "in_progress",
  in_progress: "completed",
};

export const NEXT_LABEL: Record<string, string> = {
  on_the_way: "I'm on the way",
  arrived: "I've arrived",
  in_progress: "Start work",
  completed: "Complete work",
};

export const CREW_DOT: Record<string, string> = {
  pending: "bg-subtle",
  invited: "bg-subtle",
  accepted: "bg-accent",
  on_the_way: "bg-accent",
  arrived: "bg-good",
  in_progress: "bg-sage",
  completed: "bg-sage",
  cancelled: "bg-danger",
  rejected: "bg-danger",
  offline: "bg-subtle",
};

export const CASH_LABEL: Record<string, string> = {
  due: "Pending",
  pending: "Pending",
  collected: "Cash Collected",
  paid: "Paid",
};

export const PAY_METHOD_LABEL: Record<string, string> = {
  cash: "Cash on Site",
  upi: "Cash on Site",
  online: "Cash on Site",
  card: "Cash on Site",
  razorpay: "Cash on Site",
};

export const PAYOUT_LABEL: Record<string, string> = {
  unpaid: "Pending",
  pending: "Pending",
  paid: "Paid",
};

export const NOTIF_TYPE_LABEL: Record<string, string> = {
  booking_created: "New booking",
  booking_accepted: "Booking accepted",
  booking_rejected: "Booking rejected",
  booking_cancelled: "Booking cancelled",
  booking_arrived: "Worker arrived",
  booking_on_the_way: "On the way",
  booking_in_progress: "Work started",
  booking_completed: "Work completed",
  message: "New message",
  payment: "Payment",
  kyc: "KYC",
  rating: "Rating",
};

export function crewCounts(crew: Array<{ status: string }>) {
  const has = (...s: string[]) => crew.filter((c) => s.includes(c.status)).length;
  return {
    total: crew.length,
    accepted: has("accepted", "on_the_way", "arrived", "in_progress", "completed"),
    arrived: has("arrived", "in_progress", "completed"),
    working: has("in_progress"),
    completed: has("completed"),
    pending: has("pending", "invited"),
    rejected: has("rejected"),
    cancelled: has("cancelled"),
  };
}
