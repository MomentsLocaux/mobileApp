import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_DISTANCE_METERS = 500;

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
    return new Response(JSON.stringify({ success: false, message: 'Configuration serveur manquante.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ success: false, message: 'Authentification requise.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ success: false, message: 'Utilisateur invalide.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: { eventId?: string; lat?: number; lon?: number };
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Données invalides.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventId = payload.eventId;
  const lat = typeof payload.lat === 'number' ? payload.lat : Number(payload.lat);
  const lon = typeof payload.lon === 'number' ? payload.lon : Number(payload.lon);

  if (!eventId || Number.isNaN(lat) || Number.isNaN(lon)) {
    return new Response(JSON.stringify({ success: false, message: 'Paramètres manquants.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, latitude, longitude')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError || !event) {
    return new Response(JSON.stringify({ success: false, message: 'Événement introuvable.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventLat = Number(event.latitude);
  const eventLon = Number(event.longitude);
  if (Number.isNaN(eventLat) || Number.isNaN(eventLon)) {
    return new Response(JSON.stringify({ success: false, message: 'Coordonnées événement invalides.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const distance = haversineDistance(lat, lon, eventLat, eventLon);
  if (distance > MAX_DISTANCE_METERS) {
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
    source: 'mobile',
  });

  if (insertError) {
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

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Check-in validé.',
      distance: Math.round(distance),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
