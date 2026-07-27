/**
 * DIFF-BILL stub — Diffuseur billing webhook.
 *
 * Today: accept signed payloads (mock/stripe/manual_devis) and call apply_diffuseur_sku.
 * Tomorrow: point Stripe Checkout / Customer Portal webhooks here (same body shape).
 *
 * Secrets:
 *   DIFFUSEUR_BILLING_WEBHOOK_SECRET
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto in Edge)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('DIFFUSEUR_BILLING_WEBHOOK_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-diffuseur-billing-webhook-secret',
};

type BillingProvider = 'mock' | 'stripe' | 'manual_devis';

type BillingPayload = {
  organization_id: string;
  sku: string;
  provider: BillingProvider;
  external_id?: string | null;
  amount_cents_ht?: number | null;
  metadata?: Record<string, unknown>;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidPayload(body: BillingPayload): boolean {
  return (
    typeof body.organization_id === 'string' &&
    body.organization_id.length > 0 &&
    typeof body.sku === 'string' &&
    body.sku.trim().length > 0 &&
    (body.provider === 'mock' || body.provider === 'stripe' || body.provider === 'manual_devis')
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'method_not_allowed' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, message: 'server_misconfigured' }, 500);
  }

  if (!WEBHOOK_SECRET) {
    return json({ success: false, message: 'webhook_secret_missing' }, 500);
  }

  const providedSecret = req.headers.get('x-diffuseur-billing-webhook-secret') ?? '';
  if (providedSecret !== WEBHOOK_SECRET) {
    return json({ success: false, message: 'unauthorized' }, 401);
  }

  let body: BillingPayload;
  try {
    body = (await req.json()) as BillingPayload;
  } catch {
    return json({ success: false, message: 'invalid_json' }, 400);
  }

  if (!isValidPayload(body)) {
    return json({ success: false, message: 'invalid_payload' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc('apply_diffuseur_sku', {
    p_organization_id: body.organization_id,
    p_sku: body.sku.trim(),
    p_provider: body.provider,
    p_external_id: body.external_id ?? null,
    p_amount_cents_ht: body.amount_cents_ht ?? null,
    p_metadata: {
      ...(body.metadata ?? {}),
      source: 'diffuseur-billing-webhook-v1',
    },
  });

  if (error) {
    console.error('apply_diffuseur_sku', error);
    return json({ success: false, message: error.message }, 400);
  }

  return json({ success: true, result: data });
});
