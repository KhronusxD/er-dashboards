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
type Cliente = { cliente_id: number; email: string; cnpj: string | null; nome: string | null; cpf?: string | null; telefone?: string | null; plataforma_id?: string | null };
type Gasto = { dia: string; canal: string; campaign_id: string | null; campaign_name: string | null; ad_id: string | null; ad_name: string | null; gasto: number; plataforma_compras: number | null; plataforma_receita: number | null };

// toque de ANÚNCIO (pago) vs orgânico/direto (pistas — não levam crédito pago)
const isAd = (t: Toque) => (t.tipo ?? "ad_click") === "ad_click";

type CampRow = { key: string; nome: string; gasto: number; pCompras: number; pReceita: number; aCompras: number; aReceita: number };

// ── Períodos (mesmas opções do gerenciador de anúncios) ─────────────────────
type PeriodoOpcao = "hoje" | "ontem" | "hoje_ontem" | "7d" | "14d" | "28d" | "30d" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "max" | "custom";
const PERIODOS: { v: PeriodoOpcao; l: string }[] = [
  { v: "hoje", l: "Hoje" },
  { v: "ontem", l: "Ontem" },
  { v: "hoje_ontem", l: "Hoje e ontem" },
  { v: "7d", l: "Últimos 7 dias" },
  { v: "14d", l: "Últimos 14 dias" },
  { v: "28d", l: "Últimos 28 dias" },
  { v: "30d", l: "Últimos 30 dias" },
  { v: "esta_semana", l: "Esta semana" },
  { v: "semana_passada", l: "Semana passada" },
  { v: "este_mes", l: "Este mês" },
  { v: "mes_passado", l: "Mês passado" },
  { v: "max", l: "Máximo" },
  { v: "custom", l: "Personalizado" },
];
type Intervalo = { ini: number; fim: number };
function intervaloPeriodo(op: PeriodoOpcao, ci: string, cf: string): Intervalo {
  const agora = new Date();
  const d0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime(); // hoje 00:00
  const DIA = 86400000;
  const fimHoje = d0 + DIA - 1;
  const ultimos = (n: number) => ({ ini: d0 - (n - 1) * DIA, fim: fimHoje });
  switch (op) {
    case "hoje": return { ini: d0, fim: fimHoje };
    case "ontem": return { ini: d0 - DIA, fim: d0 - 1 };
    case "hoje_ontem": return { ini: d0 - DIA, fim: fimHoje };
    case "7d": return ultimos(7);
    case "14d": return ultimos(14);
    case "28d": return ultimos(28);
    case "30d": return ultimos(30);
    case "esta_semana": return { ini: d0 - new Date(d0).getDay() * DIA, fim: fimHoje };
    case "semana_passada": { const dom = d0 - new Date(d0).getDay() * DIA; return { ini: dom - 7 * DIA, fim: dom - 1 }; }
    case "este_mes": return { ini: new Date(agora.getFullYear(), agora.getMonth(), 1).getTime(), fim: fimHoje };
    case "mes_passado": return { ini: new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getTime(), fim: new Date(agora.getFullYear(), agora.getMonth(), 1).getTime() - 1 };
    case "custom": return {
      ini: ci ? new Date(ci + "T00:00:00").getTime() : 0,
      fim: cf ? new Date(cf + "T23:59:59.999").getTime() : fimHoje,
    };
    default: return { ini: 0, fim: fimHoje }; // máximo
  }
}
type Toque = {
  id: number; vid: string; ocorrido_em: string; tipo: string | null;
  source: string | null; medium: string | null; campaign: string | null;
  content: string | null; term: string | null;
  campaign_id: string | null; adset_id: string | null; ad_id: string | null;
  fbclid: string | null; gclid: string | null;
  landing_url: string | null; device: string | null;
};

