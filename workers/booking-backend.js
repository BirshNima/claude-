/* ============================================================================
   Northwest Town Car Service — Cloudflare Worker entry point
   ----------------------------------------------------------------------------
   Thin wrapper: all the real logic lives in booking-payment/server.js (the
   `worker()` adapter). One Worker handles all four routes by URL path:

     POST /intake                public — the booking funnel
     POST /deposit-link          private (bearer DISPATCH_API_TOKEN) — dispatch
     POST /record-cash-payment   private (bearer DISPATCH_API_TOKEN) — dispatch/driver
     POST /stripe-webhook        Stripe calls this directly

   Env vars / secrets (set via `wrangler secret put <NAME>` or the Cloudflare
   dashboard — see booking-payment/config.example.env for the full list).
   ============================================================================ */
import { worker } from '../booking-payment/server.js';

const real = worker();

// TEMPORARY diagnostic — reports which secrets are bound and their length /
// first+last 4 chars only, never the full value. Remove once everything's
// confirmed working. GET /debug-env
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/debug-env') {
      const names = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SITE_ORIGIN',
        'DISPATCH_API_TOKEN', 'DISPATCH_EMAIL', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID'];
      const report = {};
      for (const n of names) {
        const v = env[n];
        report[n] = v
          ? { present: true, length: v.length, preview: v.length > 8 ? `${v.slice(0, 4)}...${v.slice(-4)}` : '(short)' }
          : { present: false };
      }
      return new Response(JSON.stringify(report, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }
    return real.fetch(request, env, ctx);
  },
};
