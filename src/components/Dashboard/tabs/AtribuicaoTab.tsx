import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import {
  Target, Users, Receipt, Clock, X, ChevronRight,
  MousePointerClick, ShoppingCart, UserCheck, Route,
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────
type Snapshot = {
  source?: string | null; medium?: string | null; campaign?: string | null;
  content?: string | null; term?: string | null; ocorrido_em?: string | null;
} | null;

type Pedido = {
  pedido_id: string;
  cliente_id: number | null;
  valor: number | null;
  produto: string | null;
  ocorrido_em: string;
  primeiro_toque: Snapshot;
  ultimo_toque: Snapshot;
};
type Cliente = { cliente_id: number; email: string; cnpj: string | null; cpf: string | null; nome: string | null };
type Toque = {
  id: number; vid: string; ocorrido_em: string; tipo: string | null;
  source: string | null; campaign: string | null; content: string | null; term: string | null;
};

type Modelo = "primeiro" | "ultimo";
const SEM_ATRIB = "(sem toque registrado)";

// ── Utils ────────────────────────────────────────────────────────────────────
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const dtHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dias = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);

// ── Componente principal ─────────────────────────────────────────────────────
export function AtribuicaoTab() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [totalToques, setTotalToques] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modelo, setModelo] = useState<Modelo>("primeiro");
  const [criativoAberto, setCriativoAberto] = useState<string | null>(null);
  const [jornadaDe, setJornadaDe] = useState<Cliente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: peds }, { data: clis }, { count }] = await Promise.all([
      supabase.from("atr_pedidos").select("pedido_id, cliente_id, valor, produto, ocorrido_em, primeiro_toque, ultimo_toque").order("ocorrido_em", { ascending: false }).limit(2000),
      supabase.from("atr_clientes").select("cliente_id, email, cnpj, cpf, nome").limit(2000),
      supabase.from("atr_toques").select("id", { count: "exact", head: true }),
    ]);
    setPedidos((peds as any) ?? []);
    setClientes((clis as any) ?? []);
    setTotalToques(count ?? 0);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.cliente_id, c])), [clientes]);
  const snapDe = useCallback((p: Pedido): Snapshot => (modelo === "primeiro" ? p.primeiro_toque : p.ultimo_toque), [modelo]);

  // KPIs
  const receita = useMemo(() => pedidos.reduce((s, p) => s + (Number(p.valor) || 0), 0), [pedidos]);
  const clientesUnicos = useMemo(() => new Set(pedidos.map((p) => p.cliente_id).filter(Boolean)).size, [pedidos]);
  const tempoMedio = useMemo(() => {
    const ds = pedidos.filter((p) => p.primeiro_toque?.ocorrido_em).map((p) => dias(p.primeiro_toque!.ocorrido_em!, p.ocorrido_em));
    return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
  }, [pedidos]);

  // Ranking por criativo (term do modelo escolhido)
  const ranking = useMemo(() => {
    const m: Record<string, { pedidos: Pedido[]; receita: number; clientes: Set<number | null> }> = {};
    for (const p of pedidos) {
      const key = snapDe(p)?.term || snapDe(p)?.campaign || SEM_ATRIB;
      const r = (m[key] ??= { pedidos: [], receita: 0, clientes: new Set() });
      r.pedidos.push(p); r.receita += Number(p.valor) || 0; r.clientes.add(p.cliente_id);
    }
    return Object.entries(m)
      .map(([term, r]) => ({ term, nPedidos: r.pedidos.length, receita: r.receita, nClientes: r.clientes.size, pedidos: r.pedidos }))
      .sort((a, b) => b.receita - a.receita || b.nPedidos - a.nPedidos);
  }, [pedidos, snapDe]);
  const maxReceita = Math.max(1, ...ranking.map((r) => r.receita));
  const aberto = ranking.find((r) => r.term === criativoAberto) ?? null;

  const vazio = !loading && pedidos.length === 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">Atribuição de Criativos</h2>
            <p className="text-xs text-neutral-500">Qual criativo trouxe cada cliente — 1º toque, último toque e jornada.</p>
          </div>
        </div>
        {/* Modelo de atribuição */}
        <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {([["primeiro", "Primeiro toque (quem trouxe)"], ["ultimo", "Último toque (quem fechou)"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setModelo(v); setCriativoAberto(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${modelo === v ? "bg-white text-indigo-700 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-800"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Estado vazio — aguardando GTM */}
      {vazio && (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <MousePointerClick className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-700">Aguardando os primeiros dados</h3>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            A fundação está no ar. Assim que as tags do GTM forem publicadas no e-commerce,
            os toques de campanha e os pedidos começam a aparecer aqui automaticamente.
          </p>
          <p className="text-xs text-neutral-400 mt-3">Receita de implantação: <code>atribuicao/GTM-RECEITA.md</code></p>
        </div>
      )}

      {!vazio && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi icone={<ShoppingCart className="w-4 h-4" />} rotulo="Pedidos atribuídos" valor={String(pedidos.length)} />
            <Kpi icone={<Receipt className="w-4 h-4" />} rotulo="Receita atribuída" valor={brl(receita)} />
            <Kpi icone={<Users className="w-4 h-4" />} rotulo="Clientes únicos" valor={String(clientesUnicos)} />
            <Kpi icone={<Clock className="w-4 h-4" />} rotulo="Tempo médio até a compra" valor={tempoMedio == null ? "—" : `${tempoMedio.toFixed(1)} dias`} />
            <Kpi icone={<MousePointerClick className="w-4 h-4" />} rotulo="Toques registrados" valor={String(totalToques)} />
          </div>

          {/* Ranking de criativos */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-700">Ranking de criativos</span>
              <span className="text-xs text-neutral-400">· modelo: {modelo === "primeiro" ? "primeiro toque" : "último toque"}</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {ranking.map((r) => (
                <button key={r.term} onClick={() => setCriativoAberto(criativoAberto === r.term ? null : r.term)}
                  className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors ${criativoAberto === r.term ? "bg-indigo-50/50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${r.term === SEM_ATRIB ? "text-neutral-400 italic" : "text-neutral-800"}`}>{r.term}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(r.receita / maxReceita) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-24"><div className="text-sm font-semibold text-neutral-800">{brl(r.receita)}</div><div className="text-[11px] text-neutral-400">receita</div></div>
                    <div className="text-right shrink-0 w-16"><div className="text-sm font-semibold text-neutral-800">{r.nPedidos}</div><div className="text-[11px] text-neutral-400">pedidos</div></div>
                    <div className="text-right shrink-0 w-16"><div className="text-sm font-semibold text-neutral-800">{r.nClientes}</div><div className="text-[11px] text-neutral-400">clientes</div></div>
                    <ChevronRight className={`w-4 h-4 text-neutral-300 transition-transform ${criativoAberto === r.term ? "rotate-90" : ""}`} />
                  </div>
                  {/* Drill: pedidos/clientes desse criativo */}
                  {criativoAberto === r.term && aberto && (
                    <div className="mt-3 rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100" onClick={(e) => e.stopPropagation()}>
                      {aberto.pedidos.map((p) => {
                        const c = p.cliente_id ? clientePorId[p.cliente_id] : null;
                        return (
                          <div key={p.pedido_id} className="px-3 py-2 flex items-center gap-3 text-sm">
                            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-neutral-800">{c?.nome || c?.email || "(cliente não identificado)"}</span>
                              {c?.email && c?.nome && <span className="text-neutral-400 text-xs ml-2">{c.email}</span>}
                              <div className="text-[11px] text-neutral-400">pedido {p.pedido_id}{p.produto ? ` · ${p.produto}` : ""} · {dt(p.ocorrido_em)}</div>
                            </div>
                            <span className="font-semibold text-neutral-700 shrink-0">{p.valor != null ? brl(Number(p.valor)) : "—"}</span>
                            {c && (
                              <button onClick={() => setJornadaDe(c)}
                                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50">
                                <Route className="w-3 h-3" /> Jornada
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-neutral-400">
            CAC/ROAS por criativo entram quando o gasto por criativo for conectado (Meta/Google). Receita aqui = pedidos capturados pela atribuição, do go-live em diante.
          </p>
        </>
      )}

      {loading && <p className="text-xs text-neutral-400">Carregando...</p>}

      {jornadaDe && <JornadaDrawer cliente={jornadaDe} onClose={() => setJornadaDe(null)} />}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ icone, rotulo, valor }: { key?: React.Key; icone: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-medium uppercase tracking-wide">{icone}{rotulo}</div>
      <div className="text-xl font-semibold text-neutral-800 mt-1.5">{valor}</div>
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
          ? supabase.from("atr_toques").select("id, vid, ocorrido_em, tipo, source, campaign, content, term").in("vid", vids).order("ocorrido_em")
          : Promise.resolve({ data: [] } as any),
        supabase.from("atr_pedidos").select("pedido_id, cliente_id, valor, produto, ocorrido_em, primeiro_toque, ultimo_toque").eq("cliente_id", cliente.cliente_id).order("ocorrido_em"),
      ]);
      setToques((tq.data as any) ?? []);
      setPedidos((pd.data as any) ?? []);
      setLoading(false);
    })();
  }, [cliente.cliente_id]);

  // Linha do tempo unificada (toques + pedidos)
  const eventos = useMemo(() => {
    const evs: { quando: string; tipo: "toque" | "pedido"; titulo: string; detalhe: string }[] = [
      ...toques.map((t) => ({
        quando: t.ocorrido_em, tipo: "toque" as const,
        titulo: t.term || t.campaign || t.source || "toque",
        detalhe: [t.source, t.campaign, t.content].filter(Boolean).join(" · "),
      })),
      ...pedidos.map((p) => ({
        quando: p.ocorrido_em, tipo: "pedido" as const,
        titulo: `Compra — pedido ${p.pedido_id}`,
        detalhe: [p.produto, p.valor != null ? brl(Number(p.valor)) : null].filter(Boolean).join(" · "),
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
                <span className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow ${ev.tipo === "pedido" ? "bg-emerald-500" : "bg-indigo-400"}`} />
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
