#!/usr/bin/env node
/* ============================================================================
   One-time setup: creates all the tables + fields booking-payment/crm-airtable.js
   and comms/send.js expect, in an EMPTY Airtable base, via Airtable's Web API.

   Usage:
     1. Create an empty base at airtable.com (just the base, no tables needed —
        Airtable always gives a new base one default "Table 1", which this
        script ignores and leaves alone; delete it yourself afterward if you want).
     2. Copy the base id from its URL: airtable.com/appXXXXXXXXXXXXXX/...
     3. Create a Personal Access Token at airtable.com/create/tokens with scopes
        schema.bases:write and data.records:write, access = the base above.
     4. Run:
          AIRTABLE_TOKEN=pat_xxx AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX node scripts/setup-airtable.js
   ============================================================================ */
'use strict';

// .trim() + strip embedded whitespace/newlines: copy-pasting a token into a
// shell prompt easily picks up a stray leading/trailing/embedded newline
// (terminal quirks, clipboard trailing newline from a "copy" button, etc.),
// which fetch()'s Headers rejects outright. Sanitize defensively so a messy
// paste still works instead of failing deep in an HTTP call.
const clean = (s) => (s || '').replace(/\s+/g, '');
const TOKEN = clean(process.env.AIRTABLE_TOKEN);
const BASE = clean(process.env.AIRTABLE_BASE_ID);
if (!TOKEN || !BASE) {
  console.error('Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID env vars first.');
  process.exit(1);
}
console.log(`Using token starting "${TOKEN.slice(0, 8)}..." (${TOKEN.length} chars), base ${BASE}`);

const API = `https://api.airtable.com/v0/meta/bases/${BASE}/tables`;

