import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  Target, Users, Receipt, Clock, X, ChevronRight, LayoutDashboard,
  MousePointerClick, ShoppingCart, UserCheck, Route, Radio, Sparkles, Percent,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────
type Snapshot = {
  source?: string | null; medium?: string | null; campaign?: string | null;
  content?: string | null; term?: string | null; ad_id?: string | null;
  campaign_id?: string | null; ocorrido_em?: string | null;
} | null;

type Pedido = {
  pedido_id: string;
  cliente_id: number | null;
  valor: number | null;
  produto: string | null;
  ocorrido_em: string;
  vid_no_pedido?: string | null;
  primeiro_toque: Snapshot;
  ultimo_toque: Snapshot;
};
type Cliente = { cliente_id: number; email: string; cnpj: string | null; nome: string | null };
type Gasto = { dia: string; canal: string; campaign_id: string | null; campaign_name: string | null; ad_id: string | null; ad_name: string | null; gasto: number };
type Toque = {
  id: number; vid: string; ocorrido_em: string; tipo: string | null;
  source: string | null; medium: string | null; campaign: string | null;
  content: string | null; term: string | null;
  campaign_id: string | null; adset_id: string | null; ad_id: string | null;
  fbclid: string | null; gclid: string | null;
  landing_url: string | null; device: string | null;
};

type Modelo = "primeiro" | "ultimo";
type SubTab = "visao" | "origens" | "criativos" | "pedidos" | "clientes";
const SEM_ATRIB = "(sem origem registrada)";

// ── Canais (paleta validada p/ daltonismo — dataviz) ─────────────────────────
const CANAIS = {
  google: { label: "Google", cor: "#2a78d6" },
  meta:   { label: "Meta",   cor: "#d55181" },
  teste:  { label: "Teste",  cor: "#c98500" },
  outros: { label: "Outros", cor: "#199e70" },
  direto: { label: "Direto", cor: "#64748b" }, // cinza deliberado = "sem campanha"
} as const;
type CanalKey = keyof typeof CANAIS;

function canalDe(source?: string | null, gclid?: string | null, fbclid?: string | null): CanalKey {
  const s = (source || "").toLowerCase();
  if (["google", "adwords", "googleads", "youtube", "gads"].includes(s)) return "google";
  if (["facebook", "fb", "ig", "an", "msg", "instagram", "meta"].includes(s)) return "meta";
  if (s === "teste") return "teste";
  if (!s) return gclid ? "google" : fbclid ? "meta" : "direto";
  return "outros";
}

// ── Utils ────────────────────────────────────────────────────────────────────
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const dtHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dias = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const diaKey = (iso: string) => iso.slice(0, 10);

