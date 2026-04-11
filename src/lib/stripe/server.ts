import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }
  stripeClient = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return stripeClient;
}
