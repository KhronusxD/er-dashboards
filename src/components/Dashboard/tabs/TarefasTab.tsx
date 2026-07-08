import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import {
  ChevronLeft, ChevronRight, Plus, ListTodo, X, Trash2,
  Calendar as CalIcon, LayoutGrid, Clock, Flag,
} from "lucide-react";

// ── Tipos / constantes ──────────────────────────────────────────────────────
type Task = {
  id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  category: string | null;
  status: string;
  due_date: string | null;
  assignee: string | null;
  accent_color: string | null;
  icon: string | null;
};
type Company = { id: string; name: string };

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "#94a3b8" },
  { value: "media", label: "Média", color: "#6366f1" },
  { value: "alta", label: "Alta", color: "#f59e0b" },
  { value: "urgente", label: "Urgente", color: "#ef4444" },
];
const CATEGORIES = [
  { value: "design", label: "Design" },
  { value: "trafego", label: "Tráfego" },
  { value: "social", label: "Social" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "dev", label: "Dev/Site" },
  { value: "financeiro", label: "Financeiro" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
];
const STATUSES = [
  { value: "a_fazer", label: "A fazer", color: "#94a3b8" },
  { value: "fazendo", label: "Fazendo", color: "#6366f1" },
  { value: "revisao", label: "Revisão", color: "#a855f7" },
  { value: "concluido", label: "Concluído", color: "#22c55e" },
];
const priorityOf = (v: string) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[1];
const statusOf = (v: string) => STATUSES.find((s) => s.value === v) ?? STATUSES[0];
const categoryLabel = (v: string | null) => CATEGORIES.find((c) => c.value === v)?.label ?? (v ?? "");
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TASK_COLORS = ["#6366f1", "#06b6d4", "#ef4444", "#3b82f6", "#0ea5e9", "#ec4899", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6"];
const TASK_ICONS = ["✅", "📌", "🔥", "💡", "💰", "🚀", "📣", "🎨", "🧾", "📞", "⚡️", "🎯", "📊", "🛠️", "🤝", "🏁"];

// ── Utils (inline, sem dependências) ────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmm = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
function calendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function companyColor(id: string | null): string {
  if (!id) return "#94a3b8";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 55%)`;
}
function readableOn(bg: string): string {
  // aceita hex (#rrggbb) — hsl usamos branco por padrão
  if (bg.startsWith("#")) {
    const r = parseInt(bg.slice(1, 3), 16), g = parseInt(bg.slice(3, 5), 16), b = parseInt(bg.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? "#1f2937" : "#ffffff";
  }
  return "#ffffff";
}

type Draft = {
  id: string | null;
  company_id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  status: string;
  due_date: string;
  assignee: string;
  accent_color: string;
  icon: string;
};
const emptyDraft = (date?: string): Draft => ({
  id: null, company_id: "", title: "", description: "",
  priority: "media", category: "", status: "a_fazer",
  due_date: date ?? ymd(new Date()), assignee: "", accent_color: "", icon: "",
});

// ── Componente principal ────────────────────────────────────────────────────
export function TarefasTab({ companies }: { companies: Company[] }) {
  const today = new Date();
  const [view, setView] = useState<"calendario" | "kanban">("calendario");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tarefas")
      .select("id, company_id, title, description, priority, category, status, due_date, assignee, accent_color, icon")
      .order("due_date", { ascending: true });
    setTasks((data as any) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => companyFilter === "all" ? tasks : tasks.filter((t) => t.company_id === companyFilter), [tasks, companyFilter]);
  const urgentOpen = useMemo(() => tasks.filter((t) => t.priority === "urgente" && t.status !== "concluido").length, [tasks]);

  function openNew(date?: string) {
    const d = emptyDraft(date);
    if (companyFilter !== "all") d.company_id = companyFilter;
    else if (companies[0]) d.company_id = companies[0].id;
    setDraft(d);
  }
  function openEdit(t: Task) {
    setDraft({
      id: t.id, company_id: t.company_id ?? "", title: t.title, description: t.description ?? "",
      priority: t.priority, category: t.category ?? "", status: t.status,
      due_date: t.due_date ?? "", assignee: t.assignee ?? "",
      accent_color: t.accent_color ?? "", icon: t.icon ?? "",
    });
  }
  async function moveTask(id: string, newDate: string | null) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, due_date: newDate } : t)));
    const { error } = await supabase.from("tarefas").update({ due_date: newDate }).eq("id", id);
    if (error) { alert("Erro ao mover tarefa: " + error.message); load(); }
  }
  // Muda o status ao arrastar entre colunas do kanban
  async function moveStatus(id: string, newStatus: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    const { error } = await supabase.from("tarefas").update({ status: newStatus }).eq("id", id);
    if (error) { alert("Erro ao mover tarefa: " + error.message); load(); }
  }
  async function save() {
    if (!draft || !draft.title.trim()) return;
    const payload = {
      company_id: draft.company_id || null,
      title: draft.title.trim(), description: draft.description.trim() || null,
      priority: draft.priority, category: draft.category || null, status: draft.status,
      due_date: draft.due_date || null, assignee: draft.assignee.trim() || null,
      accent_color: draft.accent_color || null, icon: draft.icon || null,
      updated_at: new Date().toISOString(),
    };
    if (draft.id) {
      const { error } = await supabase.from("tarefas").update(payload).eq("id", draft.id);
      if (error) { alert("Erro ao salvar: " + error.message); return; }
    } else {
      const { error } = await supabase.from("tarefas").insert(payload);
      if (error) { alert("Erro ao criar: " + error.message); return; }
    }
    setDraft(null); load();
  }
  async function remove() {
    if (!draft?.id || !confirm("Excluir esta tarefa?")) return;
    await supabase.from("tarefas").delete().eq("id", draft.id);
    setDraft(null); load();
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ListTodo className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">Tarefas</h2>
            <p className="text-xs text-neutral-500">Organize as demandas — calendário por prazo e kanban por status.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {urgentOpen > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full text-red-600 bg-red-50 border border-red-200">
              <Flag className="w-3.5 h-3.5" /> {urgentOpen} urgente(s)
            </span>
          )}
          <button onClick={() => openNew()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            <Plus className="w-4 h-4" /> Nova tarefa
          </button>
        </div>
      </div>

      {/* View toggle + filtro de cliente */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
          {([["calendario", "Calendário", CalIcon], ["kanban", "Kanban", LayoutGrid]] as const).map(([v, label, Ic]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === v ? "bg-indigo-50 text-indigo-700" : "text-neutral-500 hover:text-neutral-800"}`}>
              <Ic className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setCompanyFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${companyFilter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}>
            Todos
          </button>
          {companies.map((c) => (
            <button key={c.id} onClick={() => setCompanyFilter(companyFilter === c.id ? "all" : c.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${companyFilter === c.id ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}>
              <span className="w-2 h-2 rounded-full" style={{ background: companyColor(c.id) }} />{c.name}
            </button>
          ))}
        </div>
      </div>

      {view === "calendario" ? (
        <CalendarView
          year={year} month={month} setYear={setYear} setMonth={setMonth}
          tasks={filtered} companyById={companyById}
          dragOver={dragOver} setDragOver={setDragOver}
          onOpenNew={openNew} onOpenEdit={openEdit} onMove={moveTask}
        />
      ) : (
        <KanbanView tasks={filtered} companyById={companyById} onOpen={openEdit} onNew={openNew} onMoveStatus={moveStatus} />
      )}

      {loading && <p className="text-xs text-neutral-400">Carregando...</p>}

      {draft && (
        <TaskDrawer draft={draft} setDraft={setDraft} companies={companies} onClose={() => setDraft(null)} onSave={save} onRemove={remove} />
      )}
    </div>
  );
}

// ── Chip de tarefa (arrastável) ─────────────────────────────────────────────
function TaskChip({ t, companyById, onOpenEdit }: { key?: React.Key; t: Task; companyById: Record<string, Company>; onOpenEdit: (t: Task) => void }) {
  const bg = t.accent_color || (t.company_id ? companyColor(t.company_id) : "#64748b");
  const st = statusOf(t.status);
  const pr = priorityOf(t.priority);
  return (
    <div draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/tarefa-id", t.id); e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); onOpenEdit(t); }}
      className="flex flex-col gap-0.5 rounded-md cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform shadow-sm"
      style={{ background: bg, color: readableOn(bg.startsWith("#") ? bg : "#555"), padding: "5px 8px", borderLeft: `5px solid ${st.color}`, minHeight: 26 }}
      title={`${t.title} · ${pr.label} · ${st.label}`}>
      <span className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wide opacity-90">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pr.color }} /> {t.category ? categoryLabel(t.category) : pr.label}
      </span>
      <span className="flex items-start gap-1 text-[11.5px] font-semibold leading-snug">
        {t.icon && <span className="shrink-0" style={{ fontSize: 12 }}>{t.icon}</span>}
        <span className="min-w-0 break-words">{t.title}</span>
      </span>
    </div>
  );
}

// ── Visão calendário ────────────────────────────────────────────────────────
function CalendarView({ year, month, setYear, setMonth, tasks, companyById, dragOver, setDragOver, onOpenNew, onOpenEdit, onMove }: {
  year: number; month: number; setYear: (y: number) => void; setMonth: (m: number) => void;
  tasks: Task[]; companyById: Record<string, Company>;
  dragOver: string | null; setDragOver: (v: string | null) => void;
  onOpenNew: (d?: string) => void; onOpenEdit: (t: Task) => void; onMove: (id: string, d: string | null) => void;
}) {
  const today = new Date();
  const grid = useMemo(() => calendarGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) { if (t.due_date) (m[t.due_date] ??= []).push(t); }
    return m;
  }, [tasks]);
  const noDate = useMemo(() => tasks.filter((t) => !t.due_date), [tasks]);

  function prev() { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function next() { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function drop(target: string | null, e: React.DragEvent) {
    e.preventDefault(); const id = e.dataTransfer.getData("text/tarefa-id"); setDragOver(null); if (id) onMove(id, target);
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={prev} className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-neutral-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-base font-semibold min-w-[150px] text-center text-neutral-800">{MONTHS[month]} {year}</span>
          <button onClick={next} className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-neutral-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <span key={s.value} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ color: s.color, background: `${s.color}1f`, border: `1px solid ${s.color}55` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => <div key={w} className={`text-center text-[11px] font-semibold py-1 ${i === 0 || i === 6 ? "text-neutral-400" : "text-neutral-500"}`}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="min-h-[92px] rounded-lg bg-neutral-50/60" />;
          const key = ymd(date);
          const isToday = ymd(today) === key;
          const dayTasks: Task[] = byDay[key] ?? [];
          return (
            <div key={key}
              onClick={() => onOpenNew(key)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== key) setDragOver(key); }}
              onDragLeave={() => setDragOver(dragOver === key ? null : dragOver)}
              onDrop={(e) => drop(key, e)}
              className={`min-h-[92px] rounded-lg border p-1.5 cursor-pointer transition-colors ${isToday ? "border-indigo-300 bg-indigo-50/40" : "border-neutral-200 hover:bg-neutral-50"} ${dragOver === key ? "ring-2 ring-indigo-400 bg-indigo-50" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] font-semibold ${isToday ? "text-indigo-600" : "text-neutral-500"}`}>{date.getDate()}</span>
                <button onClick={(e) => { e.stopPropagation(); onOpenNew(key); }} className="text-neutral-300 hover:text-indigo-500"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex flex-col gap-1">
                {dayTasks.slice(0, 3).map((t) => <TaskChip key={t.id} t={t} companyById={companyById} onOpenEdit={onOpenEdit} />)}
                {dayTasks.length > 3 && <span className="text-[10px] text-neutral-400 pl-1">+{dayTasks.length - 3} mais</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Backlog sem prazo */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== "backlog") setDragOver("backlog"); }}
        onDragLeave={() => setDragOver(dragOver === "backlog" ? null : dragOver)}
        onDrop={(e) => drop(null, e)}
        className={`mt-4 rounded-xl border border-dashed p-3 transition-colors ${dragOver === "backlog" ? "border-indigo-400 bg-indigo-50" : "border-neutral-300"}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5"><Clock className="w-3 h-3" /> Sem prazo {noDate.length > 0 && `· ${noDate.length}`}</span>
          <button onClick={() => onOpenNew("")} className="text-[11px] text-neutral-500 hover:text-indigo-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Nova sem prazo</button>
        </div>
        {noDate.length === 0 ? (
          <p className="text-[11px] text-neutral-400 py-2">Tarefas sem prazo ficam aqui. Crie uma ou arraste um card do calendário pra cá.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {noDate.map((t) => <div key={t.id} className="w-[200px] max-w-full"><TaskChip t={t} companyById={companyById} onOpenEdit={onOpenEdit} /></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Visão kanban ────────────────────────────────────────────────────────────
function KanbanView({ tasks, companyById, onOpen, onNew, onMoveStatus }: {
  tasks: Task[]; companyById: Record<string, Company>; onOpen: (t: Task) => void; onNew: () => void;
  onMoveStatus: (id: string, status: string) => void;
}) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  function dropOn(status: string, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/tarefa-id");
    setDragOverCol(null);
    if (id) onMoveStatus(id, status);
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {STATUSES.map((s) => {
        const list = tasks.filter((t) => t.status === s.value);
        return (
          <div key={s.value}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverCol !== s.value) setDragOverCol(s.value); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol((c) => (c === s.value ? null : c)); }}
            onDrop={(e) => dropOn(s.value, e)}
            className={`rounded-2xl border p-3 min-h-[120px] transition-colors ${dragOverCol === s.value ? "border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200" : "bg-neutral-50 border-neutral-200"}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-sm font-semibold text-neutral-700">{s.label}</span>
              <span className="ml-auto text-xs text-neutral-400 font-medium">{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((t) => {
                const company = t.company_id ? companyById[t.company_id] : null;
                const pr = priorityOf(t.priority);
                return (
                  <div key={t.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/tarefa-id", t.id); }}
                    onClick={() => onOpen(t)}
                    className="bg-white rounded-xl border border-neutral-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    style={{ borderLeft: `3px solid ${t.accent_color || (t.company_id ? companyColor(t.company_id) : "#cbd5e1")}` }}>
                    <div className="text-sm font-medium text-neutral-800 mb-1.5 flex items-start gap-1.5">
                      {t.icon && <span className="shrink-0">{t.icon}</span>}<span className="break-words">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      {company && <span className="inline-flex items-center gap-1 text-neutral-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: companyColor(t.company_id) }} />{company.name}</span>}
                      {t.due_date && <span className="inline-flex items-center gap-1 text-neutral-500"><Clock className="w-3 h-3" />{ddmm(t.due_date)}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] mt-1.5">
                      <span className="inline-flex items-center gap-1" style={{ color: pr.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: pr.color }} />{pr.label}</span>
                      {t.category && <span className="text-neutral-400">{categoryLabel(t.category)}</span>}
                      {t.assignee && <span className="ml-auto w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 text-[10px] font-semibold flex items-center justify-center">{t.assignee.charAt(0).toUpperCase()}</span>}
                    </div>
                  </div>
                );
              })}
              <button onClick={onNew} className="text-[12px] text-neutral-400 hover:text-indigo-600 flex items-center gap-1 py-1.5"><Plus className="w-3.5 h-3.5" /> Nova tarefa</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Drawer / modal de edição ────────────────────────────────────────────────
function TaskDrawer({ draft, setDraft, companies, onClose, onSave, onRemove }: {
  draft: Draft; setDraft: (d: Draft) => void; companies: Company[];
  onClose: () => void; onSave: () => void; onRemove: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-5 border-b border-neutral-200">
          <div className="flex items-start gap-2">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título da tarefa"
              className="flex-1 text-lg font-semibold text-neutral-800 placeholder:text-neutral-300 focus:outline-none" />
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Cliente / prioridade / categoria */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Cliente</label>
              <select value={draft.company_id} onChange={(e) => setDraft({ ...draft, company_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Sem cliente</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Prioridade</label>
                <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Categoria</label>
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Sem categoria</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => setDraft({ ...draft, status: s.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${draft.status === s.value ? "text-white" : "text-neutral-600 border-neutral-200 hover:bg-neutral-50"}`}
                  style={draft.status === s.value ? { background: s.color, borderColor: s.color } : undefined}>
                  <span className="w-2 h-2 rounded-full" style={{ background: draft.status === s.value ? "#fff" : s.color }} />{s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prazo + responsável */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Prazo</label>
              <input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Responsável</label>
              <input type="text" value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} placeholder="Nome"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Descrição / detalhes</label>
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Descreva a demanda, o que precisa ser feito, links, contexto..." style={{ minHeight: 100 }}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
          </div>

          {/* Aparência: cor + emoji */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Aparência no calendário</label>
            <div className="flex flex-wrap gap-1.5 items-center mb-2">
              <button type="button" onClick={() => setDraft({ ...draft, accent_color: "" })}
                className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-neutral-400 ${!draft.accent_color ? "border-indigo-500" : "border-neutral-200"}`} title="Cor do cliente"><X className="w-3.5 h-3.5" /></button>
              {TASK_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setDraft({ ...draft, accent_color: c })}
                  className={`w-7 h-7 rounded-md transition-transform ${draft.accent_color === c ? "scale-110 ring-2 ring-offset-1 ring-neutral-400" : "hover:scale-105"}`} style={{ background: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              <button type="button" onClick={() => setDraft({ ...draft, icon: "" })}
                className={`w-8 h-8 rounded-md border flex items-center justify-center text-neutral-400 ${!draft.icon ? "border-indigo-500 bg-indigo-50" : "border-neutral-200"}`}><X className="w-3.5 h-3.5" /></button>
              {TASK_ICONS.map((e) => (
                <button key={e} type="button" onClick={() => setDraft({ ...draft, icon: e })}
                  className={`w-8 h-8 rounded-md border flex items-center justify-center text-[16px] ${draft.icon === e ? "border-indigo-500 bg-indigo-50" : "border-neutral-200 hover:bg-neutral-50"}`}>{e}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-200 flex items-center gap-2">
          {draft.id && <button onClick={onRemove} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Excluir</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancelar</button>
          <button onClick={onSave} disabled={!draft.title.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}
