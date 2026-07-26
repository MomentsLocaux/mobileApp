// push-dispatch — Lot 2 (Notifications) + PREF/PUSH preference center
//
// Invoked by a Postgres trigger (pg_net) on every INSERT into public.notifications.
// Reads the recipient's device push tokens + push preference and forwards the
// notification to the Expo Push service (which delivers to APNs / FCM).
//
// Auth: custom. The DB trigger sends a shared secret (stored in Supabase Vault)
// in the `x-signature` header; this function reads the same secret via the
// `current_push_dispatch_secret` RPC and rejects mismatches. Hence verify_jwt=false.
//
// PUSH-P0-001: daily budget (count of notifications created today Europe/Paris)
// and quiet hours. Critical moderation types bypass budget/quiet.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const PREF_TZ = "Europe/Paris";

/** Always attempt OS push even under budget / quiet hours. */
const CRITICAL_PUSH_TYPES = new Set([
    "user_banned",
    "warning_received",
    "event_refused",
    "event_request_changes",
    "media_rejected",
    "contest_entry_refused",
    "moderation_escalation",
]);

type NotificationRecord = {
    id?: string;
    user_id: string;
    type?: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
};

type PrefRow = {
    push_enabled?: boolean;
    notify_social?: boolean;
    notify_rewards?: boolean;
    notify_event_nearby?: boolean;
    notify_proximity_live?: boolean;
    notify_followed_creator?: boolean;
    notify_event_reminders?: boolean;
    discovery_push_enabled?: boolean;
    right_now_push_enabled?: boolean;
    break_loop_push_enabled?: boolean;
    life_insight_push_enabled?: boolean;
    max_push_per_day?: number | null;
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
};

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/** Minutes since local midnight in PREF_TZ. */
function parisMinutesNow(now = new Date()): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: PREF_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
    if (!value) return null;
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Quiet window: if start < end → [start, end); if start > end → spans midnight.
 * Both null → disabled.
 */
function isQuietHours(
    start: string | null | undefined,
    end: string | null | undefined,
    now = new Date(),
): boolean {
    const startMin = parseTimeToMinutes(start ?? null);
    const endMin = parseTimeToMinutes(end ?? null);
    if (startMin == null || endMin == null) return false;
    const nowMin = parisMinutesNow(now);
    if (startMin === endMin) return true;
    if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
}

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return json({ error: "method_not_allowed" }, 405);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false },
    });

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

    const { data: pref } = await admin
        .from("user_preferences")
        .select(
            "push_enabled, notify_social, notify_rewards, notify_event_nearby, notify_proximity_live, notify_followed_creator, notify_event_reminders, discovery_push_enabled, right_now_push_enabled, break_loop_push_enabled, life_insight_push_enabled, max_push_per_day, quiet_hours_start, quiet_hours_end",
        )
        .eq("user_id", record.user_id)
        .maybeSingle();

    const prefs = pref as PrefRow | null;

    if (prefs && prefs.push_enabled === false) {
        return json({ skipped: "push_disabled" }, 200);
    }

    const type = record.type ?? "";
    if (prefs) {
        if (
            (type === "social_follow" || type === "social_like") &&
            prefs.notify_social === false
        ) {
            return json({ skipped: "social_disabled" }, 200);
        }
        if (
            (type === "mission_completed" ||
                type === "lumo_reward" ||
                type === "boost_expired") &&
            prefs.notify_rewards === false
        ) {
            return json({ skipped: "rewards_disabled" }, 200);
        }
        if (type === "event_nearby_new" && prefs.notify_event_nearby === false) {
            return json({ skipped: "event_nearby_disabled" }, 200);
        }
        if (
            type === "event_nearby_live" &&
            prefs.notify_proximity_live !== true
        ) {
            return json({ skipped: "proximity_live_disabled" }, 200);
        }
        if (
            type === "followed_creator_published" &&
            prefs.notify_followed_creator === false
        ) {
            return json({ skipped: "followed_creator_disabled" }, 200);
        }
        if (type === "event_soon" && prefs.notify_event_reminders === false) {
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
        if (!prefs || prefs.discovery_push_enabled !== true) {
            return json({ skipped: "discovery_push_disabled" }, 200);
        }

        // Éclaireur entitlement required for all Discovery pushes.
        const { data: entitlementRows, error: entErr } = await admin
            .from("user_subscriptions")
            .select("status, expires_at")
            .eq("user_id", record.user_id)
            .eq("entitlement", "moments_locaux_plus")
            .in("status", ["active", "grace_period", "trialing"])
            .order("updated_at", { ascending: false })
            .limit(5);
        if (entErr) {
            console.error("eclaireur entitlement lookup error", entErr);
            return json({ error: "entitlement_lookup_failed" }, 500);
        }
        const now = Date.now();
        const hasEclaireur = (entitlementRows ?? []).some((row) => {
            if (!row.expires_at) return true;
            return new Date(row.expires_at).getTime() > now;
        });
        if (!hasEclaireur) {
            return json({ skipped: "eclaireur_required" }, 200);
        }

        if (
            record.type === "discovery_right_now" &&
            prefs?.right_now_push_enabled !== true
        ) {
            return json({ skipped: "right_now_push_disabled" }, 200);
        }
        if (
            record.type === "discovery_break_loop" &&
            prefs?.break_loop_push_enabled !== true
        ) {
            return json({ skipped: "break_loop_push_disabled" }, 200);
        }
        if (
            record.type === "discovery_life_insight" &&
            prefs?.life_insight_push_enabled !== true
        ) {
            return json({ skipped: "life_insight_push_disabled" }, 200);
        }
        // discovery_personal_match / discovery_new_area: master discovery + éclaireur gate
    }

    const isCritical = CRITICAL_PUSH_TYPES.has(type);
    if (!isCritical && prefs) {
        if (isQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
            return json({ skipped: "quiet_hours" }, 200);
        }

        const maxPerDay = prefs.max_push_per_day ?? 3;
        if (maxPerDay > 0) {
            // Count inbox rows created today Europe/Paris (includes current insert).
            const { data: todayCount, error: countErr } = await admin.rpc(
                "count_user_notifications_today",
                { p_user_id: record.user_id },
            );
            if (countErr) {
                console.error("daily budget count error", countErr);
            } else if (
                typeof todayCount === "number" &&
                todayCount > maxPerDay
            ) {
                return json({
                    skipped: "daily_budget",
                    count: todayCount,
                    max_push_per_day: maxPerDay,
                }, 200);
            }
        }
    }

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

    const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(messages),
    });
    const expo = await res.json().catch(() => null);

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
