import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('SUBSCRIPTION_WEBHOOK_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-subscription-webhook-secret',
};

type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'expired'
  | 'cancelled'
  | 'refunded';

type SubscriptionProvider = 'apple' | 'google' | 'stripe' | 'revenuecat' | 'internal';

type WebhookPayload = {
  user_id: string;
  entitlement?: string;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  product_id: string;
  started_at?: string;
  expires_at?: string | null;
  auto_renew?: boolean;
  trial_ends_at?: string | null;
  provider_customer_id?: string;
  provider_subscription_id?: string;
  metadata?: Record<string, unknown>;
};

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(['active', 'grace_period', 'trialing']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidPayload(body: WebhookPayload): boolean {
  return (
    typeof body.user_id === 'string' &&
    body.user_id.length > 0 &&
    typeof body.status === 'string' &&
    typeof body.provider === 'string' &&
    typeof body.product_id === 'string' &&
    body.product_id.trim().length > 0
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

  const providedSecret = req.headers.get('x-subscription-webhook-secret') ?? '';
  if (providedSecret !== WEBHOOK_SECRET) {
    return json({ success: false, message: 'unauthorized' }, 401);
  }

  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
  } catch {
    return json({ success: false, message: 'invalid_json' }, 400);
  }

  if (!isValidPayload(body)) {
    return json({ success: false, message: 'invalid_payload' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const entitlement = body.entitlement?.trim() || 'moments_locaux_plus';
  const nowIso = new Date().toISOString();
  const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;
  const isActive =
    ACTIVE_STATUSES.has(body.status) && (expiresAt == null || new Date(expiresAt).getTime() > Date.now());

  const { data, error } = await admin
    .from('user_subscriptions')
    .upsert(
      {
        user_id: body.user_id,
        provider: body.provider,
        product_id: body.product_id,
        entitlement,
        status: isActive ? body.status : 'expired',
        started_at: body.started_at ? new Date(body.started_at).toISOString() : nowIso,
        expires_at: expiresAt,
        auto_renew: body.auto_renew ?? false,
        trial_ends_at: body.trial_ends_at ? new Date(body.trial_ends_at).toISOString() : null,
        provider_customer_id: body.provider_customer_id ?? null,
        provider_subscription_id: body.provider_subscription_id ?? null,
        metadata: body.metadata ?? { source: 'subscription-webhook-v1' },
        updated_at: nowIso,
      },
      { onConflict: 'user_id,entitlement' },
    )
    .select('id, user_id, entitlement, status, expires_at')
    .single();

  if (error) {
    console.error('[subscription-webhook] upsert failed', error.message);
    return json({ success: false, message: 'upsert_failed' }, 500);
  }

  return json({
    success: true,
    subscription: data,
    is_active: isActive,
  });
});
