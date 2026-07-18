// Edge Function: admin-actions — só ADMIN pode resetar senha / excluir usuário.
// Verifica o JWT do chamador e o papel 'admin' em fn_profiles; usa service_role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
    const caller = userData?.user;
    if (uErr || !caller) return json({ error: "unauthorized" }, 401);

    const { data: prof } = await admin.from("fn_profiles").select("role").eq("id", caller.id).single();
    if (!prof || prof.role !== "admin") return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, userId } = body ?? {};
    if (!userId) return json({ error: "userId required" }, 400);
    if (userId === caller.id) return json({ error: "operação não permitida na própria conta admin" }, 400);

    if (action === "reset_password") {
      const password = genPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ password });
    }
    if (action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "invalid action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
