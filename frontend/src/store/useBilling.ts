import { create } from "zustand";

/** Why the top-up dialog is open: the user asked ("topup"), or an AI action
 *  was refused for lack of credits ("out") — which changes the heading. */
export type BillingReason = "topup" | "out";

interface BillingState {
  reason: BillingReason | null;
  openBilling: (reason?: BillingReason) => void;
  closeBilling: () => void;
}

export const useBilling = create<BillingState>((set) => ({
  reason: null,
  openBilling: (reason = "topup") => set({ reason }),
  closeBilling: () => set({ reason: null }),
}));