type Modelo = "primeiro" | "ultimo";
type SubTab = "visao" | "origens" | "criativos" | "pedidos" | "clientes" | "revendas";
type RevendaEvento = {
  id: number; ocorrido_em: string; host: string; evento: string; vid_local: string | null;
  source: string | null; campaign: string | null; term: string | null;
  campaign_id: string | null; ad_id: string | null;
  pedido_id: string | null; valor: number | null;
  campanha_nossa: boolean | null;
};
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
  const [periodoOpcao, setPeriodoOpcao] = useState<PeriodoOpcao>("14d");
  const [customIni, setCustomIni] = useState("");
  const [customFim, setCustomFim] = useState("");
  const [jornadaDe, setJornadaDe] = useState<Cliente | null>(null);
  const [vidAberto, setVidAberto] = useState<string | null>(null);

  const [totalToques, setTotalToques] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    // toques: o PostgREST corta em 1000 linhas por request — paginar de verdade
    const cols = "id, vid, ocorrido_em, tipo, source, medium, campaign, content, term, campaign_id, adset_id, ad_id, fbclid, gclid, landing_url, device";
    const pagina = (i: number) => supabase.from("atr_toques").select(cols)
      .order("ocorrido_em", { ascending: false }).range(i * 1000, i * 1000 + 999);
    const carregaToques = async () => {
      let tudo: Toque[] = [];
      for (let i = 0; i < 15; i++) {              // até 15k toques
        const { data } = await pagina(i);
        const chunk = (data as any) ?? [];
        tudo = tudo.concat(chunk);
        if (chunk.length < 1000) break;
      }
      return tudo;
    };
    const [tq, { count }, { data: peds }, { data: clis }, { data: gst }] = await Promise.all([
      carregaToques(),
      supabase.from("atr_toques").select("id", { count: "exact", head: true }),
      supabase.from("atr_pedidos")
        .select("pedido_id, cliente_id, valor, produto, ocorrido_em, vid_no_pedido, primeiro_toque, ultimo_toque")
        .order("ocorrido_em", { ascending: false }).limit(2000),
      supabase.from("atr_clientes").select("cliente_id, email, cnpj, cpf, nome, telefone, plataforma_id").limit(3000),
      supabase.from("atr_gastos").select("dia, canal, campaign_id, campaign_name, ad_id, ad_name, gasto, plataforma_compras, plataforma_receita").limit(8000),
    ]);
    setToques((tq as any) ?? []);
    setTotalToques(count ?? (tq as any[]).length);
    setPedidos((peds as any) ?? []);
    setClientes((clis as any) ?? []);
    setGastos((gst as any) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.cliente_id, c])), [clientes]);
  const vazio = !loading && toques.length === 0 && pedidos.length === 0;

  // Filtro GLOBAL de período (intervalo com início E fim) — vale pra todas as sub-abas
  const intervalo = useMemo(() => intervaloPeriodo(periodoOpcao, customIni, customFim), [periodoOpcao, customIni, customFim]);
  const dentro = useCallback((iso: string) => { const t = new Date(iso).getTime(); return t >= intervalo.ini && t <= intervalo.fim; }, [intervalo]);
  const toquesF = useMemo(() => toques.filter((t) => dentro(t.ocorrido_em)), [toques, dentro]);
  const pedidosF = useMemo(() => pedidos.filter((p) => dentro(p.ocorrido_em)), [pedidos, dentro]);
  const gastosF = useMemo(() => gastos.filter((g) => dentro(g.dia + "T12:00:00")), [gastos, dentro]);
  const totalToquesF = periodoOpcao === "max" ? totalToques : toquesF.length;

  const SUBS: { k: SubTab; l: string; Ic: any }[] = [
    { k: "visao", l: "Visão Geral", Ic: LayoutDashboard },
    { k: "origens", l: "Origens (UTMs)", Ic: Radio },
    { k: "criativos", l: "Criativos & Campanhas", Ic: Sparkles },
    { k: "pedidos", l: "Pedidos", Ic: ShoppingCart },
    { k: "clientes", l: "Clientes", Ic: Users },
    { k: "revendas", l: "Monitor Revendas", Ic: Radio },
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
        <div className="flex items-center gap-2 flex-wrap">
        <select value={periodoOpcao} onChange={(e) => setPeriodoOpcao(e.target.value as PeriodoOpcao)}
          title="Período — vale pra TODAS as sub-abas"
          className="text-xs font-medium border border-neutral-200 rounded-lg pl-2.5 pr-7 py-2 bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23737373' fill='none' stroke-width='1.5'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
          {PERIODOS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        {periodoOpcao === "custom" && (
          <span className="inline-flex items-center gap-1">
            <input type="date" value={customIni} onChange={(e) => setCustomIni(e.target.value)}
              className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-neutral-400 text-xs">a</span>
            <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)}
              className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </span>
        )}
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

      {!vazio && sub === "visao" && <VisaoGeral toques={toquesF} pedidos={pedidosF} gastos={gastosF} modelo={modelo} totalToques={totalToquesF} intervalo={intervalo} />}
      {!vazio && sub === "origens" && <Origens toques={toquesF} pedidos={pedidosF} gastos={gastos} modelo={modelo} clientePorId={clientePorId} onAbrirVid={setVidAberto} onJornada={setJornadaDe} />}
      {!vazio && sub === "criativos" && <Criativos pedidos={pedidosF} toques={toquesF} gastos={gastosF} modelo={modelo} clientePorId={clientePorId} onJornada={setJornadaDe} />}
      {!vazio && sub === "pedidos" && <PedidosView pedidos={pedidosF} clientePorId={clientePorId} onJornada={setJornadaDe} />}
      {!vazio && sub === "clientes" && <ClientesView pedidos={pedidosF} clientes={clientes} onJornada={setJornadaDe} />}
      {!vazio && sub === "revendas" && <MonitorRevendas intervalo={intervalo} />}

      {loading && <p className="text-xs text-neutral-400">Carregando...</p>}
      {jornadaDe && <JornadaDrawer cliente={jornadaDe} onClose={() => setJornadaDe(null)} />}
      {vidAberto && <VidDrawer vid={vidAberto} onClose={() => setVidAberto(null)} />}
    </div>
  );
}