// ── Componente principal ─────────────────────────────────────────────────────
export function AtribuicaoTab() {
  const [sub, setSub] = useState<SubTab>("visao");
  const [toques, setToques] = useState<Toque[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelo, setModelo] = useState<Modelo>("primeiro");
  const [jornadaDe, setJornadaDe] = useState<Cliente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tq }, { data: peds }, { data: clis }, { data: gst }] = await Promise.all([
      supabase.from("atr_toques")
        .select("id, vid, ocorrido_em, tipo, source, medium, campaign, content, term, campaign_id, adset_id, ad_id, fbclid, gclid, landing_url, device")
        .order("ocorrido_em", { ascending: false }).limit(3000),
      supabase.from("atr_pedidos")
        .select("pedido_id, cliente_id, valor, produto, ocorrido_em, vid_no_pedido, primeiro_toque, ultimo_toque")
        .order("ocorrido_em", { ascending: false }).limit(2000),
      supabase.from("atr_clientes").select("cliente_id, email, cnpj, nome").limit(3000),
      supabase.from("atr_gastos").select("dia, canal, campaign_id, campaign_name, ad_id, ad_name, gasto").limit(8000),
    ]);
    setToques((tq as any) ?? []);
    setPedidos((peds as any) ?? []);
    setClientes((clis as any) ?? []);
    setGastos((gst as any) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.cliente_id, c])), [clientes]);
  const vazio = !loading && toques.length === 0 && pedidos.length === 0;

  const SUBS: { k: SubTab; l: string; Ic: any }[] = [
    { k: "visao", l: "Visão Geral", Ic: LayoutDashboard },
    { k: "origens", l: "Origens (UTMs)", Ic: Radio },
    { k: "criativos", l: "Criativos & Campanhas", Ic: Sparkles },
    { k: "pedidos", l: "Pedidos", Ic: ShoppingCart },
    { k: "clientes", l: "Clientes", Ic: Users },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">Atribuição</h2>
            <p className="text-xs text-neutral-500">Origem de cada toque, criativo e cliente — do clique à compra.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {([["primeiro", "1º toque"], ["ultimo", "Último toque"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setModelo(v)}
              title={v === "primeiro" ? "Crédito pra quem TROUXE o cliente" : "Crédito pra quem FECHOU a venda"}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${modelo === v ? "bg-white text-indigo-700 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-800"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1.5 flex-wrap">
        {SUBS.map(({ k, l, Ic }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${sub === k ? "bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm" : "bg-white text-neutral-500 border-neutral-200 hover:text-neutral-800"}`}>
            <Ic className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {vazio && (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <MousePointerClick className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-700">Aguardando os primeiros dados</h3>
          <p className="text-sm text-neutral-500 mt-1">Publique as tags do GTM e os toques/pedidos aparecem aqui.</p>
        </div>
      )}

      {!vazio && sub === "visao" && <VisaoGeral toques={toques} pedidos={pedidos} modelo={modelo} />}
      {!vazio && sub === "origens" && <Origens toques={toques} />}
      {!vazio && sub === "criativos" && <Criativos pedidos={pedidos} toques={toques} gastos={gastos} modelo={modelo} clientePorId={clientePorId} onJornada={setJornadaDe} />}
      {!vazio && sub === "pedidos" && <PedidosView pedidos={pedidos} clientePorId={clientePorId} onJornada={setJornadaDe} />}
      {!vazio && sub === "clientes" && <ClientesView pedidos={pedidos} clientes={clientes} onJornada={setJornadaDe} />}

      {loading && <p className="text-xs text-neutral-400">Carregando...</p>}
      {jornadaDe && <JornadaDrawer cliente={jornadaDe} onClose={() => setJornadaDe(null)} />}
    </div>
  );
}

// ═════════════════════════ SUB-ABA: VISÃO GERAL ═════════════════════════════
function VisaoGeral({ toques, pedidos, modelo }: { toques: Toque[]; pedidos: Pedido[]; modelo: Modelo }) {
  const receita = useMemo(() => pedidos.reduce((s, p) => s + (Number(p.valor) || 0), 0), [pedidos]);
  const clientesUnicos = useMemo(() => new Set(pedidos.map((p) => p.cliente_id).filter(Boolean)).size, [pedidos]);
  const comOrigem = useMemo(() => pedidos.filter((p) => p.primeiro_toque).length, [pedidos]);
  const pctOrigem = pedidos.length ? Math.round((comOrigem / pedidos.length) * 100) : 0;
  const tempoMedio = useMemo(() => {
    const ds = pedidos.filter((p) => p.primeiro_toque?.ocorrido_em).map((p) => dias(p.primeiro_toque!.ocorrido_em!, p.ocorrido_em));
    return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
  }, [pedidos]);

  // Série diária (14 dias) empilhada por canal
  const serieDiaria = useMemo(() => {
    const hoje = new Date();
    const diasArr: { dia: string; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      diasArr.push({ dia: key, label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` });
    }
    const base = diasArr.map((d) => ({ label: d.label, dia: d.dia, google: 0, meta: 0, teste: 0, outros: 0, direto: 0 }));
    const idx = Object.fromEntries(base.map((b, i) => [b.dia, i]));
    for (const t of toques) {
      const k = diaKey(t.ocorrido_em);
      if (idx[k] == null) continue;
      (base[idx[k]] as any)[canalDe(t.source, t.gclid, t.fbclid)] += 1;
    }
    return base;
  }, [toques]);

  // Donut por canal (toques) + receita por canal (pedidos, modelo escolhido)
  const porCanalToques = useMemo(() => {
    const m: Record<CanalKey, number> = { google: 0, meta: 0, teste: 0, outros: 0, direto: 0 };
    for (const t of toques) m[canalDe(t.source, t.gclid, t.fbclid)] += 1;
    return (Object.keys(CANAIS) as CanalKey[]).map((k) => ({ k, name: CANAIS[k].label, value: m[k], cor: CANAIS[k].cor })).filter((x) => x.value > 0);
  }, [toques]);

  const receitaPorCanal = useMemo(() => {
    const m: Record<CanalKey, { receita: number; pedidos: number }> = {
      google: { receita: 0, pedidos: 0 }, meta: { receita: 0, pedidos: 0 }, teste: { receita: 0, pedidos: 0 },
      outros: { receita: 0, pedidos: 0 }, direto: { receita: 0, pedidos: 0 },
    };
    for (const p of pedidos) {
      const snap = modelo === "primeiro" ? p.primeiro_toque : p.ultimo_toque;
      const k = snap ? canalDe(snap.source) : "direto";
      m[k].receita += Number(p.valor) || 0; m[k].pedidos += 1;
    }
    return (Object.keys(CANAIS) as CanalKey[]).map((k) => ({ k, ...CANAIS[k], ...m[k] })).filter((x) => x.pedidos > 0)
      .sort((a, b) => b.receita - a.receita);
  }, [pedidos, modelo]);
  const maxRec = Math.max(1, ...receitaPorCanal.map((r) => r.receita));

  const canaisPresentes = (Object.keys(CANAIS) as CanalKey[]).filter((k) => serieDiaria.some((d) => (d as any)[k] > 0));

  return (
    <>
      {/* KPIs primários */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icone={<MousePointerClick className="w-4 h-4" />} rotulo="Toques" valor={String(toques.length)} />
        <Kpi icone={<ShoppingCart className="w-4 h-4" />} rotulo="Pedidos" valor={String(pedidos.length)} />
        <Kpi icone={<Percent className="w-4 h-4" />} rotulo="Pedidos c/ origem" valor={`${pctOrigem}%`} destaque={pctOrigem < 30 ? "baixo — cresce com o tempo" : undefined} />
        <Kpi icone={<Receipt className="w-4 h-4" />} rotulo="Receita" valor={brl(receita)} />
        <Kpi icone={<Users className="w-4 h-4" />} rotulo="Clientes" valor={String(clientesUnicos)} />
        <Kpi icone={<Clock className="w-4 h-4" />} rotulo="Tempo até compra" valor={tempoMedio == null ? "—" : `${tempoMedio.toFixed(1)}d`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Toques por dia (empilhado por canal) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-neutral-700">Toques por dia · últimos 14 dias</h3>
            <Legenda canais={canaisPresentes} />
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieDiaria} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#f1f2f4" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={26} />
                <RTooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
                {canaisPresentes.map((k) => (
                  <Bar key={k} dataKey={k} name={CANAIS[k].label} stackId="a" fill={CANAIS[k].cor} stroke="#ffffff" strokeWidth={1} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut por fonte */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-1">Toques por canal</h3>
          <div className="flex items-center gap-2">
            <div style={{ width: 130, height: 130 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porCanalToques} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                    {porCanalToques.map((e) => <Cell key={e.k} fill={e.cor} />)}
                  </Pie>
                  <RTooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {porCanalToques.map((e) => (
                <div key={e.k} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.cor }} />
                  <span className="text-neutral-600 flex-1">{e.name}</span>
                  <span className="font-semibold text-neutral-800">{e.value}</span>
                  <span className="text-neutral-400 w-9 text-right">{toques.length ? Math.round((e.value / toques.length) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Receita por canal (modelo) */}
          <h3 className="text-sm font-semibold text-neutral-700 mt-4 mb-2">Receita por canal <span className="text-[10px] font-normal text-neutral-400">· {modelo === "primeiro" ? "1º toque" : "último toque"}</span></h3>
          <div className="space-y-2">
            {receitaPorCanal.map((r) => (
              <div key={r.k} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.cor }} />
                  <span className="text-neutral-600 flex-1">{r.label}</span>
                  <span className="font-semibold text-neutral-800">{brl(r.receita)}</span>
                  <span className="text-neutral-400">· {r.pedidos} ped.</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden ml-[18px]">
                  <div className="h-full rounded-full" style={{ width: `${(r.receita / maxRec) * 100}%`, background: r.cor }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ═════════════════════════ SUB-ABA: ORIGENS (UTMs) ══════════════════════════
function Origens({ toques }: { toques: Toque[] }) {
  const [filtroCanal, setFiltroCanal] = useState<CanalKey | "all">("all");
  const [periodo, setPeriodo] = useState<7 | 14 | 30 | 0>(14);

  const filtrados = useMemo(() => {
    const corte = periodo ? Date.now() - periodo * 86400000 : 0;
    return toques.filter((t) =>
      (filtroCanal === "all" || canalDe(t.source, t.gclid, t.fbclid) === filtroCanal) &&
      (!corte || new Date(t.ocorrido_em).getTime() >= corte));
  }, [toques, filtroCanal, periodo]);

  // agrupamento por utm_source CRUA (expõe fb/ig/an/adwords pra padronizar)
  const porSourceCru = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of filtrados) m[t.source || "(vazio — só clid)"] = (m[t.source || "(vazio — só clid)"] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFiltroCanal("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border ${filtroCanal === "all" ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-200"}`}>Todos</button>
        {(Object.keys(CANAIS) as CanalKey[]).map((k) => (
          <button key={k} onClick={() => setFiltroCanal(filtroCanal === k ? "all" : k)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border ${filtroCanal === k ? "text-white border-transparent" : "bg-white text-neutral-600 border-neutral-200"}`}
            style={filtroCanal === k ? { background: CANAIS[k].cor } : undefined}>
            <span className="w-2 h-2 rounded-full" style={{ background: filtroCanal === k ? "#fff" : CANAIS[k].cor }} />{CANAIS[k].label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
          {([[7, "7d"], [14, "14d"], [30, "30d"], [0, "Tudo"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v as any)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${periodo === v ? "bg-indigo-50 text-indigo-700" : "text-neutral-500"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Feed de toques (a exposição crua que o gestor pediu) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-700">Feed de toques</span>
            <span className="text-xs text-neutral-400">{filtrados.length} no período</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-2 py-2">Canal</th>
                  <th className="px-2 py-2">Campanha</th>
                  <th className="px-2 py-2">Criativo / termo</th>
                  <th className="px-2 py-2">ad_id</th>
                  <th className="px-2 py-2">Disp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtrados.slice(0, 80).map((t) => {
                  const k = canalDe(t.source, t.gclid, t.fbclid);
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50" title={t.landing_url ?? ""}>
                      <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">{dtHora(t.ocorrido_em)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: CANAIS[k].cor }} />
                          <span className="text-neutral-700 font-medium">{CANAIS[k].label}</span>
                          <span className="text-neutral-400">({t.source || (t.gclid ? "gclid" : t.fbclid ? "fbclid" : "—")})</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-neutral-600 max-w-[160px] truncate">{t.campaign || t.campaign_id || "—"}</td>
                      <td className="px-2 py-2 text-neutral-800 font-medium max-w-[200px] truncate">{t.term || t.content || "—"}</td>
                      <td className="px-2 py-2 text-neutral-400 font-mono">{t.ad_id || "—"}</td>
                      <td className="px-2 py-2 text-neutral-500">{t.device || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtrados.length > 80 && <p className="px-4 py-2 text-[11px] text-neutral-400">Mostrando 80 de {filtrados.length}.</p>}
          </div>
        </div>

        {/* utm_source crua — auditoria de padronização */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-neutral-700">utm_source crua</h3>
          <p className="text-[11px] text-neutral-400 mb-3">Como cada fonte está chegando — útil pra flagrar UTM fora do padrão (ex.: fb/ig/an em vez de facebook).</p>
          <div className="space-y-1.5">
            {porSourceCru.map(([s, n]) => {
              const k = canalDe(s === "(vazio — só clid)" ? null : s);
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CANAIS[k].cor }} />
                  <span className="font-mono text-neutral-700 flex-1 truncate">{s}</span>
                  <span className="font-semibold text-neutral-800">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════ SUB-ABA: CRIATIVOS & CAMPANHAS ═══════════════════════════
function Criativos({ pedidos, toques, gastos, modelo, clientePorId, onJornada }: {
  pedidos: Pedido[]; toques: Toque[]; gastos: Gasto[]; modelo: Modelo;
  clientePorId: Record<string, Cliente>; onJornada: (c: Cliente) => void;
}) {
  const [nivel, setNivel] = useState<"criativo" | "campanha">("criativo");
  const [aberto, setAberto] = useState<string | null>(null);

  // gasto agregado por ad_id, nome do anúncio e campanha (casa por ID ou por nome)
  const gastoIdx = useMemo(() => {
    const porAdId: Record<string, number> = {};
    const porAdNome: Record<string, number> = {};
    const porCampId: Record<string, number> = {};
    const porCampNome: Record<string, number> = {};
    for (const g of gastos) {
      const v = Number(g.gasto) || 0;
      if (g.ad_id) porAdId[g.ad_id] = (porAdId[g.ad_id] ?? 0) + v;
      if (g.ad_name) porAdNome[g.ad_name.trim().toLowerCase()] = (porAdNome[g.ad_name.trim().toLowerCase()] ?? 0) + v;
      if (g.campaign_id) porCampId[g.campaign_id] = (porCampId[g.campaign_id] ?? 0) + v;
      if (g.campaign_name) porCampNome[g.campaign_name.trim().toLowerCase()] = (porCampNome[g.campaign_name.trim().toLowerCase()] ?? 0) + v;
    }
    return { porAdId, porAdNome, porCampId, porCampNome };
  }, [gastos]);

  const gastoDe = useCallback((nome: string, adId: string | null): number | null => {
    const k = nome.trim().toLowerCase();
    if (nivel === "criativo") {
      if (adId && gastoIdx.porAdId[adId] != null) return gastoIdx.porAdId[adId];
      if (gastoIdx.porAdNome[k] != null) return gastoIdx.porAdNome[k];
    } else {
      if (gastoIdx.porCampNome[k] != null) return gastoIdx.porCampNome[k];
      if (gastoIdx.porCampId[nome] != null) return gastoIdx.porCampId[nome];
    }
    return null;
  }, [gastoIdx, nivel]);

  const chaveDe = useCallback((s: Snapshot) => {
    if (!s) return SEM_ATRIB;
    return nivel === "criativo" ? (s.term || s.ad_id || s.campaign || SEM_ATRIB) : (s.campaign || s.campaign_id || SEM_ATRIB);
  }, [nivel]);
  const chaveToque = useCallback((t: Toque) =>
    nivel === "criativo" ? (t.term || t.ad_id || t.campaign || SEM_ATRIB) : (t.campaign || t.campaign_id || SEM_ATRIB), [nivel]);

  const ranking = useMemo(() => {
    const m: Record<string, { pedidos: Pedido[]; receita: number; clientes: Set<number | null>; toques: number; canal: CanalKey; adIds: Set<string>; trouxe: number; fechou: number }> = {};
    const linha = (key: string, canal: CanalKey) =>
      (m[key] ??= { pedidos: [], receita: 0, clientes: new Set(), toques: 0, canal, adIds: new Set(), trouxe: 0, fechou: 0 });
    for (const t of toques) {
      const r = linha(chaveToque(t), canalDe(t.source, t.gclid, t.fbclid));
      r.toques += 1;
      if (t.ad_id) r.adIds.add(t.ad_id);
    }
    for (const p of pedidos) {
      // papel de introdutor (1º toque) e fechador (último) — independentes do modelo
      if (p.primeiro_toque) linha(chaveDe(p.primeiro_toque), canalDe(p.primeiro_toque.source)).trouxe += 1;
      if (p.ultimo_toque) linha(chaveDe(p.ultimo_toque), canalDe(p.ultimo_toque.source)).fechou += 1;
      // receita/pedidos/clientes seguem o modelo escolhido
      const snap = modelo === "primeiro" ? p.primeiro_toque : p.ultimo_toque;
      const r = linha(chaveDe(snap), snap ? canalDe(snap.source) : "direto");
      r.pedidos.push(p); r.receita += Number(p.valor) || 0; r.clientes.add(p.cliente_id);
      if (snap?.ad_id) r.adIds.add(snap.ad_id);
    }
    return Object.entries(m)
      .map(([nome, r]) => ({ nome, nPedidos: r.pedidos.length, receita: r.receita, nClientes: r.clientes.size, toques: r.toques, canal: r.canal, adId: [...r.adIds][0] ?? null, pedidos: r.pedidos, trouxe: r.trouxe, fechou: r.fechou }))
      .sort((a, b) => b.receita - a.receita || b.toques - a.toques);
  }, [toques, pedidos, chaveDe, chaveToque, modelo]);
  const maxReceita = Math.max(1, ...ranking.map((r) => r.receita));
  const linhaAberta = ranking.find((r) => r.nome === aberto) ?? null;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-neutral-700">Ranking</span>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {([["criativo", "Por criativo"], ["campanha", "Por campanha"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setNivel(v); setAberto(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${nivel === v ? "bg-white text-indigo-700 shadow-sm border border-neutral-200" : "text-neutral-500"}`}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-neutral-400">· modelo: {modelo === "primeiro" ? "1º toque (quem trouxe)" : "último toque (quem fechou)"}</span>
      </div>

      {/* Cabeçalho de colunas */}
      <div className="px-4 py-2 border-b border-neutral-100 hidden md:flex items-center gap-3 text-[10px] uppercase tracking-wide text-neutral-400">
        <span className="flex-1">{nivel === "criativo" ? "Criativo" : "Campanha"}</span>
        <span className="w-16 text-right">Toques</span>
        <span className="w-24 text-right">Receita</span>
        <span className="w-16 text-right">Pedidos</span>
        <span className="w-16 text-right">Clientes</span>
        <span className="w-20 text-right" title="Pedidos em que foi o 1º toque (introduziu) / o último (fechou)">Trouxe/Fechou</span>
        <span className="w-20 text-right" title="Gasto sincronizado do Meta (do go-live em diante)">Gasto</span>
        <span className="w-16 text-right" title="Receita atribuída ÷ gasto">ROAS</span>
        <span className="w-4" />
      </div>

      <div className="divide-y divide-neutral-100">
        {ranking.map((r) => (
          <div key={r.nome}>
            <button onClick={() => setAberto(aberto === r.nome ? null : r.nome)}
              className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors ${aberto === r.nome ? "bg-indigo-50/50" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CANAIS[r.canal].cor }} />
                    <span className={`text-sm font-medium truncate ${r.nome === SEM_ATRIB ? "text-neutral-400 italic" : "text-neutral-800"}`}>{r.nome}</span>
                    {r.adId && <span className="text-[10px] font-mono text-neutral-400 shrink-0">#{r.adId}</span>}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(r.receita / maxReceita) * 100}%`, background: CANAIS[r.canal].cor }} />
                  </div>
                </div>
                <span className="w-16 text-right text-sm text-neutral-600">{r.toques}</span>
                <span className="w-24 text-right text-sm font-semibold text-neutral-800">{brl(r.receita)}</span>
                <span className="w-16 text-right text-sm text-neutral-600">{r.nPedidos}</span>
                <span className="w-16 text-right text-sm text-neutral-600">{r.nClientes}</span>
                <span className="w-20 text-right text-sm whitespace-nowrap" title="Trouxe (1º toque) / Fechou (último toque)">
                  <span className="text-indigo-600 font-medium">{r.trouxe}</span>
                  <span className="text-neutral-300"> / </span>
                  <span className="text-emerald-600 font-medium">{r.fechou}</span>
                </span>
                {(() => {
                  const g = gastoDe(r.nome, r.adId);
                  const roas = g && g > 0 ? r.receita / g : null;
                  return (
                    <>
                      <span className="w-20 text-right text-sm text-neutral-600 whitespace-nowrap">{g != null ? brl(g) : <span className="text-neutral-300">—</span>}</span>
                      <span className={`w-16 text-right text-sm font-semibold whitespace-nowrap ${roas == null ? "text-neutral-300" : roas >= 1 ? "text-emerald-600" : "text-red-500"}`}>
                        {roas == null ? "—" : `${roas.toFixed(1)}x`}
                      </span>
                    </>
                  );
                })()}
                <ChevronRight className={`w-4 h-4 text-neutral-300 transition-transform ${aberto === r.nome ? "rotate-90" : ""}`} />
              </div>
            </button>
            {aberto === r.nome && linhaAberta && (
              <div className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-neutral-50/50 divide-y divide-neutral-100">
                {linhaAberta.pedidos.length === 0 && <p className="px-3 py-3 text-xs text-neutral-400">Tem toques mas ainda nenhum pedido atribuído — normal no início.</p>}
                {linhaAberta.pedidos.map((p) => {
                  const c = p.cliente_id ? clientePorId[p.cliente_id] : null;
                  return (
                    <div key={p.pedido_id} className="px-3 py-2 flex items-center gap-3 text-sm">
                      <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-neutral-800">{c?.nome || c?.email || "(não identificado)"}</span>
                        <div className="text-[11px] text-neutral-400 truncate">pedido {p.pedido_id}{p.produto ? ` · ${p.produto}` : ""} · {dt(p.ocorrido_em)}</div>
                      </div>
                      <span className="font-semibold text-neutral-700 shrink-0">{p.valor != null ? brl(Number(p.valor)) : "—"}</span>
                      {c && (
                        <button onClick={() => onJornada(c)}
                          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50">
                          <Route className="w-3 h-3" /> Jornada
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="px-4 py-2.5 text-[11px] text-neutral-400 border-t border-neutral-100">
        Gasto = Meta, sincronizado do go-live (15/07) em diante — casa por ad_id ou pelo nome do anúncio. Google entra quando o sufixo de URL estiver ativo. ROAS = receita atribuída ÷ gasto; verde ≥ 1x.
      </p>
    </div>
  );
}

// ═════════════════════════ SUB-ABA: PEDIDOS ═════════════════════════════════
function PedidosView({ pedidos, clientePorId, onJornada }: {
  pedidos: Pedido[]; clientePorId: Record<string, Cliente>; onJornada: (c: Cliente) => void;
}) {
  const [filtro, setFiltro] = useState<"todos" | "com" | "sem">("todos");
  const lista = useMemo(() => pedidos.filter((p) =>
    filtro === "todos" ? true : filtro === "com" ? !!p.primeiro_toque : !p.primeiro_toque), [pedidos, filtro]);

  const ToqueCell = ({ s }: { s: Snapshot }) => {
    if (!s) return <span className="text-neutral-300 italic">—</span>;
    const k = canalDe(s.source);
    return (
      <span className="inline-flex items-center gap-1.5 max-w-[190px]">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CANAIS[k].cor }} />
        <span className="text-neutral-700 truncate">{s.term || s.campaign || CANAIS[k].label}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-neutral-700">Todos os pedidos capturados</span>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {([["todos", "Todos"], ["com", "Com origem"], ["sem", "Sem origem"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${filtro === v ? "bg-white text-indigo-700 shadow-sm border border-neutral-200" : "text-neutral-500"}`}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-neutral-400">{lista.length} pedido(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
              <th className="px-4 py-2">Pedido</th>
              <th className="px-2 py-2">Cliente</th>
              <th className="px-2 py-2 text-right">Valor</th>
              <th className="px-2 py-2">1º toque (trouxe)</th>
              <th className="px-2 py-2">Último toque (fechou)</th>
              <th className="px-2 py-2 text-right">Tempo</th>
              <th className="px-2 py-2 text-center" title="Cookie do visitante presente na compra">vid</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {lista.map((p) => {
              const c = p.cliente_id ? clientePorId[p.cliente_id] : null;
              const multi = p.primeiro_toque && p.ultimo_toque && p.primeiro_toque.ocorrido_em !== p.ultimo_toque.ocorrido_em;
              const tempo = p.primeiro_toque?.ocorrido_em ? dias(p.primeiro_toque.ocorrido_em, p.ocorrido_em) : null;
              return (
                <tr key={p.pedido_id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-neutral-700">{p.pedido_id}</div>
                    <div className="text-neutral-400 max-w-[180px] truncate">{p.produto || ""} · {dt(p.ocorrido_em)}</div>
                  </td>
                  <td className="px-2 py-2.5 text-neutral-700 max-w-[160px] truncate">{c?.nome || c?.email || <span className="text-neutral-300 italic">não identificado</span>}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-neutral-800 whitespace-nowrap">{p.valor != null ? brl(Number(p.valor)) : "—"}</td>
                  <td className="px-2 py-2.5"><ToqueCell s={p.primeiro_toque} /></td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <ToqueCell s={p.ultimo_toque} />
                      {multi && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1" title="Jornada multi-toque: o criativo que trouxe é diferente do que fechou">≠</span>}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-neutral-500 whitespace-nowrap">{tempo == null ? "—" : tempo < 1 ? "< 1d" : `${tempo.toFixed(0)}d`}</td>
                  <td className={`px-2 py-2.5 text-center ${p.vid_no_pedido ? "text-emerald-600" : "text-neutral-300"}`}>{p.vid_no_pedido ? "✓" : "—"}</td>
                  <td className="px-2 py-2.5 text-right">
                    {c && (
                      <button onClick={() => onJornada(c)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50">
                        <Route className="w-3 h-3" /> Jornada
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-neutral-400 border-t border-neutral-100">
        "Sem origem" = comprador entrou direto (recorrente) ou o toque é anterior ao rastreio. O ≠ marca jornadas multi-toque — criativo que trouxe difere do que fechou.
      </p>
    </div>
  );
}

// ═════════════════════════ SUB-ABA: CLIENTES ════════════════════════════════
function ClientesView({ pedidos, clientes, onJornada }: {
  pedidos: Pedido[]; clientes: Cliente[]; onJornada: (c: Cliente) => void;
}) {
  const linhas = useMemo(() => {
    const m: Record<number, { pedidos: number; receita: number; primeiro: Snapshot; primeiraCompra: string }> = {};
    for (const p of [...pedidos].sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em))) {
      if (!p.cliente_id) continue;
      const r = (m[p.cliente_id] ??= { pedidos: 0, receita: 0, primeiro: p.primeiro_toque, primeiraCompra: p.ocorrido_em });
      r.pedidos += 1; r.receita += Number(p.valor) || 0;
      if (!r.primeiro && p.primeiro_toque) r.primeiro = p.primeiro_toque;
    }
    return clientes
      .filter((c) => m[c.cliente_id])
      .map((c) => ({ c, ...m[c.cliente_id] }))
      .sort((a, b) => b.receita - a.receita);
  }, [pedidos, clientes]);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-700">Clientes identificados</span>
        <span className="text-xs text-neutral-400">{linhas.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
              <th className="px-4 py-2">Cliente</th>
              <th className="px-2 py-2">Origem (1º toque)</th>
              <th className="px-2 py-2 text-right">Pedidos</th>
              <th className="px-2 py-2 text-right">Receita</th>
              <th className="px-2 py-2 text-right">1ª compra</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {linhas.map(({ c, pedidos: nP, receita, primeiro, primeiraCompra }) => {
              const k = primeiro ? canalDe(primeiro.source) : "direto";
              return (
                <tr key={c.cliente_id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-neutral-800">{c.nome || c.email}</div>
                    {c.nome && <div className="text-neutral-400">{c.email}</div>}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: CANAIS[k].cor }} />
                      <span className="text-neutral-700">{primeiro ? (primeiro.term || primeiro.campaign || CANAIS[k].label) : "Direto / anterior ao rastreio"}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-neutral-600">{nP}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-neutral-800">{brl(receita)}</td>
                  <td className="px-2 py-2.5 text-right text-neutral-500 whitespace-nowrap">{dt(primeiraCompra)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <button onClick={() => onJornada(c)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50">
                      <Route className="w-3 h-3" /> Jornada
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Peças compartilhadas ─────────────────────────────────────────────────────
function Kpi({ icone, rotulo, valor, destaque }: { key?: React.Key; icone: React.ReactNode; rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-3.5">
      <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-medium uppercase tracking-wide">{icone}{rotulo}</div>
      <div className="text-lg font-semibold text-neutral-800 mt-1">{valor}</div>
      {destaque && <div className="text-[10px] text-amber-600 mt-0.5">{destaque}</div>}
    </div>
  );
}

function Legenda({ canais }: { canais: CanalKey[] }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {canais.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: CANAIS[k].cor }} />{CANAIS[k].label}
        </span>
      ))}
    </div>
  );
}

// ── Drawer: jornada do cliente ───────────────────────────────────────────────
function JornadaDrawer({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const [toques, setToques] = useState<Toque[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: ids } = await supabase.from("atr_identidades").select("vid").eq("cliente_id", cliente.cliente_id);
      const vids = (ids ?? []).map((i: any) => i.vid);
      const [tq, pd] = await Promise.all([
        vids.length
          ? supabase.from("atr_toques").select("id, vid, ocorrido_em, tipo, source, medium, campaign, content, term, campaign_id, adset_id, ad_id, fbclid, gclid, landing_url, device").in("vid", vids).order("ocorrido_em")
          : Promise.resolve({ data: [] } as any),
        supabase.from("atr_pedidos").select("pedido_id, cliente_id, valor, produto, ocorrido_em, primeiro_toque, ultimo_toque").eq("cliente_id", cliente.cliente_id).order("ocorrido_em"),
      ]);
      setToques((tq.data as any) ?? []);
      setPedidos((pd.data as any) ?? []);
      setLoading(false);
    })();
  }, [cliente.cliente_id]);

  const eventos = useMemo(() => {
    const evs: { quando: string; tipo: "toque" | "pedido"; titulo: string; detalhe: string; cor: string }[] = [
      ...toques.map((t) => {
        const k = canalDe(t.source, t.gclid, t.fbclid);
        return {
          quando: t.ocorrido_em, tipo: "toque" as const,
          titulo: t.term || t.campaign || CANAIS[k].label,
          detalhe: [CANAIS[k].label, t.medium, t.campaign].filter(Boolean).join(" · "),
          cor: CANAIS[k].cor,
        };
      }),
      ...pedidos.map((p) => ({
        quando: p.ocorrido_em, tipo: "pedido" as const,
        titulo: `Compra — pedido ${p.pedido_id}`,
        detalhe: [p.produto, p.valor != null ? brl(Number(p.valor)) : null].filter(Boolean).join(" · "),
        cor: "#22c55e",
      })),
    ];
    return evs.sort((a, b) => a.quando.localeCompare(b.quando));
  }, [toques, pedidos]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-5 border-b border-neutral-200 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Route className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-neutral-800 truncate">{cliente.nome || cliente.email}</h3>
            <p className="text-xs text-neutral-500 truncate">{cliente.email}{cliente.cnpj ? ` · CNPJ ${cliente.cnpj}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-xs text-neutral-400">Carregando jornada...</p>}
          {!loading && eventos.length === 0 && <p className="text-sm text-neutral-400">Sem eventos registrados pra este cliente ainda.</p>}
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-neutral-200" />
            {eventos.map((ev, i) => (
              <div key={i} className="relative pb-4">
                <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: ev.cor }} />
                <div className="text-[11px] text-neutral-400">{dtHora(ev.quando)}</div>
                <div className={`text-sm font-medium ${ev.tipo === "pedido" ? "text-emerald-700" : "text-neutral-800"}`}>{ev.titulo}</div>
                {ev.detalhe && <div className="text-xs text-neutral-500">{ev.detalhe}</div>}
              </div>
            ))}
          </div>
          {!loading && toques.length > 0 && pedidos.length > 0 && (
            <div className="mt-2 rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-xs text-neutral-600">
              <b>{toques.length}</b> toque(s) até a 1ª compra em <b>{dias(toques[0].ocorrido_em, pedidos[0].ocorrido_em).toFixed(1)} dias</b>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
