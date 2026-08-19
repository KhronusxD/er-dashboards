// ============================================================================
// Edge Function: sync-gastos
// Puxa gasto por anúncio (Meta) e por campanha (Google Ads) e grava em
// napan.atr_gastos via RPC napan.ingest_gastos (service_role).
// Acionada pelo botão "Atualizar dados" da aba Atribuição.
//
// Segurança: verify_jwt = true (só usuário logado do painel chama). Tokens das
// plataformas vivem como secrets do projeto (Deno.env), nunca no navegador.
// Leitura-apenas nas APIs de anúncio (insights / GAQL). Não gasta, não altera
// campanha. Upsert idempotente por (dia, canal, ad_id, campaign_id).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_ACCOUNT = "act_1068007256556528"; // [NP] Atual Card Brasil
const GADS_CUSTOMER = "7178430422";          // Atual Card
const GO_LIVE = "2026-07-15";                 // início da atribuição

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

// pega o 1º action_type que casar (omni_purchase cobre pixel+app+loja)
function acao(lista: any[], tipos: string[]): number {
  const m: Record<string, any> = {};
  for (const a of lista || []) m[a.action_type] = a.value;
  for (const t of tipos) if (t in m) return Number(m[t] || 0);
  return 0;
}

// ---------- META ----------
async function puxaMeta(since: string, until: string) {
  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!token) throw new Error("META_ACCESS_TOKEN ausente");
  const base = `https://graph.facebook.com/v22.0/${META_ACCOUNT}/insights`;
  const params = new URLSearchParams({
    level: "ad",
    fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions,action_values",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    limit: "500",
    access_token: token,
  });
  let url: string | null = `${base}?${params.toString()}`;
  const rows: any[] = [];
  const transitorio = (m: string) => /temporarily|rate limit|request limit|try again|reduce the amount|please reduce|unknown error/i.test(m || "");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let page = 0; page < 20 && url; page++) {
    // RETRY em erro transitório do Graph API (senão o botão falha à toa)
    let d: any = null;
    for (let tent = 1; tent <= 5; tent++) {
      const resp = await fetch(url);
      d = await resp.json();
      if (!d.error) break;
      if (transitorio(d.error.message) && tent < 5) { await sleep(tent * 2000); continue; }
      break;
    }
    if (d.error) throw new Error("Graph API: " + (d.error.message || "?"));
    for (const r of d.data || []) {
      rows.push({
        dia: r.date_start,
        campaign_id: r.campaign_id ?? "", campaign_name: r.campaign_name ?? "",
        adset_id: r.adset_id ?? "", adset_name: r.adset_name ?? "",
        ad_id: r.ad_id ?? "", ad_name: r.ad_name ?? "",
        gasto: Number(r.spend || 0),
        impressoes: Number(r.impressions || 0),
        cliques: Number(r.inline_link_clicks || 0),
        plataforma_compras: Math.round(acao(r.actions, ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"])),
        plataforma_receita: acao(r.action_values, ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"]),
      });
    }
    url = d.paging?.next ?? null;
  }
  return rows;
}

// ---------- GOOGLE ----------
async function puxaGoogle(since: string, until: string) {
  const cid = Deno.env.get("GADS_CLIENT_ID");
  const csec = Deno.env.get("GADS_CLIENT_SECRET");
  const refresh = Deno.env.get("GADS_REFRESH_TOKEN");
  const devtok = Deno.env.get("GADS_DEVELOPER_TOKEN");
  const loginCid = Deno.env.get("GADS_LOGIN_CUSTOMER_ID");
  if (!cid || !csec || !refresh || !devtok) throw new Error("credenciais Google Ads ausentes");

  const tokResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cid, client_secret: csec, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const tokJson = await tokResp.json();
  const accessToken = tokJson.access_token;
  if (!accessToken) throw new Error("OAuth Google falhou: " + JSON.stringify(tokJson).slice(0, 200));

  const query =
    `SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, ` +
    `metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign ` +
    `WHERE segments.date BETWEEN '${since}' AND '${until}' AND metrics.cost_micros > 0`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "developer-token": devtok,
    "Content-Type": "application/json",
  };
  if (loginCid) headers["login-customer-id"] = loginCid;

  const resp = await fetch(
    `https://googleads.googleapis.com/v22/customers/${GADS_CUSTOMER}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const d = await resp.json();
  if (d && d.error) throw new Error("Google Ads API: " + String(d.error.message || "").slice(0, 300));

  const rows: any[] = [];
  for (const b of Array.isArray(d) ? d : []) {
    for (const r of b.results || []) {
      rows.push({
        dia: r.segments.date,
        campaign_id: String(r.campaign.id), campaign_name: r.campaign.name ?? "",
        adset_id: "", adset_name: "", ad_id: "", ad_name: "",
        gasto: Number(r.metrics.costMicros || 0) / 1e6,
        impressoes: Number(r.metrics.impressions || 0),
        cliques: Number(r.metrics.clicks || 0),
        plataforma_compras: Math.round(Number(r.metrics.conversions || 0)),
        plataforma_receita: Number(r.metrics.conversionsValue || 0),
      });
    }
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio ok */ }
  const since = (body.since as string) || GO_LIVE;
  const until = (body.until as string) || hoje();

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "napan" } },
  );

  const out: Record<string, any> = { periodo: { since, until } };

  // Meta e Google independentes: um falhar não derruba o outro.
  try {
    const rows = await puxaMeta(since, until);
    const { data, error } = await db.rpc("ingest_gastos", { p_canal: "meta", p_rows: rows });
    if (error) throw new Error(error.message);
    out.meta = { ok: true, ...data };
  } catch (e) {
    out.meta = { ok: false, erro: String(e?.message || e) };
  }

  try {
    const rows = await puxaGoogle(since, until);
    const { data, error } = await db.rpc("ingest_gastos", { p_canal: "google", p_rows: rows });
    if (error) throw new Error(error.message);
    out.google = { ok: true, ...data };
  } catch (e) {
    out.google = { ok: false, erro: String(e?.message || e) };
  }

  out.ok = (out.meta?.ok || out.google?.ok) === true;
  return json(out, out.ok ? 200 : 502);
});