// ═════════════════════════ SUB-ABA: VISÃO GERAL ═════════════════════════════
function VisaoGeral({ toques, pedidos, gastos, modelo, totalToques, intervalo }: { toques: Toque[]; pedidos: Pedido[]; gastos: Gasto[]; modelo: Modelo; totalToques: number; intervalo: Intervalo }) {
  // Dias do intervalo selecionado (ancorados no FIM do período; máx. 60 barras)
  const janelaDias = useMemo(() => {
    const DIA = 86400000;
    const f = new Date(intervalo.fim);
    const fim0 = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
    const ini0 = intervalo.ini > 0
      ? (() => { const i = new Date(intervalo.ini); return new Date(i.getFullYear(), i.getMonth(), i.getDate()).getTime(); })()
      : fim0 - 29 * DIA;
    const n = Math.min(60, Math.max(1, Math.round((fim0 - ini0) / DIA) + 1));
    const dias: { key: string; label: string }[] = [];
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(fim0 - k * DIA);
      dias.push({ key: d.toISOString().slice(0, 10), label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` });
    }
    return dias;
  }, [intervalo]);
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
    const base = janelaDias.map((d) => ({ label: d.label, dia: d.key, google: 0, meta: 0, teste: 0, outros: 0, direto: 0 }));
    const idx = Object.fromEntries(base.map((b, i) => [b.dia, i]));
    for (const t of toques) {
      if (!isAd(t)) continue;                       // gráfico = toques de anúncio
      const k = diaKey(t.ocorrido_em);
      if (idx[k] == null) continue;
      (base[idx[k]] as any)[canalDe(t.source, t.gclid, t.fbclid)] += 1;
    }
    return base;
  }, [toques, janelaDias]);

  // Donut por canal (toques) + receita por canal (pedidos, modelo escolhido)
  const porCanalToques = useMemo(() => {
    const m: Record<CanalKey, number> = { google: 0, meta: 0, teste: 0, outros: 0, direto: 0 };
    for (const t of toques) { if (isAd(t)) m[canalDe(t.source, t.gclid, t.fbclid)] += 1; }
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

  // Pedidos por dia (14d) — a leitura principal: com origem (por canal) vs sem origem (cinza)
  const pedidosSerie = useMemo(() => {
    const base: any[] = []; const idx: Record<string, number> = {};
    for (const d of janelaDias) { idx[d.key] = base.length; base.push({ label: d.label, google: 0, meta: 0, teste: 0, outros: 0, direto: 0 }); }
    for (const p of pedidos) {
      const k = diaKey(p.ocorrido_em);
      if (idx[k] == null) continue;
      base[idx[k]][p.primeiro_toque ? canalDe(p.primeiro_toque.source) : "direto"] += 1;
    }
    return base;
  }, [pedidos, janelaDias]);
  const canaisPedidos = (Object.keys(CANAIS) as CanalKey[]).filter((k) => pedidosSerie.some((d) => d[k] > 0));

  // Pistas: de onde vêm os "diretos" (toques orgânicos/referral — tag v3)
  const pistas = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of toques) { if (isAd(t)) continue; const k = t.source || "(direto, sem referrer)"; m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [toques]);

  // Campanhas POR CANAL: o que a PLATAFORMA reporta × o que a ATRIBUIÇÃO já enxerga
  const campanhasPorCanal = useMemo(() => {
    const grupos: Record<"meta" | "google", Record<string, CampRow>> = { meta: {}, google: {} };
    for (const g of gastos) {
      const canal: "meta" | "google" = g.canal === "google" ? "google" : "meta";
      const key = g.campaign_id || g.campaign_name || "?";
      const r = (grupos[canal][key] ??= { key, nome: g.campaign_name || key, gasto: 0, pCompras: 0, pReceita: 0, aCompras: 0, aReceita: 0 });
      r.gasto += Number(g.gasto) || 0;
      r.pCompras += Number(g.plataforma_compras) || 0;
      r.pReceita += Number(g.plataforma_receita) || 0;
      if (g.campaign_name) r.nome = g.campaign_name;
    }
    const idx: Record<"meta" | "google", Record<string, string>> = { meta: {}, google: {} };
    (["meta", "google"] as const).forEach((c) => {
      for (const k of Object.keys(grupos[c])) idx[c][grupos[c][k].nome.trim().toLowerCase()] = k;
    });
    for (const p of pedidos) {
      const s = modelo === "primeiro" ? p.primeiro_toque : p.ultimo_toque;
      if (!s) continue;
      const canal = canalDe(s.source);
      if (canal !== "meta" && canal !== "google") continue;
      const g = grupos[canal];
      const key = (s.campaign_id && g[s.campaign_id]) ? s.campaign_id : idx[canal][(s.campaign || "").trim().toLowerCase()];
      if (!key) continue;
      g[key].aCompras += 1; g[key].aReceita += Number(p.valor) || 0;
    }
    const lista = (c: "meta" | "google") => Object.values(grupos[c]).filter((r) => r.gasto > 0).sort((a, b) => b.gasto - a.gasto).slice(0, 12);
    return { meta: lista("meta"), google: lista("google") };
  }, [gastos, pedidos, modelo]);

  return (
    <>
      {/* KPIs primários */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icone={<MousePointerClick className="w-4 h-4" />} rotulo="Toques" valor={String(totalToques)} />
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
            <h3 className="text-sm font-semibold text-neutral-700">Toques por dia · {janelaDias.length} dia(s)</h3>
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

      {/* Pedidos por dia (leitura principal) + pistas dos diretos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-neutral-700">Pedidos por dia · com origem (1º toque) vs direto</h3>
            <Legenda canais={canaisPedidos} />
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pedidosSerie} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#f1f2f4" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={26} />
                <RTooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
                {canaisPedidos.map((k) => (
                  <Bar key={k} dataKey={k} name={CANAIS[k].label} stackId="p" fill={CANAIS[k].cor} stroke="#ffffff" strokeWidth={1} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Cinza = sem origem (direto/recorrente ou anterior ao rastreio). A fatia colorida é a que cresce conforme a cobertura melhora.</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-neutral-700">Pistas dos "diretos"</h3>
          <p className="text-[11px] text-neutral-400 mb-3">De onde vêm as visitas SEM anúncio (orgânico, indicação, IA, bio...).</p>
          {pistas.length === 0 ? (
            <p className="text-xs text-neutral-400 py-3">Ativa com a Tag 1 v3 (§3 da receita) republicada — aí todo 1º acesso da sessão registra o referrer.</p>
          ) : (
            <div className="space-y-1.5">
              {pistas.map(([s, n]) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-neutral-400" />
                  <span className="font-mono text-neutral-700 flex-1 truncate">{s}</span>
                  <span className="font-semibold text-neutral-800">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Campanhas: plataforma × atribuição — um bloco por canal */}
      <TabelaCampanhas titulo="Meta Ads" cor={CANAIS.meta.cor} rows={campanhasPorCanal.meta} modelo={modelo}
        rodape="Gasto por anúncio (agregado por campanha). A plataforma atribui pela janela dela (7d clique, com modelagem)." />
      <TabelaCampanhas titulo="Google Ads" cor={CANAIS.google.cor} rows={campanhasPorCanal.google} modelo={modelo}
        rodape="Gasto por campanha; dados do Google atrasam ~1 dia. A atribuição engata quando o sufixo de URL estiver ativo." />
      <p className="text-[11px] text-neutral-400 mt-2">
        Cobertura = compras da atribuição ÷ compras da plataforma — nunca será 100% (janelas diferentes) e cresce com o tempo.
      </p>
    </>
  );
}

// ═════════════════════════ SUB-ABA: ORIGENS (UTMs) ══════════════════════════
function Origens({ toques, pedidos, gastos, modelo, clientePorId, onAbrirVid, onJornada }: {
  toques: Toque[]; pedidos: Pedido[]; gastos: Gasto[]; modelo: Modelo;
  clientePorId: Record<string, Cliente>;
  onAbrirVid: (vid: string) => void; onJornada: (c: Cliente) => void;
}) {
  const [visao, setVisao] = useState<"toques" | "pedidos">("toques");
  const [filtroCanal, setFiltroCanal] = useState<CanalKey | "all">("all");

  // Dicionário ID→nome (do sync de gasto, SEM filtro de período) — traduz o
  // utm_campaign={campaignid} do Google pro nome oficial; o valor cru fica no hover
  const nomeCampanha = useMemo(() => {
    const d: Record<string, string> = {};
    for (const g of gastos) if (g.campaign_id && g.campaign_name) d[g.campaign_id] = g.campaign_name;
    return d;
  }, [gastos]);
  const campanhaDe = useCallback((campaign?: string | null, campaign_id?: string | null) => {
    const cru = campaign || campaign_id || "";
    const nome = (campaign_id && nomeCampanha[campaign_id]) || (campaign && nomeCampanha[campaign]) || null;
    return { texto: nome || cru || "—", cru, traduzido: !!nome && nome !== cru };
  }, [nomeCampanha]);
  // período vem do filtro GLOBAL da aba (props já chegam filtradas)

  const toquesF = useMemo(() => toques.filter((t) =>
    filtroCanal === "all" || canalDe(t.source, t.gclid, t.fbclid) === filtroCanal), [toques, filtroCanal]);

  const snapDoPedido = useCallback((p: Pedido) => (modelo === "primeiro" ? p.primeiro_toque : p.ultimo_toque), [modelo]);
  const pedidosF = useMemo(() => pedidos.filter((p) => {
    const s = snapDoPedido(p);
    const canal = s ? canalDe(s.source) : "direto";
    return filtroCanal === "all" || canal === filtroCanal;
  }), [pedidos, filtroCanal, snapDoPedido]);

  // utm_source crua — auditoria (muda conforme a visão)
  const porSourceCru = useMemo(() => {
    const m: Record<string, number> = {};
    if (visao === "toques") for (const t of toquesF) { const k = t.source || "(vazio — só clid)"; m[k] = (m[k] ?? 0) + 1; }
    else for (const p of pedidosF) { const s = snapDoPedido(p); const k = s ? (s.source || "(sem source)") : "(sem origem)"; m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [visao, toquesF, pedidosF, snapDoPedido]);

  const TIPO_CHIP: Record<string, { l: string; c: string }> = {
    ad_click: { l: "anúncio", c: "#6366f1" },
    referral: { l: "orgânico", c: "#0d9488" },
    direct:   { l: "direto",  c: "#94a3b8" },
  };

  return (
    <div className="space-y-4">
      {/* Filtros: visão (toques/pedidos) + canal + período */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
          {([["toques", "Toques"], ["pedidos", "Pedidos"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setVisao(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${visao === v ? "bg-indigo-50 text-indigo-700" : "text-neutral-500"}`}>{l}</button>
          ))}
        </div>
        <span className="w-px h-5 bg-neutral-200" />
        <button onClick={() => setFiltroCanal("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border ${filtroCanal === "all" ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-200"}`}>Todos</button>
        {(Object.keys(CANAIS) as CanalKey[]).map((k) => (
          <button key={k} onClick={() => setFiltroCanal(filtroCanal === k ? "all" : k)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border ${filtroCanal === k ? "text-white border-transparent" : "bg-white text-neutral-600 border-neutral-200"}`}
            style={filtroCanal === k ? { background: CANAIS[k].cor } : undefined}>
            <span className="w-2 h-2 rounded-full" style={{ background: filtroCanal === k ? "#fff" : CANAIS[k].cor }} />{CANAIS[k].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-700">{visao === "toques" ? "Feed de toques" : `Pedidos por canal (${modelo === "primeiro" ? "1º toque" : "último toque"})`}</span>
            <span className="text-xs text-neutral-400">{visao === "toques" ? `${toquesF.length} no período` : `${pedidosF.length} no período`}</span>
          </div>
          <div className="overflow-x-auto">
            {visao === "toques" ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                    <th className="px-4 py-2">Quando</th>
                    <th className="px-2 py-2">Canal</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Campanha</th>
                    <th className="px-2 py-2">Criativo / termo</th>
                    <th className="px-2 py-2">ad_id</th>
                    <th className="px-2 py-2">Disp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {toquesF.slice(0, 80).map((t) => {
                    const k = canalDe(t.source, t.gclid, t.fbclid);
                    const tp = TIPO_CHIP[t.tipo ?? "ad_click"] ?? TIPO_CHIP.ad_click;
                    return (
                      <tr key={t.id} className="hover:bg-indigo-50/40 cursor-pointer" title="Clique pra ver a jornada deste visitante"
                        onClick={() => onAbrirVid(t.vid)}>
                        <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">{dtHora(t.ocorrido_em)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: CANAIS[k].cor }} />
                            <span className="text-neutral-700 font-medium">{CANAIS[k].label}</span>
                            <span className="text-neutral-400">({t.source || (t.gclid ? "gclid" : t.fbclid ? "fbclid" : "—")})</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: tp.c, background: `${tp.c}18`, border: `1px solid ${tp.c}44` }}>{tp.l}</span>
                        </td>
                        <td className="px-2 py-2 text-neutral-600 max-w-[160px] truncate">
                          {(() => { const c = campanhaDe(t.campaign, t.campaign_id); return (
                            <span title={c.cru}>{c.texto}{c.traduzido && <span className="text-[9px] text-indigo-400 ml-1" title={`traduzido do id ${c.cru}`}>id→</span>}</span>
                          ); })()}
                        </td>
                        <td className="px-2 py-2 text-neutral-800 font-medium max-w-[200px] truncate">{t.term || t.content || "—"}</td>
                        <td className="px-2 py-2 text-neutral-400 font-mono">{t.ad_id || "—"}</td>
                        <td className="px-2 py-2 text-neutral-500">{t.device || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                    <th className="px-4 py-2">Quando</th>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Canal</th>
                    <th className="px-2 py-2">Campanha</th>
                    <th className="px-2 py-2">Criativo</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {pedidosF.slice(0, 80).map((p) => {
                    const s = snapDoPedido(p);
                    const k = s ? canalDe(s.source) : "direto";
                    const c = p.cliente_id ? clientePorId[p.cliente_id] : null;
                    return (
                      <tr key={p.pedido_id} className="hover:bg-indigo-50/40 cursor-pointer" title="Clique pra ver a jornada"
                        onClick={() => { if (c) onJornada(c); else if (p.vid_no_pedido) onAbrirVid(p.vid_no_pedido); }}>
                        <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">{dt(p.ocorrido_em)}</td>
                        <td className="px-2 py-2 text-neutral-800 font-medium max-w-[170px] truncate">{c?.nome || c?.email || <span className="text-neutral-300 italic">não identificado</span>}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: CANAIS[k].cor }} />
                            <span className="text-neutral-700">{s ? (s.source || CANAIS[k].label) : "direto"}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-neutral-600 max-w-[160px] truncate">
                          {(() => { const c = campanhaDe(s?.campaign, s?.campaign_id); return <span title={c.cru}>{c.texto}</span>; })()}
                        </td>
                        <td className="px-2 py-2 text-neutral-800 max-w-[180px] truncate">{s?.term || s?.ad_id || "—"}</td>
                        <td className="px-2 py-2 text-right font-semibold text-neutral-800 whitespace-nowrap">{p.valor != null ? brl(Number(p.valor)) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {visao === "toques" && toquesF.length > 80 && <p className="px-4 py-2 text-[11px] text-neutral-400">Mostrando 80 de {toquesF.length}.</p>}
            {visao === "pedidos" && pedidosF.length > 80 && <p className="px-4 py-2 text-[11px] text-neutral-400">Mostrando 80 de {pedidosF.length}.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-neutral-700">utm_source crua</h3>
          <p className="text-[11px] text-neutral-400 mb-3">{visao === "toques" ? "Como cada fonte está chegando — flagra UTM fora do padrão." : "Fonte de origem dos pedidos filtrados."}</p>
          <div className="space-y-1.5">
            {porSourceCru.map(([s, n]) => {
              const k = canalDe(s.startsWith("(") ? null : s);
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

  const gastoDe = useCallback((chave: string, adId: string | null): number | null => {
    const k = chave.trim().toLowerCase();
    if (nivel === "criativo") {
      if (gastoIdx.porAdId[chave] != null) return gastoIdx.porAdId[chave];      // chave já é ad_id
      if (adId && gastoIdx.porAdId[adId] != null) return gastoIdx.porAdId[adId];
      if (gastoIdx.porAdNome[k] != null) return gastoIdx.porAdNome[k];          // fallback por nome
    } else {
      if (gastoIdx.porCampId[chave] != null) return gastoIdx.porCampId[chave];
      if (gastoIdx.porCampNome[k] != null) return gastoIdx.porCampNome[k];
    }
    return null;
  }, [gastoIdx, nivel]);

  // Dicionário ID ↔ nome (vem do sync de gasto) — traduz IDs pra nomes frescos
  // e unifica toques antigos (por nome) com novos (só ID) na mesma linha.
  const dicio = useMemo(() => {
    const nomePorAdId: Record<string, string> = {};
    const adIdPorNome: Record<string, string> = {};
    const nomePorCampId: Record<string, string> = {};
    const campIdPorNome: Record<string, string> = {};
    for (const g of gastos) {
      if (g.ad_id && g.ad_name) { nomePorAdId[g.ad_id] = g.ad_name; adIdPorNome[g.ad_name.trim().toLowerCase()] = g.ad_id; }
      if (g.campaign_id && g.campaign_name) { nomePorCampId[g.campaign_id] = g.campaign_name; campIdPorNome[g.campaign_name.trim().toLowerCase()] = g.campaign_id; }
    }
    return { nomePorAdId, adIdPorNome, nomePorCampId, campIdPorNome };
  }, [gastos]);

  const norm = (s?: string | null) => (s || "").trim().toLowerCase();
  // Chave canônica: ID quando existe (direto ou traduzindo o nome via dicionário)
  const chaveDe = useCallback((s: Snapshot) => {
    if (!s) return SEM_ATRIB;
    if (nivel === "criativo") return s.ad_id || dicio.adIdPorNome[norm(s.term)] || s.term || s.campaign || SEM_ATRIB;
    return s.campaign_id || dicio.campIdPorNome[norm(s.campaign)] || s.campaign || SEM_ATRIB;
  }, [nivel, dicio]);
  const chaveToque = useCallback((t: Toque) =>
    nivel === "criativo"
      ? (t.ad_id || dicio.adIdPorNome[norm(t.term)] || t.term || t.campaign || SEM_ATRIB)
      : (t.campaign_id || dicio.campIdPorNome[norm(t.campaign)] || t.campaign || SEM_ATRIB), [nivel, dicio]);
  // Nome de exibição: sempre o nome FRESCO do dicionário quando a chave é um ID
  const nomeDe = useCallback((key: string) =>
    nivel === "criativo" ? (dicio.nomePorAdId[key] || key) : (dicio.nomePorCampId[key] || key), [nivel, dicio]);

  const ranking = useMemo(() => {
    const m: Record<string, { pedidos: Pedido[]; receita: number; clientes: Set<number | null>; toques: number; canal: CanalKey; adIds: Set<string>; trouxe: number; fechou: number }> = {};
    const linha = (key: string, canal: CanalKey) =>
      (m[key] ??= { pedidos: [], receita: 0, clientes: new Set(), toques: 0, canal, adIds: new Set(), trouxe: 0, fechou: 0 });
    for (const t of toques) {
      if (!isAd(t)) continue;                      // ranking pago: só cliques de anúncio
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
  const [origemFiltro, setOrigemFiltro] = useState<"todos" | "com" | "sem">("todos");
  const linhasRank = useMemo(() =>
    origemFiltro === "todos" ? ranking
      : origemFiltro === "com" ? ranking.filter((r) => r.nome !== SEM_ATRIB)
      : ranking.filter((r) => r.nome === SEM_ATRIB), [ranking, origemFiltro]);
  const maxReceita = Math.max(1, ...linhasRank.map((r) => r.receita));
  const linhaAberta = linhasRank.find((r) => r.nome === aberto) ?? null;

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
        <div className="flex-1" />
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {([["todos", "Todos"], ["com", "Com origem"], ["sem", "Sem origem"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setOrigemFiltro(v); setAberto(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${origemFiltro === v ? "bg-white text-indigo-700 shadow-sm border border-neutral-200" : "text-neutral-500"}`}>{l}</button>
          ))}
        </div>
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
        {linhasRank.map((r) => (
          <div key={r.nome}>
            <button onClick={() => setAberto(aberto === r.nome ? null : r.nome)}
              className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors ${aberto === r.nome ? "bg-indigo-50/50" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CANAIS[r.canal].cor }} />
                    <span className={`text-sm font-medium truncate ${r.nome === SEM_ATRIB ? "text-neutral-400 italic" : "text-neutral-800"}`}>{nomeDe(r.nome)}</span>
                    {(() => { const id = nivel === "criativo" && dicio.nomePorAdId[r.nome] ? r.nome : r.adId; return id ? <span className="text-[10px] font-mono text-neutral-400 shrink-0">#{id}</span> : null; })()}
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
  const [origemFiltro, setOrigemFiltro] = useState<"todos" | "com" | "sem">("todos");
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
      .filter((l) => origemFiltro === "todos" ? true : origemFiltro === "com" ? !!l.primeiro : !l.primeiro)
      .sort((a, b) => b.receita - a.receita);
  }, [pedidos, clientes, origemFiltro]);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-neutral-700">Clientes identificados</span>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {([["todos", "Todos"], ["com", "Com origem"], ["sem", "Sem origem"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setOrigemFiltro(v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${origemFiltro === v ? "bg-white text-indigo-700 shadow-sm border border-neutral-200" : "text-neutral-500"}`}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-neutral-400 ml-auto">{linhas.length}</span>
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

// ═════════════════ SUB-ABA: MONITOR DE REVENDAS ═════════════════════════════
// Dados 100% separados da atribuição (tabela atr_revenda_eventos): confirma se
// campanhas NOSSAS estão levando tráfego/compra pras lojas white-label.
function MonitorRevendas({ intervalo }: { intervalo: Intervalo }) {
  const [eventos, setEventos] = useState<RevendaEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("atr_revenda_eventos")
        .select("id, ocorrido_em, host, evento, vid_local, source, campaign, term, campaign_id, ad_id, pedido_id, valor, campanha_nossa")
        .order("ocorrido_em", { ascending: false }).limit(2000);
      setEventos((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const evs = useMemo(() => eventos.filter((e) => {
    const t = new Date(e.ocorrido_em).getTime();
    return t >= intervalo.ini && t <= intervalo.fim;
  }), [eventos, intervalo]);

  const toquesNossos = evs.filter((e) => e.evento === "touch" && e.campanha_nossa === true);
  const toquesAlheios = evs.filter((e) => e.evento === "touch" && e.campanha_nossa === false);
  const compras = evs.filter((e) => e.evento === "purchase");
  const comprasNossas = compras.filter((e) => e.campanha_nossa === true);
  const vazamentoReais = comprasNossas.reduce((s, e) => s + (Number(e.valor) || 0), 0);

  const porHost = useMemo(() => {
    const m: Record<string, { tNossa: number; tAlheia: number; cNossa: number; rNossa: number; cTotal: number }> = {};
    for (const e of evs) {
      const r = (m[e.host] ??= { tNossa: 0, tAlheia: 0, cNossa: 0, rNossa: 0, cTotal: 0 });
      if (e.evento === "touch") { if (e.campanha_nossa) r.tNossa += 1; else r.tAlheia += 1; }
      else { r.cTotal += 1; if (e.campanha_nossa) { r.cNossa += 1; r.rNossa += Number(e.valor) || 0; } }
    }
    return Object.entries(m).sort((a, b) => (b[1].cNossa - a[1].cNossa) || (b[1].tNossa - a[1].tNossa));
  }, [evs]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-800">
        <b>O que é isto:</b> eventos capturados nas lojas de REVENDEDORES (oferta., atualgraf., ...) — separados da atribuição principal.
        "Campanha nossa" = o toque/compra casou com os IDs/nomes reais das campanhas da AtualCard. <b>Compra com campanha nossa = vazamento</b>: sua mídia pagou uma venda que aconteceu na loja do revendedor.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icone={<MousePointerClick className="w-4 h-4" />} rotulo="Toques c/ campanha NOSSA" valor={String(toquesNossos.length)} />
        <Kpi icone={<MousePointerClick className="w-4 h-4" />} rotulo="Toques de campanha alheia" valor={String(toquesAlheios.length)} />
        <Kpi icone={<ShoppingCart className="w-4 h-4" />} rotulo="Compras em revenda (total)" valor={String(compras.length)} />
        <Kpi icone={<Receipt className="w-4 h-4" />} rotulo="VAZAMENTO (compras nossas)" valor={`${comprasNossas.length} · ${brl(vazamentoReais)}`} destaque={comprasNossas.length > 0 ? "sua mídia pagando venda de revenda" : undefined} />
      </div>

      {!loading && evs.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <Radio className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-neutral-600">Nenhum evento de revenda no período (ainda)</p>
          <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
            O monitor grava quando alguém chega numa loja de revendedor <b>vindo de campanha</b> (utm/fbclid/gclid) ou compra lá.
            Se continuar zerado por dias, é ótimo sinal: suas campanhas não estão vazando.
          </p>
        </div>
      )}

      {evs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Por loja de revenda</h3>
            <div className="space-y-2">
              {porHost.map(([host, r]) => (
                <div key={host} className="rounded-xl border border-neutral-200 p-2.5 text-xs">
                  <div className="font-mono font-medium text-neutral-800 truncate">{host}</div>
                  <div className="text-neutral-500 mt-1">
                    toques: <b className="text-indigo-600">{r.tNossa} nossos</b> · {r.tAlheia} alheios
                  </div>
                  <div className="text-neutral-500">
                    compras: {r.cTotal} {r.cNossa > 0 && <b className="text-red-600">· {r.cNossa} de campanha NOSSA ({brl(r.rNossa)})</b>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700">Eventos recentes</span>
              <span className="text-xs text-neutral-400">{evs.length} no período</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                    <th className="px-4 py-2">Quando</th>
                    <th className="px-2 py-2">Loja</th>
                    <th className="px-2 py-2">Evento</th>
                    <th className="px-2 py-2">Campanha</th>
                    <th className="px-2 py-2">Nossa?</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {evs.slice(0, 60).map((e) => (
                    <tr key={e.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">{dtHora(e.ocorrido_em)}</td>
                      <td className="px-2 py-2 font-mono text-neutral-600 max-w-[150px] truncate">{e.host.replace(".atualcard.com.br", ".")}</td>
                      <td className="px-2 py-2">
                        {e.evento === "purchase"
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">compra{e.pedido_id ? ` #${e.pedido_id}` : ""}</span>
                          : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-50 border border-indigo-100">toque</span>}
                      </td>
                      <td className="px-2 py-2 text-neutral-700 max-w-[200px] truncate">{e.term || e.campaign || e.campaign_id || e.source || "—"}</td>
                      <td className="px-2 py-2">
                        {e.campanha_nossa === true ? <span className="font-semibold text-red-600">SIM</span>
                          : e.campanha_nossa === false ? <span className="text-neutral-400">não</span>
                          : <span className="text-neutral-300">?</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-neutral-800 whitespace-nowrap">{e.valor != null ? brl(Number(e.valor)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-neutral-400">Carregando monitor...</p>}
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

function MiniKpi({ rotulo, valor }: { key?: React.Key; rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">{rotulo}</div>
      <div className="text-sm font-semibold text-neutral-800 mt-0.5">{valor}</div>
    </div>
  );
}

function TabelaCampanhas({ titulo, cor, rows, modelo, rodape }: { key?: React.Key; titulo: string; cor: string; rows: CampRow[]; modelo: Modelo; rodape?: string }) {
  const tot = rows.reduce((s, r) => ({ gasto: s.gasto + r.gasto, pC: s.pC + r.pCompras, pR: s.pR + r.pReceita, aC: s.aC + r.aCompras, aR: s.aR + r.aReceita }), { gasto: 0, pC: 0, pR: 0, aC: 0, aR: 0 });
  const cobTot = tot.pC > 0 ? (tot.aC / tot.pC) * 100 : null;
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden mt-4">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
        <span className="text-sm font-semibold text-neutral-700">{titulo} — plataforma × atribuição</span>
        <span className="text-xs text-neutral-400">· modelo: {modelo === "primeiro" ? "1º toque" : "último toque"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-xs text-neutral-400">Sem gasto sincronizado deste canal ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                <th className="px-4 py-2">Campanha</th>
                <th className="px-2 py-2 text-right">Gasto</th>
                <th className="px-2 py-2 text-right" title="Compras que o gerenciador atribui (janela da plataforma)">Compras (plat.)</th>
                <th className="px-2 py-2 text-right">Receita (plat.)</th>
                <th className="px-2 py-2 text-right" title="Pedidos que NOSSA atribuição ligou a esta campanha">Compras (atrib.)</th>
                <th className="px-2 py-2 text-right">Receita (atrib.)</th>
                <th className="px-2 py-2 text-right" title="Compras da atribuição ÷ compras da plataforma">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((c) => {
                const cob = c.pCompras > 0 ? (c.aCompras / c.pCompras) * 100 : null;
                return (
                  <tr key={c.key} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5 text-neutral-800 font-medium max-w-[260px] truncate" title={c.nome}>{c.nome}</td>
                    <td className="px-2 py-2.5 text-right text-neutral-600 whitespace-nowrap">{brl(c.gasto)}</td>
                    <td className="px-2 py-2.5 text-right text-neutral-600">{c.pCompras}</td>
                    <td className="px-2 py-2.5 text-right text-neutral-600 whitespace-nowrap">{brl(c.pReceita)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-indigo-700">{c.aCompras}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-indigo-700 whitespace-nowrap">{brl(c.aReceita)}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold ${cob == null ? "text-neutral-300" : cob >= 50 ? "text-emerald-600" : "text-amber-600"}`}>{cob == null ? "—" : `${cob.toFixed(0)}%`}</td>
                  </tr>
                );
              })}
              <tr className="bg-neutral-50 font-semibold text-neutral-800 border-t border-neutral-200">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">{brl(tot.gasto)}</td>
                <td className="px-2 py-2.5 text-right">{tot.pC}</td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">{brl(tot.pR)}</td>
                <td className="px-2 py-2.5 text-right text-indigo-700">{tot.aC}</td>
                <td className="px-2 py-2.5 text-right text-indigo-700 whitespace-nowrap">{brl(tot.aR)}</td>
                <td className={`px-2 py-2.5 text-right ${cobTot == null ? "text-neutral-300" : cobTot >= 50 ? "text-emerald-600" : "text-amber-600"}`}>{cobTot == null ? "—" : `${cobTot.toFixed(0)}%`}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {rodape && <p className="px-4 py-2.5 text-[11px] text-neutral-400 border-t border-neutral-100">{rodape}</p>}
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

// ── Drawer: visitante por vid (identificado → vira jornada do cliente) ───────
function VidDrawer({ vid, onClose }: { vid: string; onClose: () => void }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pronto, setPronto] = useState(false);
  const [tq, setTq] = useState<Toque[]>([]);
  const [pd, setPd] = useState<Pedido[]>([]);

  useEffect(() => {
    (async () => {
      setPronto(false); setCliente(null);
      const { data: ident } = await supabase.from("atr_identidades").select("cliente_id").eq("vid", vid).maybeSingle();
      if ((ident as any)?.cliente_id) {
        const { data: c } = await supabase.from("atr_clientes").select("cliente_id, email, cnpj, cpf, nome, telefone, plataforma_id").eq("cliente_id", (ident as any).cliente_id).maybeSingle();
        if (c) { setCliente(c as any); setPronto(true); return; }
      }
      const [t, p] = await Promise.all([
        supabase.from("atr_toques").select("id, vid, ocorrido_em, tipo, source, medium, campaign, content, term, campaign_id, adset_id, ad_id, fbclid, gclid, landing_url, device").eq("vid", vid).order("ocorrido_em"),
        supabase.from("atr_pedidos").select("pedido_id, cliente_id, valor, produto, ocorrido_em, vid_no_pedido, primeiro_toque, ultimo_toque").eq("vid_no_pedido", vid).order("ocorrido_em"),
      ]);
      setTq((t.data as any) ?? []); setPd((p.data as any) ?? []); setPronto(true);
    })();
  }, [vid]);

  // identificado → reusa a jornada completa do cliente (todos os vids dele)
  if (cliente) return <JornadaDrawer cliente={cliente} onClose={onClose} />;

  const eventos = [
    ...tq.map((t) => {
      const k = canalDe(t.source, t.gclid, t.fbclid);
      return {
        quando: t.ocorrido_em, cor: CANAIS[k].cor,
        titulo: t.term || t.campaign || CANAIS[k].label,
        detalhe: [CANAIS[k].label, t.tipo && t.tipo !== "ad_click" ? t.tipo : null, t.medium, t.campaign, t.ad_id ? `ad #${t.ad_id}` : null].filter(Boolean).join(" · "),
        pedido: false,
      };
    }),
    ...pd.map((p) => ({
      quando: p.ocorrido_em, cor: "#22c55e",
      titulo: `Compra — pedido ${p.pedido_id}`,
      detalhe: [p.produto, p.valor != null ? brl(Number(p.valor)) : null].filter(Boolean).join(" · "),
      pedido: true,
    })),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-5 border-b border-neutral-200 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0"><Route className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-neutral-800">Visitante ainda não identificado</h3>
            <p className="text-xs text-neutral-500 font-mono truncate">{vid}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {!pronto && <p className="text-xs text-neutral-400">Carregando...</p>}
          {pronto && eventos.length === 0 && <p className="text-sm text-neutral-400">Sem eventos pra este visitante.</p>}
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-neutral-200" />
            {eventos.map((ev, i) => (
              <div key={i} className="relative pb-4">
                <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: ev.cor }} />
                <div className="text-[11px] text-neutral-400">{dtHora(ev.quando)}</div>
                <div className={`text-sm font-medium ${ev.pedido ? "text-emerald-700" : "text-neutral-800"}`}>{ev.titulo}</div>
                {ev.detalhe && <div className="text-xs text-neutral-500">{ev.detalhe}</div>}
              </div>
            ))}
          </div>
          {pronto && (
            <div className="mt-2 rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-xs text-neutral-500">
              Este visitante ganha nome assim que <b>logar ou comprar</b> — aí a jornada inteira passa pro cadastro dele.
            </div>
          )}
        </div>
      </div>
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

  const receitaCliente = pedidos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const origemPaga = toques.find((t) => isAd(t)) ?? toques[0] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-5 border-b border-neutral-200 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Route className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-neutral-800 truncate">{cliente.nome || cliente.email}</h3>
            <p className="text-xs text-neutral-500 truncate">{cliente.email}{cliente.telefone ? ` · ${cliente.telefone}` : ""}</p>
            <p className="text-[11px] text-neutral-400 truncate">
              {cliente.cnpj ? `CNPJ ${cliente.cnpj}` : cliente.cpf ? `CPF ${cliente.cpf}` : "sem documento"}
              {cliente.plataforma_id ? ` · id ${cliente.plataforma_id}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-xs text-neutral-400">Carregando jornada...</p>}
          {!loading && eventos.length === 0 && <p className="text-sm text-neutral-400">Sem eventos registrados pra este cliente ainda.</p>}

          {/* Perfil do cliente */}
          {!loading && (
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MiniKpi rotulo="LTV (receita)" valor={brl(receitaCliente)} />
                <MiniKpi rotulo="Pedidos" valor={String(pedidos.length)} />
                <MiniKpi rotulo="Ticket médio" valor={pedidos.length ? brl(receitaCliente / pedidos.length) : "—"} />
                <MiniKpi rotulo="Toques" valor={String(toques.length)} />
              </div>
              {origemPaga && (
                <div className="rounded-xl border border-neutral-200 p-3 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold mb-1">Origem (1º toque)</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CANAIS[canalDe(origemPaga.source, origemPaga.gclid, origemPaga.fbclid)].cor }} />
                    <span className="font-medium text-neutral-800 truncate">{origemPaga.term || origemPaga.campaign || origemPaga.source || "—"}</span>
                  </div>
                  <div className="text-neutral-400 mt-0.5 truncate">{origemPaga.campaign ? `${origemPaga.campaign} · ` : ""}{dtHora(origemPaga.ocorrido_em)}</div>
                </div>
              )}
              {pedidos.length > 0 && (
                <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                  {pedidos.map((p) => (
                    <div key={p.pedido_id} className="px-3 py-2 flex items-center gap-2 text-xs">
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0 truncate">
                        <span className="font-medium text-neutral-800">#{p.pedido_id}</span>
                        <span className="text-neutral-400 ml-1.5">{p.produto || ""}</span>
                      </div>
                      <span className="text-neutral-400 whitespace-nowrap">{dt(p.ocorrido_em)}</span>
                      <span className="font-semibold text-neutral-800 whitespace-nowrap">{p.valor != null ? brl(Number(p.valor)) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
              {eventos.length > 0 && <div className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold pt-1">Jornada</div>}
            </div>
          )}
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
