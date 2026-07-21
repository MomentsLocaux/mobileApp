// push-dispatch — Lot 2 (Notifications)
//
// Invoked by a Postgres trigger (pg_net) on every INSERT into public.notifications.
// Reads the recipient's device push tokens + push preference and forwards the
// notification to the Expo Push service (which delivers to APNs / FCM).
//
// Auth: custom. The DB trigger sends a shared secret (stored in Supabase Vault)
// in the `x-signature` header; this function reads the same secret via the
// `current_push_dispatch_secret` RPC and rejects mismatches. Hence verify_jwt=false.
//
// No Expo access token is required to send to Expo push tokens. Token pruning is
// performed when Expo reports `DeviceNotRegistered`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationRecord = {
    id?: string;
    user_id: string;
    type?: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
};

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return json({ error: "method_not_allowed" }, 405);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false },
    });

    // --- Custom auth: compare header secret to the Vault-stored secret ---
    const provided = req.headers.get("x-signature") ?? "";
    const { data: expected, error: secretErr } = await admin.rpc(
        "current_push_dispatch_secret",
    );
    if (secretErr) {
        console.error("secret rpc error", secretErr);
        return json({ error: "secret_unavailable" }, 500);
    }
    if (!expected || provided !== expected) {
        return json({ error: "unauthorized" }, 401);
    }

    // --- Parse payload ({ record } from the trigger, or a raw record) ---
    let record: NotificationRecord | null = null;
    try {
        const payload = await req.json();
        record = (payload?.record ?? payload) as NotificationRecord;
    } catch (_e) {
        return json({ error: "invalid_json" }, 400);
    }
    if (!record?.user_id) {
        return json({ error: "missing_user_id" }, 400);
    }

    // --- Respect user notification preferences (missing row => enabled) ---
    const { data: pref } = await admin
        .from("user_preferences")
        .select(
            "push_enabled, notify_social, notify_rewards, notify_event_nearby, notify_followed_creator, notify_event_reminders, discovery_push_enabled, right_now_push_enabled, break_loop_push_enabled, life_insight_push_enabled",
        )
        .eq("user_id", record.user_id)
        .maybeSingle();

    if (pref && pref.push_enabled === false) {
        return json({ skipped: "push_disabled" }, 200);
    }

    const type = record.type ?? "";
    if (pref) {
        if (
            (type === "social_follow" || type === "social_like") &&
            pref.notify_social === false
        ) {
            return json({ skipped: "social_disabled" }, 200);
        }
        if (
            (type === "mission_completed" ||
                type === "lumo_reward" ||
                type === "boost_expired") &&
            pref.notify_rewards === false
        ) {
            return json({ skipped: "rewards_disabled" }, 200);
        }
        if (type === "event_nearby_new" && pref.notify_event_nearby === false) {
            return json({ skipped: "event_nearby_disabled" }, 200);
        }
        if (
            type === "followed_creator_published" &&
            pref.notify_followed_creator === false
        ) {
            return json({ skipped: "followed_creator_disabled" }, 200);
        }
        if (type === "event_soon" && pref.notify_event_reminders === false) {
            return json({ skipped: "event_reminders_disabled" }, 200);
        }
    }

    const discoveryTypes = new Set([
        "discovery_right_now",
        "discovery_break_loop",
        "discovery_new_area",
        "discovery_personal_match",
        "discovery_life_insight",
    ]);
    if (record.type && discoveryTypes.has(record.type)) {
        if (!pref || pref.discovery_push_enabled !== true) {
            return json({ skipped: "discovery_push_disabled" }, 200);
        }
        if (
            record.type === "discovery_right_now" &&
            pref?.right_now_push_enabled !== true
        ) {
            return json({ skipped: "right_now_push_disabled" }, 200);
        }
        if (
            record.type === "discovery_break_loop" &&
            pref?.break_loop_push_enabled !== true
        ) {
            return json({ skipped: "break_loop_push_disabled" }, 200);
        }
        if (
            record.type === "discovery_life_insight" &&
            pref?.life_insight_push_enabled !== true
        ) {
            return json({ skipped: "life_insight_push_disabled" }, 200);
        }
    }

    // --- Load the recipient's device tokens ---
    const { data: tokens, error: tokErr } = await admin
        .from("device_push_tokens")
        .select("token")
        .eq("user_id", record.user_id);
    if (tokErr) {
        console.error("token query error", tokErr);
        return json({ error: "token_query_failed" }, 500);
    }
    if (!tokens || tokens.length === 0) {
        return json({ sent: 0, reason: "no_tokens" }, 200);
    }

    const pushData = {
        ...(record!.data ?? {}),
        notificationType: record!.type ?? null,
    };

    const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        title: record!.title,
        body: record!.body ?? "",
        data: pushData,
        sound: "default",
    }));

    // --- Send to Expo ---
    const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(messages),
    });
    const expo = await res.json().catch(() => null);

    // --- Prune tokens Expo reports as no longer registered ---
    const tickets: Array<{ status?: string; details?: { error?: string } }> =
        expo?.data ?? [];
    const toDelete: string[] = [];
    tickets.forEach((ticket, i) => {
        if (
            ticket?.status === "error" &&
            ticket?.details?.error === "DeviceNotRegistered" &&
            tokens[i]
        ) {
            toDelete.push(tokens[i].token);
        }
    });
    if (toDelete.length > 0) {
        await admin.from("device_push_tokens").delete().in("token", toDelete);
    }

    return json(
        { sent: messages.length, pruned: toDelete.length, expo_status: res.status },
        200,
    );
});
