/* TEMPORARY diagnostic — confirms which env vars Netlify is actually injecting
   into the function runtime, without ever revealing their values. Delete this
   file once STRIPE_SECRET_KEY / AIRTABLE_* are confirmed working. */
'use strict';
exports.handler = async () => {
  const names = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SITE_ORIGIN',
    'DISPATCH_API_TOKEN', 'DISPATCH_EMAIL', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID'];
  const report = {};
  for (const n of names) {
    const v = process.env[n];
    report[n] = v ? { present: true, length: v.length, startsWith: v.slice(0, 6) } : { present: false };
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report, null, 2),
  };
};
