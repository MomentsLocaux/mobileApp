import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_DISTANCE_METERS = 500;
const LUMO_TRIGGER_EVENT = 'checkin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const toRad = (value: number) => (value * Math.PI) / 180;

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Méthode non autorisée.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[event-checkin] missing env', {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    return new Response(JSON.stringify({ success: false, message: 'Configuration serveur manquante.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    console.log('[event-checkin] missing auth token');
    return new Response(JSON.stringify({ success: false, message: 'Authentification requise.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    console.log('[event-checkin] invalid user', { userError });
    return new Response(JSON.stringify({ success: false, message: 'Utilisateur invalide.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: { eventId?: string; lat?: number; lon?: number; qrToken?: string; source?: string };
  try {
    payload = await req.json();
  } catch (error) {
    console.log('[event-checkin] invalid json', { error });
    return new Response(JSON.stringify({ success: false, message: 'Données invalides.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventId = payload.eventId;
  const lat = typeof payload.lat === 'number' ? payload.lat : Number(payload.lat);
  const lon = typeof payload.lon === 'number' ? payload.lon : Number(payload.lon);
  const qrToken = typeof payload.qrToken === 'string' ? payload.qrToken.trim() : '';
  const source = payload.source === 'qr_scan' ? 'qr_scan' : 'mobile';

  if (!eventId || Number.isNaN(lat) || Number.isNaN(lon)) {
    console.log('[event-checkin] missing params', { eventId, lat, lon });
    return new Response(JSON.stringify({ success: false, message: 'Paramètres manquants.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[event-checkin] request', {
    eventId,
    userId: userData.user.id,
    lat,
    lon,
    source,
    hasQrToken: qrToken.length > 0,
  });

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, latitude, longitude, qr_token')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError || !event) {
    console.log('[event-checkin] event not found', { eventId, eventError });
    return new Response(JSON.stringify({ success: false, message: 'Événement introuvable.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventLat = Number(event.latitude);
  const eventLon = Number(event.longitude);
  if (Number.isNaN(eventLat) || Number.isNaN(eventLon)) {
    console.log('[event-checkin] invalid event coordinates', { eventId, eventLat, eventLon });
    return new Response(JSON.stringify({ success: false, message: 'Coordonnées événement invalides.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (qrToken && event.qr_token !== qrToken) {
    console.log('[event-checkin] invalid qr token', {
      eventId,
      userId: userData.user.id,
    });
    return new Response(JSON.stringify({ success: false, message: 'QR code invalide pour cet événement.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const distance = haversineDistance(lat, lon, eventLat, eventLon);
  if (distance > MAX_DISTANCE_METERS) {
    console.log('[event-checkin] too far', {
      eventId,
      userId: userData.user.id,
      distance: Math.round(distance),
    });
    return new Response(
      JSON.stringify({
        success: false,
        message: `Vous devez être à moins de ${MAX_DISTANCE_METERS}m pour valider ce check-in.`,
        distance: Math.round(distance),
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const { error: insertError } = await supabase.from('event_checkins').insert({
    user_id: userData.user.id,
    event_id: eventId,
    lat,
    lon,
    validated_radius: Math.round(distance),
    source,
  });

  if (insertError) {
    console.log('[event-checkin] insert error', { insertError });
    if (insertError.code === '23505') {
      return new Response(JSON.stringify({ success: false, message: 'Check-in déjà validé.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'Erreur lors du check-in.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let rewardedLumo = 0;
  const { data: ruleData, error: ruleError } = await supabase
    .from('lumo_rules')
    .select('amount')
    .eq('trigger_event', LUMO_TRIGGER_EVENT)
    .eq('active', true)
    .maybeSingle();

  if (ruleError) {
    console.log('[event-checkin] rule error', { ruleError });
  }
  if (ruleData) {
    console.log('[event-checkin] rule data', { ruleData });
  }

  if (!ruleError && ruleData?.amount) {
    rewardedLumo = Number(ruleData.amount) || 0;
  }

  if (rewardedLumo > 0) {
    const metadata = { event_id: eventId, distance: Math.round(distance) };

    const { error: txError } = await supabase.from('lumo_transactions').insert({
      user_id: userData.user.id,
      amount: rewardedLumo,
      type: 'credit',
      source: 'checkin',
      reason: 'Check-in validé',
      metadata,
    });

    if (txError) {
      console.log('[event-checkin] lumo transaction error', { txError });
      return new Response(JSON.stringify({ success: false, message: 'Erreur lors du credit Lumo.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (wallet) {
      const nextBalance = Number(wallet.balance || 0) + rewardedLumo;
      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .update({ balance: nextBalance })
        .eq('user_id', userData.user.id);
      if (walletUpdateError) {
        console.log('[event-checkin] wallet update error', { walletUpdateError });
      }
    } else {
      const { error: walletInsertError } = await supabase
        .from('wallets')
        .insert({ user_id: userData.user.id, balance: rewardedLumo });
      if (walletInsertError) {
        console.log('[event-checkin] wallet insert error', { walletInsertError });
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Check-in validé.',
      distance: Math.round(distance),
      rewards: rewardedLumo > 0 ? { lumo: rewardedLumo } : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