async function api(path, init) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init && init.headers) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body)}`);
  return body;
}

const text = (name) => ({ name, type: 'singleLineText' });
const long = (name) => ({ name, type: 'multilineText' });
const num = (name, precision = 0) => ({ name, type: 'number', options: { precision } });
const money = (name) => ({ name, type: 'currency', options: { precision: 2, symbol: '$' } });
const pct = (name) => ({ name, type: 'percent', options: { precision: 0 } });
const check = (name) => ({ name, type: 'checkbox', options: { icon: 'check', color: 'greenBright' } });
const email = (name) => ({ name, type: 'email' });
const phone = (name) => ({ name, type: 'phoneNumber' });
const dt = (name) => ({ name, type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'America/Los_Angeles' } });
const date = (name) => ({ name, type: 'date', options: { dateFormat: { name: 'iso' } } });
const created = (name) => ({ name, type: 'createdTime', options: { result: { type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'America/Los_Angeles' } } } });
const select = (name, choices) => ({ name, type: 'singleSelect', options: { choices: choices.map((n) => ({ name: n })) } });
const link = (name, tableId) => ({ name, type: 'multipleRecordLinks', options: { linkedTableId: tableId } });

// Tables in dependency order — link targets must already exist.
const TABLES = [
  {
    name: 'Customers',
    fields: () => [
      text('Name'), phone('Phone'), email('Email'),
      select('Home Area', ['Seattle', 'Bellevue', 'Kirkland', 'Redmond', 'Renton', 'Kent', 'Federal Way', 'Auburn', 'Tacoma', 'Puyallup', 'Lynnwood', 'Edmonds', 'Everett', 'Gig Harbor', 'Other']),
      select('Segment', ['Airport regular', 'Corporate', 'Wedding/event', 'One-time', 'Lapsed']),
      check('Marketing Opt-in'), check('SMS Opt-out'),
      dt('Last Contact'), long('Notes'),
    ],
  },
  {
    name: 'Corporate Accounts',
    fields: () => [
      text('Company'), text('Billing Contact'), phone('Contact Phone'), email('Contact Email'), text('Contact Role'),
      select('Stage', ['Prospect', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Account Created', 'Active', 'Inactive']),
      select('Discount Tier', ['standard', 'corporate', 'preferred', 'volume', 'contract']),
      money('Contract Rate'), pct('Fixed Gratuity %'), text('Payment Terms'),
      select('Monthly Volume', ['1-5 trips', '6-20 trips', '21-50 trips', '50+ trips']),
      select('Primary Use', ['Airport', 'Client transport', 'Events', 'Executive commute', 'Mixed']),
      long('Authorized Bookers'),
    ],
  },
  {
    name: 'Leads',
    fields: (ids) => [
      text('Reference'), dt('Created'), text('Name'), phone('Phone'), email('Email'),
      select('Service', ['Airport pickup', 'Airport drop-off', 'Hourly', 'Point-to-point', 'Round trip', 'Wedding/event', 'Cruise terminal', 'Corporate account']),
      select('Service Area', ['Seattle', 'Bellevue', 'Kirkland', 'Redmond', 'Renton', 'Kent', 'Federal Way', 'Auburn', 'Tacoma', 'Puyallup', 'Lynnwood', 'Edmonds', 'Everett', 'Gig Harbor', 'Other WA area']),
      text('Route'), text('Pickup'), text('Drop-off'), date('Date'), text('Time'),
      num('Passengers'), text('Vehicle'), text('Flight #'),
      select('Quote Method', ['flat', 'hourly', 'manual-quote', 'corporate']),
      money('Quoted Amount'), dt('Quote Expires'),
      select('Status', ['New', 'Contacted', 'Quote Sent', 'Follow-up', 'Booked', 'Paid', 'Completed', 'Cancelled', 'Lost']),
      select('Lost Reason', ['No reply', 'Price', 'Booked elsewhere', 'Not serviceable', 'Duplicate']),
      select('Source', ['website', 'google-ads', 'referral', 'other']), text('Medium'), text('Campaign'), text('Term'),
      text('GCLID'), text('Landing Page'), dt('Next Follow-up'),
      long('Notes'), check('Consent'),
      select('Payment Preference', ['card', 'cash']), check('New Customer'),
      long('Followup Steps Sent'),
      link('Customer', ids['Customers']),
      link('Corporate Account', ids['Corporate Accounts']),
      long('Raw Payload'),
    ],
  },
  {
    name: 'Bookings',
    fields: (ids) => [
      text('Reference'), link('Customer', ids['Customers']), link('Lead', ids['Leads']),
      select('Service', ['Airport pickup', 'Airport drop-off', 'Hourly', 'Point-to-point', 'Round trip', 'Wedding/event', 'Cruise terminal', 'Corporate account']),
      text('Pickup'), text('Drop-off'), num('Stops'), num('Child Seats'),
      date('Date'), text('Time'), date('Return Date'), text('Return Time'),
      num('Passengers'), num('Bags'), text('Vehicle Class'), text('Flight #'),
      money('Price'), money('Deposit Amount'), money('Deposit Paid'), money('Balance'), money('Cash Due'),
      text('Deposit Link'), text('Deposit Session Id'), text('Deposit Note'), dt('Deposit Link Sent'), dt('Deposit Paid At'),
      select('Payment Method', ['Card', 'Cash']),
      money('Fare Collected'), dt('Fare Collected At'),
      select('Status', ['Reserved', 'Confirmed', 'Needs Approval', 'Assigned', 'Deposit Paid', 'Payment Held', 'Completed', 'No-show', 'Cancelled']),
      check('Driver Assigned'), num('Customer Trip Count'),
      long('Special Requests'), long('Pricing Breakdown'), text('Table Version'),
      link('Corporate Account', ids['Corporate Accounts']),
    ],
  },
  {
    name: 'Payments',
    fields: (ids) => [
      link('Booking', ids['Bookings']), money('Amount'),
      select('Type', ['Deposit', 'Balance', 'Gratuity', 'Refund']),
      select('Method', ['card', 'cash']), text('Processor Ref'),
      select('Status', ['Pending', 'Succeeded', 'Failed', 'Refunded']),
      long('Note'), created('Created'),
    ],
  },
  {
    name: 'Activity Log',
    fields: () => [
      dt('Timestamp'), text('Actor'), text('Record Type'), text('Record Ref'), text('Event'), long('Detail'),
    ],
  },
  {
    name: 'Webhook Events',
    fields: () => [text('Event Id'), dt('Received')],
  },
  {
    name: 'Messages',
    fields: () => [
      text('Dedupe Key'), text('Reference'), text('Template'),
      select('Channel', ['sms', 'email']), text('To'),
      select('Status', ['sent', 'failed', 'skipped']),
      text('Provider Id'), long('Error'), dt('Sent At'),
    ],
  },
];

async function main() {
  const ids = {};
  for (const t of TABLES) {
    console.log(`Creating table "${t.name}"...`);
    const fields = t.fields(ids);
    try {
      const result = await api('/tables', { method: 'POST', body: JSON.stringify({ name: t.name, fields }) });
      ids[t.name] = result.id;
      console.log(`  ok — ${result.id}`);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
      console.error('  Stopping — fix the error above (often a duplicate table name), then re-run.');
      process.exit(1);
    }
  }
  console.log('\nAll tables created. Base is ready for AIRTABLE_TOKEN / AIRTABLE_BASE_ID.');
}

main();
