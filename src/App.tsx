import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Sparkles,
  ChevronDown,
  Search,
  Users,
  Award,
  Target,
  LayoutDashboard,
  Receipt,
  Lightbulb,
  ArrowRight,
  Filter,
  Megaphone,
  Calendar,
  Wallet,
  CalendarDays,
  Edit2,
  Save,
  Plus,
  X,
  Activity,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  HandCoins,
  ExternalLink,
  MousePointerClick,
  Percent,
  Settings,
  HelpCircle,
  Download,
  LineChart,
  Zap,
  History,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  LogOut
} from "lucide-react";

import {
  companies,
  performanceMetrics,
  strategyConfig,
} from "./data/mockData";
import { supabase } from "./lib/supabase";
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  PieChart,
  Pie
} from "recharts";

const VariationBadge = ({ current, previous, inverse = false, neutral = false }: { current: number, previous: number, inverse?: boolean, neutral?: boolean }) => {
  if (!previous || previous === 0) return null;
  const rawVariation = ((current - previous) / previous) * 100;
  const variation = isNaN(rawVariation) ? 0 : rawVariation;
  const isPositive = variation > 0;
  const isNeutral = variation === 0;

  // Decide colors
  let colorClass = "text-neutral-500 bg-neutral-100";
  let Icon = Minus;

  if (!isNeutral) {
    if (neutral) {
      colorClass = "text-neutral-600 bg-neutral-100";
      Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    } else {
      const isGood = inverse ? !isPositive : isPositive;
      colorClass = isGood ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50";
      Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    }
  }

  return (
    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`} title={`Anterior: ${previous}`}>
      {!isNeutral && <Icon className="w-3 h-3" />}
      <span>{Math.abs(variation).toFixed(1)}%</span>
    </div>
  );
};

const BUILT_IN_BASE_TEMPLATES = [
  { id: 'default', name: 'Padrão (E-commerce)', description: 'Template padrão para lojas e-commerce' },
  { id: 'whatsapp', name: 'WhatsApp / Leads', description: 'Para clientes que usam WhatsApp como canal principal' },
  { id: 'servicos', name: 'Serviços', description: 'Para negócios de serviços (inspeção, consultoria, etc)' }
];

const BUILT_IN_TEMPLATE_MAPPINGS: Record<string, any> = {
  default: {
    revenue: { date: 'Data', payment: 'Pedidos Pagos', quantity: 'Quantidade Pedidos' },
    traffic: { date: 'Data', investment: 'Investimento', revenue: 'Faturamento Meta Ads', purchases: 'Compras Meta', clicks: 'Cliques no Link', pageViews: 'Visualizações de Página', cartAdditions: 'Adições no Carrinho' },
    googleAds: { date: 'Data', investment: 'Investimento', revenue: 'Valor da conversão', conversions: 'Conversões', clicks: 'Cliques', cartAdditions: 'Adições ao carrinho' }
  },
  whatsapp: {
    revenue: { date: 'Data', payment: 'Faturamento', quantity: 'Fechamentos' },
    traffic: { date: 'Data', investment: 'Investimento Meta Ads', revenue: 'Faturamento Meta Ads', purchases: '', clicks: '', pageViews: '', cartAdditions: 'Leads Totais' },
    googleAds: { date: 'Data', investment: 'Investimento Google Ads', revenue: 'Faturamento Google Ads', conversions: '', clicks: '', cartAdditions: '' }
  },
  servicos: {
    revenue: { date: 'Data', payment: 'Faturamento Diário', quantity: 'Serviço aprovado' },
    traffic: { date: 'Data', investment: 'Investimento', revenue: '', purchases: '', clicks: 'Cliques', pageViews: '', cartAdditions: 'Mensagens' },
    googleAds: { date: 'Data', investment: 'Investimento', revenue: 'Faturamento Google Ads', conversions: 'Conversões', clicks: 'Cliques no Link', cartAdditions: '' }
  }
};

const TEMPLATE_FIELD_LABELS: Record<string, Array<{key: string, label: string}>> = {
  revenue: [
    { key: 'date', label: 'Coluna de Data' },
    { key: 'payment', label: 'Faturamento / Pedidos Pagos' },
    { key: 'quantity', label: 'Quantidade de Pedidos / Fechamentos' },
  ],
  traffic: [
    { key: 'date', label: 'Coluna de Data' },
    { key: 'investment', label: 'Investimento (Meta Ads)' },
    { key: 'revenue', label: 'Faturamento atribuído ao Meta Ads' },
    { key: 'purchases', label: 'Compras / Conversões Meta' },
    { key: 'clicks', label: 'Cliques no Link' },
    { key: 'pageViews', label: 'Visualizações de Página' },
    { key: 'cartAdditions', label: 'Adições no Carrinho / Leads WhatsApp' },
  ],
  googleAds: [
    { key: 'date', label: 'Coluna de Data' },
    { key: 'investment', label: 'Investimento (Google Ads)' },
    { key: 'revenue', label: 'Faturamento / Valor de Conversão' },
    { key: 'conversions', label: 'Conversões Google Ads' },
    { key: 'clicks', label: 'Cliques' },
    { key: 'cartAdditions', label: 'Adições ao Carrinho' },
  ],
};

const AdminPanel = ({ dbCompanies, fetchCompanies }: { dbCompanies: any[], fetchCompanies: () => void }) => {
  const [adminTab, setAdminTab] = useState<'clients' | 'access' | 'templates'>('clients');

  // --- Clients ---
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [formData, setFormData] = useState<any>({
    id: '', name: '', type: 'default', spreadsheet_id: '',
    sheet_tab: '', traffic_tab: '', google_ads_tab: '',
    sheet_gid: '', traffic_gid: '', google_ads_gid: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [companyFeedback, setCompanyFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setCompanyFeedback({ type, msg });
    setTimeout(() => setCompanyFeedback(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: any = {
        id: formData.id,
        name: formData.name,
        type: formData.type,
        spreadsheet_id: formData.spreadsheet_id || null,
        sheet_tab: formData.sheet_tab || null,
        traffic_tab: formData.traffic_tab || null,
        google_ads_tab: formData.google_ads_tab || null,
        sheet_gid: formData.sheet_gid ? parseInt(formData.sheet_gid) : null,
        traffic_gid: formData.traffic_gid ? parseInt(formData.traffic_gid) : null,
        google_ads_gid: formData.google_ads_gid ? parseInt(formData.google_ads_gid) : null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('companies').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      showFeedback('success', `Cliente "${formData.name}" salvo com sucesso!`);
      setIsEditingCompany(false);
      fetchCompanies();
    } catch (err: any) {
      showFeedback('error', 'Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCompany = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${name}"?`)) return;
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      showFeedback('success', `Cliente "${name}" excluído.`);
      fetchCompanies();
    } catch (err: any) {
      showFeedback('error', 'Erro ao excluir: ' + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const openNewForm = () => {
    setFormData({ id: '', name: '', type: 'default', spreadsheet_id: '', sheet_tab: '', traffic_tab: '', google_ads_tab: '', sheet_gid: '', traffic_gid: '', google_ads_gid: '' });
    setIsEditingCompany(true);
  };

  const openEditForm = (c: any) => {
    setFormData({
      id: c.id, name: c.name, type: c.type || 'default',
      spreadsheet_id: c.spreadsheetId || '', sheet_tab: c.sheetTab || '',
      traffic_tab: c.trafficTab || '', google_ads_tab: c.googleAdsTab || '',
      sheet_gid: c.sheetGid || '', traffic_gid: c.trafficGid || '', google_ads_gid: c.googleAdsGid || ''
    });
    setIsEditingCompany(true);
  };

  // --- User Access ---
  const [userAccessList, setUserAccessList] = useState<any[]>([]);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [accessForm, setAccessForm] = useState({ email: '', company_id: '' });
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [isDeletingAccess, setIsDeletingAccess] = useState<string | null>(null);
  const [accessFeedback, setAccessFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const showAccessFeedback = (type: 'success' | 'error', msg: string) => {
    setAccessFeedback({ type, msg });
    setTimeout(() => setAccessFeedback(null), 4000);
  };

  const fetchUserAccess = async () => {
    setIsLoadingAccess(true);
    const { data, error } = await supabase.from('user_access').select('*').order('user_email');
    if (!error) setUserAccessList(data || []);
    setIsLoadingAccess(false);
  };

  useEffect(() => {
    if (adminTab === 'access') fetchUserAccess();
    if (adminTab === 'templates') fetchTemplates();
  }, [adminTab]);

  const handleAddAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessForm.email || !accessForm.company_id) return;
    setIsSavingAccess(true);
    try {
      const { error } = await supabase.from('user_access').insert({
        user_email: accessForm.email.toLowerCase().trim(),
        company_id: accessForm.company_id
      });
      if (error) throw error;
      showAccessFeedback('success', `Acesso adicionado para ${accessForm.email}.`);
      setAccessForm({ email: '', company_id: '' });
      fetchUserAccess();
    } catch (err: any) {
      showAccessFeedback('error', 'Erro ao adicionar acesso: ' + err.message);
    } finally {
      setIsSavingAccess(false);
    }
  };

  const deleteAccess = async (userEmail: string, companyId: string) => {
    const key = `${userEmail}::${companyId}`;
    setIsDeletingAccess(key);
    try {
      const { error } = await supabase.from('user_access').delete()
        .eq('user_email', userEmail)
        .eq('company_id', companyId);
      if (error) throw error;
      showAccessFeedback('success', 'Acesso removido.');
      fetchUserAccess();
    } catch (err: any) {
      showAccessFeedback('error', 'Erro ao remover: ' + err.message);
    } finally {
      setIsDeletingAccess(null);
    }
  };

  // --- Templates ---
  const [templatesList, setTemplatesList] = useState<any[]>(BUILT_IN_BASE_TEMPLATES);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [templateForm, setTemplateForm] = useState<any>({ id: '', name: '', description: '' });
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateData, setNewTemplateData] = useState({ id: '', name: '', description: '', baseType: 'default' });
  const [mappingEditorTab, setMappingEditorTab] = useState<'revenue' | 'traffic' | 'googleAds'>('revenue');
  const [mappingFormValues, setMappingFormValues] = useState<any>({ revenue: {}, traffic: {}, googleAds: {} });
  const [isSavingTemplateMapping, setIsSavingTemplateMapping] = useState(false);

  const showTemplateFeedback = (type: 'success' | 'error', msg: string) => {
    setTemplateFeedback({ type, msg });
    setTimeout(() => setTemplateFeedback(null), 4000);
  };

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const { data } = await supabase.from('client_templates').select('*').order('created_at', { ascending: false });
      const dbTemplates = data || [];
      const dbIds = new Set(dbTemplates.map((t: any) => t.id));
      const merged = [
        ...BUILT_IN_BASE_TEMPLATES.filter(t => !dbIds.has(t.id)),
        ...dbTemplates
      ];
      setTemplatesList(merged);
    } catch (err: any) {
      showTemplateFeedback('error', 'Erro ao carregar templates: ' + err.message);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const initMappingValues = (columnMapping: any, baseType: string = 'default') => {
    const base = BUILT_IN_TEMPLATE_MAPPINGS[baseType] || BUILT_IN_TEMPLATE_MAPPINGS.default;
    if (!columnMapping) return JSON.parse(JSON.stringify(base));
    const convert = (section: any) =>
      Object.fromEntries(Object.entries(section || {}).map(([k, v]) => [k, Array.isArray(v) ? (v[0] || '') : (v || '')]));
    return {
      revenue: { ...base.revenue, ...convert(columnMapping.revenue) },
      traffic: { ...base.traffic, ...convert(columnMapping.traffic) },
      googleAds: { ...base.googleAds, ...convert(columnMapping.googleAds) },
    };
  };

  const openEditTemplateMapping = (template: any) => {
    setEditingTemplateId(template.id);
    setTemplateForm({ id: template.id, name: template.name, description: template.description || '' });
    const baseType = BUILT_IN_BASE_TEMPLATES.find(t => t.id === template.id)?.id || 'default';
    setMappingFormValues(initMappingValues(template.column_mapping, baseType));
    setMappingEditorTab('revenue');
    setIsEditingTemplate(true);
    setShowNewTemplateForm(false);
  };

  const handleCreateNewTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, name, description, baseType } = newTemplateData;
    if (!id || !name) return showTemplateFeedback('error', 'ID e Nome são obrigatórios.');
    if (!/^[a-z0-9-]+$/.test(id)) return showTemplateFeedback('error', 'ID deve conter apenas letras minúsculas, números e hifens.');
    if (templatesList.some((t: any) => t.id === id)) return showTemplateFeedback('error', `ID "${id}" já está em uso.`);
    setTemplateForm({ id, name, description });
    setMappingFormValues(initMappingValues(null, baseType));
    setMappingEditorTab('revenue');
    setEditingTemplateId(id);
    setIsEditingTemplate(true);
    setShowNewTemplateForm(false);
  };

  const buildColumnMapping = (formValues: any) => ({
    revenue: Object.fromEntries(Object.entries(formValues.revenue || {}).map(([k, v]) => [k, v ? [v as string] : []])),
    traffic: Object.fromEntries(Object.entries(formValues.traffic || {}).map(([k, v]) => [k, v ? [v as string] : []])),
    googleAds: Object.fromEntries(Object.entries(formValues.googleAds || {}).map(([k, v]) => [k, v ? [v as string] : []])),
  });

  const handleSaveTemplateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTemplateMapping(true);
    try {
      const columnMapping = buildColumnMapping(mappingFormValues);
      const payload = {
        id: templateForm.id,
        name: templateForm.name,
        description: templateForm.description,
        is_active: true,
        column_mapping: columnMapping,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('client_templates').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      showTemplateFeedback('success', `Template "${templateForm.name}" salvo com sucesso!`);
      setIsEditingTemplate(false);
      setEditingTemplateId(null);
      await fetchTemplates();
    } catch (err: any) {
      showTemplateFeedback('error', 'Erro ao salvar: ' + err.message);
    } finally {
      setIsSavingTemplateMapping(false);
    }
  };

  const deleteCustomTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o template "${name}"?`)) return;
    try {
      const { error } = await supabase.from('client_templates').delete().eq('id', id);
      if (error) throw error;
      showTemplateFeedback('success', `Template "${name}" excluído.`);
      await fetchTemplates();
    } catch (err: any) {
      showTemplateFeedback('error', 'Erro ao excluir: ' + err.message);
    }
  };

  const typeLabel = (type: string) => ({ 'whatsapp': 'WhatsApp / Leads', 'itv-manaus': 'ITV Manaus' }[type] || 'Padrão');
  const typeBadgeClass = (type: string) => ({
    'whatsapp': 'bg-green-50 text-green-700',
    'itv-manaus': 'bg-blue-50 text-blue-700'
  }[type] || 'bg-neutral-100 text-neutral-600');

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header with sub-tabs */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">Administração</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setAdminTab('clients'); setIsEditingCompany(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === 'clients' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            Clientes
          </button>
          <button
            onClick={() => setAdminTab('access')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === 'access' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            Acessos de Usuário
          </button>
          <button
            onClick={() => setAdminTab('templates')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === 'templates' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            Padrões de Visualização
          </button>
        </div>
      </div>

      {/* Feedback messages */}
      {adminTab === 'clients' && companyFeedback && (
        <div className={`p-3 rounded-xl text-sm font-medium border ${companyFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {companyFeedback.msg}
        </div>
      )}
      {adminTab === 'access' && accessFeedback && (
        <div className={`p-3 rounded-xl text-sm font-medium border ${accessFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {accessFeedback.msg}
        </div>
      )}
      {adminTab === 'templates' && templateFeedback && (
        <div className={`p-3 rounded-xl text-sm font-medium border ${templateFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {templateFeedback.msg}
        </div>
      )}

      {/* ===== CLIENTS TAB ===== */}
      {adminTab === 'clients' && (
        <>
          {isEditingCompany ? (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold">{formData.id ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                <button onClick={() => setIsEditingCompany(false)} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      ID <span className="text-neutral-400 font-normal text-xs">(único, não pode ser alterado depois)</span>
                    </label>
                    <input
                      required
                      disabled={!!formData.id}
                      value={formData.id}
                      onChange={e => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono disabled:bg-neutral-50 disabled:text-neutral-500"
                      placeholder="ex: fabrica-do-livro"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Nome de Exibição</label>
                    <input
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="ex: Fábrica do Livro"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo / Padrão de Visualização</label>
                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                      <option value="default">Padrão (E-commerce)</option>
                      <option value="whatsapp">WhatsApp / Leads</option>
                      <option value="itv-manaus">ITV Manaus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">ID da Planilha Principal</label>
                    <input
                      value={formData.spreadsheet_id}
                      onChange={e => setFormData({ ...formData, spreadsheet_id: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="Cole o ID da URL do Google Sheets"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-4">
                  <h4 className="text-sm font-semibold text-neutral-600 mb-3">Nomes das Abas na Planilha</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Aba — Faturamento</label>
                      <input value={formData.sheet_tab} onChange={e => setFormData({ ...formData, sheet_tab: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome exato da aba" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Aba — Meta Ads</label>
                      <input value={formData.traffic_tab} onChange={e => setFormData({ ...formData, traffic_tab: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome exato da aba" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">Aba — Google Ads</label>
                      <input value={formData.google_ads_tab} onChange={e => setFormData({ ...formData, google_ads_tab: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome exato da aba" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-4">
                  <h4 className="text-sm font-semibold text-neutral-600 mb-1">
                    GIDs <span className="font-normal text-neutral-400 text-xs">(alternativa ao nome de aba — preencher só se necessário)</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">GID — Faturamento</label>
                      <input type="number" value={formData.sheet_gid} onChange={e => setFormData({ ...formData, sheet_gid: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="ex: 0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">GID — Meta Ads</label>
                      <input type="number" value={formData.traffic_gid} onChange={e => setFormData({ ...formData, traffic_gid: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="ex: 123456789" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">GID — Google Ads</label>
                      <input type="number" value={formData.google_ads_gid} onChange={e => setFormData({ ...formData, google_ads_gid: e.target.value })} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="ex: 987654321" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-neutral-100">
                  <button type="button" onClick={() => setIsEditingCompany(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60">
                    {isSaving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Salvando…</> : <><Save className="w-3.5 h-3.5" /> Salvar Cliente</>}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-100">
                <span className="text-sm text-neutral-500">{dbCompanies.length} cliente{dbCompanies.length !== 1 ? 's' : ''} cadastrado{dbCompanies.length !== 1 ? 's' : ''}</span>
                <button onClick={openNewForm} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Novo Cliente
                </button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-3 font-medium">ID / Nome</th>
                    <th className="px-6 py-3 font-medium">Tipo</th>
                    <th className="px-6 py-3 font-medium">Planilha</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {dbCompanies.map((c: any) => (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-neutral-900">{c.name}</div>
                        <div className="font-mono text-xs text-neutral-400 mt-0.5">{c.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${typeBadgeClass(c.type)}`}>
                          {typeLabel(c.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {c.spreadsheetId
                          ? <span className="font-mono text-xs text-neutral-500" title={c.spreadsheetId}>{c.spreadsheetId.substring(0, 22)}…</span>
                          : <span className="text-xs text-amber-500 font-medium">Não configurada</span>
                        }
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button onClick={() => openEditForm(c)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                          Editar
                        </button>
                        <button onClick={() => deleteCompany(c.id, c.name)} disabled={isDeleting === c.id} className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-40">
                          {isDeleting === c.id ? 'Excluindo…' : 'Excluir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dbCompanies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-neutral-400 text-sm">Nenhum cliente cadastrado ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== ACCESS TAB ===== */}
      {adminTab === 'access' && (
        <div className="space-y-4">
          {/* Add access form */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">Adicionar Acesso</h3>
            <form onSubmit={handleAddAccess} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">E-mail do usuário</label>
                <input
                  type="email"
                  required
                  value={accessForm.email}
                  onChange={e => setAccessForm({ ...accessForm, email: e.target.value })}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="usuario@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Empresa / Nível de acesso</label>
                <select
                  required
                  value={accessForm.company_id}
                  onChange={e => setAccessForm({ ...accessForm, company_id: e.target.value })}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  <option value="ALL">⭐ Acesso Total (Admin)</option>
                  {dbCompanies.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isSavingAccess}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {isSavingAccess ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Adicionar
              </button>
            </form>
          </div>

          {/* Access list */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Acessos Cadastrados</span>
              <button onClick={fetchUserAccess} className="text-neutral-400 hover:text-neutral-700 transition-colors" title="Atualizar lista">
                <RefreshCw className={`w-4 h-4 ${isLoadingAccess ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {isLoadingAccess ? (
              <div className="px-6 py-10 text-center text-neutral-400 text-sm">Carregando acessos…</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-3 font-medium">Usuário</th>
                    <th className="px-6 py-3 font-medium">Acesso</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {userAccessList.map((entry: any) => {
                    const company = dbCompanies.find((c: any) => c.id === entry.company_id);
                    const key = `${entry.user_email}::${entry.company_id}`;
                    return (
                      <tr key={key} className="hover:bg-neutral-50">
                        <td className="px-6 py-3 font-mono text-xs text-neutral-700">{entry.user_email}</td>
                        <td className="px-6 py-3">
                          {entry.company_id === 'ALL'
                            ? <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">⭐ Admin (Acesso Total)</span>
                            : <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs">{company?.name || entry.company_id}</span>
                          }
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => deleteAccess(entry.user_email, entry.company_id)}
                            disabled={isDeletingAccess === key}
                            className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-40"
                          >
                            {isDeletingAccess === key ? 'Removendo…' : 'Remover'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {userAccessList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-neutral-400 text-sm">Nenhum acesso cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== TEMPLATES TAB ===== */}
      {adminTab === 'templates' && (
        <div className="space-y-4">
          {/* Templates List */}
          {!isEditingTemplate && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">
                  {isLoadingTemplates ? 'Carregando…' : `${templatesList.length} padrão${templatesList.length !== 1 ? 's' : ''}`}
                </span>
                <button
                  onClick={() => { setShowNewTemplateForm(true); setNewTemplateData({ id: '', name: '', description: '', baseType: 'default' }); }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> Criar Novo Padrão
                </button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-100">
                  <tr>
                    <th className="px-6 py-3 font-medium">ID / Nome</th>
                    <th className="px-6 py-3 font-medium">Descrição</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {templatesList.map((template: any) => {
                    const isBuiltIn = BUILT_IN_BASE_TEMPLATES.some(t => t.id === template.id);
                    return (
                      <tr key={template.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-neutral-900">{template.name}</div>
                            {isBuiltIn && <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-mono">built-in</span>}
                          </div>
                          <div className="font-mono text-xs text-neutral-400 mt-0.5">{template.id}</div>
                        </td>
                        <td className="px-6 py-4 text-neutral-600 text-sm">{template.description}</td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button onClick={() => openEditTemplateMapping(template)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                            Editar
                          </button>
                          {!isBuiltIn && (
                            <button onClick={() => deleteCustomTemplate(template.id, template.name)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                              Excluir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* New Template Form */}
          {showNewTemplateForm && !isEditingTemplate && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Criar Novo Padrão</h3>
                <button onClick={() => setShowNewTemplateForm(false)} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateNewTemplate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      ID <span className="text-neutral-400 font-normal text-xs">(único, só minúsculas e hifens)</span>
                    </label>
                    <input
                      required
                      value={newTemplateData.id}
                      onChange={e => setNewTemplateData({ ...newTemplateData, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="ex: meu-template-custom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Nome de Exibição</label>
                    <input
                      required
                      value={newTemplateData.name}
                      onChange={e => setNewTemplateData({ ...newTemplateData, name: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="ex: Meu Padrão Customizado"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Descrição</label>
                    <input
                      value={newTemplateData.description}
                      onChange={e => setNewTemplateData({ ...newTemplateData, description: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="Descrição breve (opcional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Baseado em</label>
                    <select
                      value={newTemplateData.baseType}
                      onChange={e => setNewTemplateData({ ...newTemplateData, baseType: e.target.value })}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="default">Padrão (E-commerce)</option>
                      <option value="whatsapp">WhatsApp / Leads</option>
                      <option value="servicos">Serviços</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-neutral-100">
                  <button type="button" onClick={() => setShowNewTemplateForm(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" /> Continuar para Editor de Mapeamento
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Mapping Editor */}
          {isEditingTemplate && (
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold">Editor de Mapeamento</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Informe o nome exato da coluna na planilha para cada campo</p>
                </div>
                <button onClick={() => { setIsEditingTemplate(false); setEditingTemplateId(null); }} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5 pb-5 border-b border-neutral-100">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">ID do Template</label>
                  <div className="px-3 py-2 bg-neutral-50 rounded-lg text-sm font-mono text-neutral-600">{templateForm.id}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Nome</label>
                  <input
                    value={templateForm.name}
                    onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Descrição</label>
                  <input
                    value={templateForm.description}
                    onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Section tabs */}
              <div className="flex gap-2 mb-5">
                {(['revenue', 'traffic', 'googleAds'] as const).map(section => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setMappingEditorTab(section)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mappingEditorTab === section ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                  >
                    {section === 'revenue' ? 'Faturamento' : section === 'traffic' ? 'Meta Ads' : 'Google Ads'}
                  </button>
                ))}
              </div>

              {/* Fields for active section */}
              <form onSubmit={handleSaveTemplateMapping}>
                <div className="space-y-3 mb-5">
                  {TEMPLATE_FIELD_LABELS[mappingEditorTab].map(field => (
                    <div key={field.key} className="grid grid-cols-5 gap-3 items-center">
                      <label className="col-span-2 text-sm font-medium text-neutral-700">{field.label}</label>
                      <div className="col-span-3">
                        <input
                          value={mappingFormValues[mappingEditorTab]?.[field.key] || ''}
                          onChange={e => setMappingFormValues({
                            ...mappingFormValues,
                            [mappingEditorTab]: { ...mappingFormValues[mappingEditorTab], [field.key]: e.target.value }
                          })}
                          className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="Nome exato da coluna na planilha"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100">
                  <button type="button" onClick={() => { setIsEditingTemplate(false); setEditingTemplateId(null); }} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSavingTemplateMapping} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60">
                    {isSavingTemplateMapping ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Salvando…</> : <><Save className="w-3.5 h-3.5" /> Salvar Template</>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [dbCompanies, setDbCompanies] = useState<any[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [allowedCompanyIds, setAllowedCompanyIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Daily Chart Settings
  const [chartSource, setChartSource] = useState<"all" | "meta" | "google">("all");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const [dateRange, setDateRange] = useState("Últimos 30 dias");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [funnelSource, setFunnelSource] = useState<"all" | "meta" | "google">("all");
  const [monthlyTabMonth, setMonthlyTabMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedWeekIds, setExpandedWeekIds] = useState<string[]>([]);

  // Simulation State
  const [simulationTabMonth, setSimulationTabMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [simInvestment, setSimInvestment] = useState(5000);
  const [simCpc, setSimCpc] = useState(0.85); // 85 centavos default
  const [simViewRate, setSimViewRate] = useState(70);   // 70% Views/Clicks default
  const [simCartRate, setSimCartRate] = useState(15);   // 15% Carts/Views default
  const [simCheckoutRate, setSimCheckoutRate] = useState(40); // 40% ICs/Carts default
  const [simPurcRate, setSimPurcRate] = useState(30);   // 30% Purcs/ICs default
  const [simTicket, setSimTicket] = useState(120); // R$120 default

  // Strategy Edit State
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [localStrategy, setLocalStrategy] = useState(
    strategyConfig[selectedCompany] || strategyConfig["atual-card"],
  );

  // Account Health State
  const defaultAccountHealth = {
    basic: { bmVerified: false, paymentMethods: false, pagesConnected: false, spendingLimit: false },
    campaign: { naming: false, audiences: false, cboAbo: false },
    tracking: { pixel: false, capi: false, events: false, utm: false },
    metrics: {
      cro: {
        lcp: { value: 2.1, good: 4.0, excellent: 2.5, inverse: false, label: "LCP (Tempo de Carregamento)", desc: "Tempo exato que o elemento principal da página de destino leva para renderizar.", unit: "s" },
        dropoff: { value: 18, good: 30, excellent: 15, inverse: false, label: "Taxa de Queda (Drop-off Rate)", desc: "Quebra percentual entre Cliques no Link (Meta) e Views da Página (Pixel/GA4).", unit: "%" },
        bounce: { value: 45, good: 70, excellent: 40, inverse: false, label: "Taxa de Rejeição (Bounce Rate)", desc: "Percentual de usuários de tráfego pago que saem do site sem interagir.", unit: "%" }
      },
      creative: {
        frequency: { value: 2.2, good: 3.0, excellent: 2.0, inverse: false, label: "Frequência (7 Dias)", desc: "Quantas vezes o mesmo usuário viu nossos anúncios (público frio).", unit: "" },
        outboundCTR: { value: 1.1, good: 0.5, excellent: 1.5, inverse: true, label: "CTR de Saída (Outbound)", desc: "Percentual real de pessoas que viram a arte e clicaram para sair do Meta.", unit: "%" },
        hookRate: { value: 28, good: 20, excellent: 35, inverse: true, label: "Hook Rate (Retenção 3s)", desc: "Percentual do público que parou de rolar o feed nos primeiros 3s do vídeo.", unit: "%" }
      },
      data: {
        emq: { value: 6.5, good: 4.0, excellent: 6.0, inverse: true, label: "Event Match Quality (EMQ)", desc: "Nota de correspondência do Meta para os dados do cliente (E-mail, IP, Telefone).", unit: "" },
        discrepancy: { value: 8, good: 20, excellent: 10, inverse: false, label: "Discrepância (Meta vs GA4)", desc: "Diferença entre vendas marcadas no painel do Meta e compras reais lidas no GA4.", unit: "%" },
        deduplication: { value: 92, good: 80, excellent: 95, inverse: true, label: "Taxa de Desduplicação", desc: "Eficiência na fusão dos eventos enviados pelo Navegador (Pixel) e Servidor (API).", unit: "%" }
      },
      finance: {
        cpa: { value: 85, good: 100, excellent: 80, inverse: false, label: "CPA Atual vs CPA Teto", desc: "Relação entre o custo de aquisição de hoje e o limite máximo para não dar prejuízo.", unit: "%" },
        roas: { value: 3.5, good: 2.0, excellent: 4.0, inverse: true, label: "ROAS Atual (Tráfego Pago)", desc: "Retorno sobre o investimento publicitário direto (Faturamento Ads / Custo Ads).", unit: "x" }
      }
    }
  };
  const [accountHealth, setAccountHealth] = useState(defaultAccountHealth);
  const [isSavingHealth, setIsSavingHealth] = useState(false);

  // Google Sheets Data State (Revenue)
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Google Sheets Data State (Traffic/Funnel)
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [isFetchingTraffic, setIsFetchingTraffic] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);

  // Google Sheets Data State (Google Ads)
  const [googleAdsData, setGoogleAdsData] = useState<any[]>([]);
  const [isFetchingGoogleAds, setIsFetchingGoogleAds] = useState(false);
  const [googleAdsError, setGoogleAdsError] = useState<string | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const SHEET_ID = "1kGjFoEJ36-g1empy9HmYzQmF0Rd-y_06sy54YvOYlps";
  const TRAFFIC_SHEET_ID = "1om3vD7mik6psxaLjt6QGqnkEnGdpr6T5dBrNIjYa4BY";

  // Template system - built-in templates for quick access
  const builtInTemplates: Record<string, any> = {
    default: { revenue: { date: ["Data", ""], payment: ["Pedidos Pagos", "Faturamento"], quantity: ["Quantidade Pedidos"] }, traffic: { date: ["Data", ""], investment: ["Investimento"], revenue: ["Faturamento Meta Ads"], purchases: ["Compras Meta"], clicks: ["Cliques no Link"], pageViews: ["Visualizações de Página"], cartAdditions: ["Adições no Carrinho"] }, googleAds: { date: ["Data", ""], investment: ["Investimento"], revenue: ["Valor da conversão"], conversions: ["Conversões"], clicks: ["Cliques"], cartAdditions: ["Adições ao carrinho"] } },
    whatsapp: { revenue: { date: ["Data", ""], payment: ["Faturamento", "$ Total Tráfego", "$ Total WhatsApp"], quantity: ["Fechamentos", "Qtd. Fechamentos"] }, traffic: { date: ["Data", ""], investment: ["Investimento Meta Ads", "Invest. Meta Ads", "Invest. Meta"], revenue: ["Faturamento Meta Ads", "$ Total WhatsApp"], purchases: [], clicks: [], pageViews: [], cartAdditions: ["Leads Totais", "Leads WhatsApp (Meta + Google)", "Leads WhatsApp"] }, googleAds: { date: ["Data", ""], investment: ["Investimento Google Ads", "Invest. Google Ads", "Invest. Google"], revenue: ["Faturamento Google Ads"], conversions: [], clicks: [], cartAdditions: [] } },
    servicos: { revenue: { date: ["Data", ""], payment: ["Faturamento Diário"], quantity: ["Serviço aprovado"] }, traffic: { date: ["Data", ""], investment: ["Investimento"], revenue: [], purchases: [], clicks: ["Cliques"], pageViews: [], cartAdditions: ["Mensagens"] }, googleAds: { date: ["Data", ""], investment: ["Investimento"], revenue: ["Faturamento Google Ads"], conversions: ["Conversões"], clicks: ["Cliques no Link"], cartAdditions: [] } }
  };

  const getClientTemplate = (templateId: string | undefined) => {
    return builtInTemplates[templateId || 'default'] || builtInTemplates.default;
  };

  const mapRowsUsingTemplate = (rows: any[], template: any, dataType: 'revenue' | 'traffic' | 'googleAds') => {
    const cfg = template[dataType];
    if (!cfg) return rows;
    return rows.map((row: any) => {
      const getVal = (fields: string[]) => { for (let f of fields) { if (row[f] !== undefined && row[f] !== "") return row[f]; } return "0"; };
      const mapped: any = { ...row };
      if (dataType === 'revenue') { mapped["Data"] = getVal(cfg.date); mapped["Pedidos Pagos"] = getVal(cfg.payment); mapped["Quantidade Pedidos"] = getVal(cfg.quantity); }
      else if (dataType === 'traffic') { mapped["Data"] = getVal(cfg.date); mapped["Investimento"] = getVal(cfg.investment); mapped["Faturamento Meta Ads"] = getVal(cfg.revenue); mapped["Compras Meta"] = cfg.purchases?.length ? getVal(cfg.purchases) : "0"; mapped["Cliques no Link"] = cfg.clicks?.length ? getVal(cfg.clicks) : "0"; mapped["Visualizações de Página"] = cfg.pageViews?.length ? getVal(cfg.pageViews) : "0"; mapped["Adições no Carrinho"] = getVal(cfg.cartAdditions); }
      else if (dataType === 'googleAds') { mapped["Data"] = getVal(cfg.date); mapped["Investimento"] = getVal(cfg.investment); mapped["Valor da conversão"] = getVal(cfg.revenue); mapped["Conversões"] = cfg.conversions?.length ? getVal(cfg.conversions) : "0"; mapped["Cliques"] = cfg.clicks?.length ? getVal(cfg.clicks) : "0"; mapped["Adições ao carrinho"] = cfg.cartAdditions?.length ? getVal(cfg.cartAdditions) : "0"; }
      return mapped;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [strategyRes, healthRes] = await Promise.all([
          supabase.from('strategies').select('strategy_data').eq('company_id', selectedCompany).single(),
          supabase.from('account_health').select('health_data').eq('company_id', selectedCompany).single()
        ]);

        if (strategyRes.data && strategyRes.data.strategy_data) {
          setLocalStrategy(strategyRes.data.strategy_data);
        } else {
          setLocalStrategy(strategyConfig[selectedCompany] || strategyConfig["atual-card"]);
        }

        if (healthRes.data && healthRes.data.health_data) {
          // Merge to ensure missing fields from older saves get the new metrics object
          const loadedHealth = healthRes.data.health_data;
          setAccountHealth({
            ...defaultAccountHealth,
            ...loadedHealth,
            metrics: {
              ...defaultAccountHealth.metrics,
              ...loadedHealth.metrics
            }
          });
        } else {
          setAccountHealth(defaultAccountHealth);
        }
      } catch (err) {
        console.error("Data load error", err);
        setLocalStrategy(strategyConfig[selectedCompany] || strategyConfig["atual-card"]);
        setAccountHealth(defaultAccountHealth);
      }
    };
    if (isAuthenticated && (allowedCompanyIds.includes('ALL') || allowedCompanyIds.includes(selectedCompany))) {
      fetchData();
    }
    setIsEditingStrategy(false);
  }, [selectedCompany, isAuthenticated, allowedCompanyIds]);

  // Check Supabase Auth Session on mount
  const fetchCompaniesAndAccess = async (email: string) => {
    setIsLoadingCompanies(true);
    try {
      const { data: compData, error: compError } = await supabase.from('companies').select('*');
      const loadedCompanies = compData || [];
      const mappedCompanies = loadedCompanies.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        sheetGid: c.sheet_gid,
        trafficGid: c.traffic_gid,
        googleAdsGid: c.google_ads_gid,
        spreadsheetId: c.spreadsheet_id,
        sheetTab: c.sheet_tab,
        trafficTab: c.traffic_tab,
        googleAdsTab: c.google_ads_tab
      }));
      setDbCompanies(mappedCompanies);

      const { data, error } = await supabase
        .from('user_access')
        .select('company_id')
        .eq('user_email', email);

      if (error || !data || data.length === 0) {
        console.error("Erro ao buscar acesso do usuário ou usuário sem acesso:", error);
        setAllowedCompanyIds(['NONE']);
        setIsLoadingCompanies(false);
        return;
      }

      const ids = data.map((d: any) => {
        if (d.company_id === 'ALL') return 'ALL';
        const dbId = d.company_id.trim().toLowerCase();
        const exactMatch = mappedCompanies.find(c => c.id.toLowerCase() === dbId);
        if (exactMatch) return exactMatch.id;
        return d.company_id.trim().toLowerCase().replace(/_/g, '-');
      });

      if (ids.includes('ALL')) {
        setIsAdmin(true);
        const allIds = mappedCompanies.map(c => c.id);
        setAllowedCompanyIds(allIds);
        setSelectedCompany(prev => (prev && allIds.includes(prev) ? prev : allIds[0] || ''));
      } else {
        setIsAdmin(false);
        setAllowedCompanyIds(ids);
        setSelectedCompany(prev => {
          if (ids.length > 0 && !ids.includes(prev)) {
            return ids[0];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Erro inesperado ao buscar acesso:", err);
      setAllowedCompanyIds(['NONE']);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  useEffect(() => {

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        if (session.user?.email) {
          fetchCompaniesAndAccess(session.user.email);
        } else {
          setIsLoadingCompanies(false);
        }
      } else {
        setIsLoadingCompanies(false);
      }
    };

    checkSession();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (event === 'SIGNED_IN' && session?.user?.email) {
        fetchCompaniesAndAccess(session.user.email);
      } else if (!session) {
        setAllowedCompanyIds(['NONE']);
        setIsLoadingCompanies(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated && allowedCompanyIds.length > 0 && !allowedCompanyIds.includes(selectedCompany)) return;

    setIsFetchingSheet(true);
    setSheetError(null);
    setIsFetchingTraffic(true);
    setTrafficError(null);
    setIsFetchingGoogleAds(true);
    setGoogleAdsError(null);

    const currentCompanyObj = dbCompanies.find((c) => c.id === selectedCompany);
    const tabName = currentCompanyObj?.name || "";
    const hasSheetGid = !!(currentCompanyObj?.sheetGid);
    const hasTrafficGid = !!(currentCompanyObj?.trafficGid);
    const hasGoogleAdsGid = !!(currentCompanyObj?.googleAdsGid);
    const clientTemplate = getClientTemplate((currentCompanyObj as any)?.templateId || (currentCompanyObj as any)?.type);
    const customSpreadsheetId = (currentCompanyObj as any)?.spreadsheetId;
    const customSheetTab = (currentCompanyObj as any)?.sheetTab || tabName;
    const customTrafficTab = (currentCompanyObj as any)?.trafficTab || tabName;
    const customGoogleAdsTab = (currentCompanyObj as any)?.googleAdsTab || `${tabName} - Google Ads`;
    const sheetRange = (currentCompanyObj as any)?.sheetRange;
    const rangeParams = sheetRange ? `&range=${sheetRange}` : "";

    // Fetch Revenue Sheet
    const url = hasSheetGid
      ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${(currentCompanyObj as any).sheetGid}${rangeParams}`
      : `https://docs.google.com/spreadsheets/d/${customSpreadsheetId || SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(customSheetTab)}${rangeParams}`;

    Papa.parse(url, {
      download: true,
      header: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setSheetError(`Erro ao carregar a planilha. Verifique se ela está pública e se existe uma aba com o nome exato: "${tabName}".`);
        } else {
          if (results.meta.fields && results.meta.fields.length === 1 && results.meta.fields[0].includes("<!DOCTYPE html>")) {
            setSheetError(`A planilha é privada. Você precisa alterar o acesso para "Qualquer pessoa com o link" no Google Sheets.`);
          } else {
            let validData = results.data.filter((row: any) => Object.values(row).some(val => val !== ""));
            validData = mapRowsUsingTemplate(validData, clientTemplate, 'revenue');
            setSheetData(validData);
          }
        }
        setIsFetchingSheet(false);
      },
      error: (error) => {
        setSheetError("Erro de conexão ao tentar ler a planilha. Verifique se o link está correto e público.");
        setIsFetchingSheet(false);
      }
    });

    const trafficUrl = hasTrafficGid
      ? `https://docs.google.com/spreadsheets/d/${TRAFFIC_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${(currentCompanyObj as any).trafficGid}${rangeParams}`
      : `https://docs.google.com/spreadsheets/d/${customSpreadsheetId || TRAFFIC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(customTrafficTab)}${rangeParams}`;

    Papa.parse(trafficUrl, {
      download: true,
      header: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setTrafficError(`Erro ao carregar a planilha de tráfego. Verifique se ela está pública e se existe uma aba com o nome exato: "${tabName}".`);
        } else {
          if (results.meta.fields && results.meta.fields.length === 1 && results.meta.fields[0].includes("<!DOCTYPE html>")) {
            setTrafficError(`A planilha de tráfego é privada. Você precisa alterar o acesso para "Qualquer pessoa com o link".`);
          } else {
            let validData = results.data.filter((row: any) => Object.values(row).some(val => val !== ""));
            validData = mapRowsUsingTemplate(validData, clientTemplate, 'traffic');
            setTrafficData(validData);
          }
        }
        setIsFetchingTraffic(false);
      },
      error: (error) => {
        setTrafficError("Erro de conexão ao tentar ler a planilha de tráfego.");
        setIsFetchingTraffic(false);
      }
    });

    // Fetch Google Ads Sheet
    const usesCustomSpreadsheet = ['whatsapp', 'servicos'].includes((currentCompanyObj as any)?.templateId || (currentCompanyObj as any)?.type);
    const googleAdsUrl = hasGoogleAdsGid
      ? `https://docs.google.com/spreadsheets/d/${TRAFFIC_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${(currentCompanyObj as any).googleAdsGid}${rangeParams}`
      : usesCustomSpreadsheet
        ? `https://docs.google.com/spreadsheets/d/${customSpreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(customGoogleAdsTab)}${rangeParams}`
        : `https://docs.google.com/spreadsheets/d/${TRAFFIC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(customGoogleAdsTab)}${rangeParams}`;

    Papa.parse(googleAdsUrl, {
      download: true,
      header: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setGoogleAdsError(`Erro ao carregar a planilha do Google Ads. Verifique se ela está pública e se existe uma aba com o nome exato: "${customGoogleAdsTab}".`);
        } else {
          if (results.meta.fields && results.meta.fields.length === 1 && results.meta.fields[0].includes("<!DOCTYPE html>")) {
            setGoogleAdsError(`A planilha do Google Ads é privada. Você precisa alterar o acesso para "Qualquer pessoa com o link".`);
          } else {
            let validData = results.data.filter((row: any) => Object.values(row).some(val => val !== ""));
            validData = mapRowsUsingTemplate(validData, clientTemplate, 'googleAds');
            setGoogleAdsData(validData);
          }
        }
        setIsFetchingGoogleAds(false);
      },
      error: (error) => {
        setGoogleAdsError("Erro de conexão ao tentar ler a planilha do Google Ads.");
        setIsFetchingGoogleAds(false);
      }
    });

  }, [selectedCompany, refreshTrigger, isAuthenticated, allowedCompanyIds]);

  const [isSavingStrategy, setIsSavingStrategy] = useState(false);

  const handleSaveStrategy = async () => {
    setIsSavingStrategy(true);
    try {
      const { error } = await supabase
        .from('strategies')
        .upsert({
          company_id: selectedCompany,
          strategy_data: localStrategy
        }, { onConflict: 'company_id' });

      if (!error) {
        setIsEditingStrategy(false);
      } else {
        alert("Erro ao salvar a estratégia no banco de dados.");
        console.error(error);
      }
    } catch (err) {
      alert("Erro ao salvar a estratégia.");
      console.error(err);
    } finally {
      setIsSavingStrategy(false);
    }
  };

  const handleHealthCheckChange = async (category: "basic" | "campaign" | "tracking", item: string, value: boolean) => {
    const newHealthState = {
      ...accountHealth,
      [category]: {
        ...accountHealth[category as keyof typeof accountHealth],
        [item]: value
      }
    };

    setAccountHealth(newHealthState);
    setIsSavingHealth(true);

    try {
      await supabase
        .from('account_health')
        .upsert({
          company_id: selectedCompany,
          health_data: newHealthState
        }, { onConflict: 'company_id' });
    } catch (err) {
      console.error("Erro ao salvar saúde da conta:", err);
    } finally {
      setIsSavingHealth(false);
    }
  };

  const calculateHealthScore = (category: "basic" | "campaign" | "tracking") => {
    const items = Object.values(accountHealth[category as keyof typeof accountHealth]);
    const checked = items.filter(Boolean).length;
    return (checked / items.length) * 10;
  };

  const getHealthColorConfig = (score: number) => {
    if (score < 5) return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', circle: 'stroke-red-500', bar: 'bg-red-500', label: 'Crítico' };
    if (score < 7) return { text: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', circle: 'stroke-amber-500', bar: 'bg-amber-500', label: 'Atenção' };
    if (score < 9) return { text: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', circle: 'stroke-emerald-500', bar: 'bg-emerald-500', label: 'Bom' };
    return { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', circle: 'stroke-blue-600', bar: 'bg-blue-600', label: 'Excelente' };
  };

  const basicScore = calculateHealthScore('basic');
  const campaignScore = calculateHealthScore('campaign');
  const trackingScore = calculateHealthScore('tracking');

  const calculateSingleMetricScore = (metric: any) => {
    const { value, good, excellent, inverse } = metric;
    const numValue = Number(value);
    const numGood = Number(good);
    const numExcellent = Number(excellent);

    // Safety check if numbers are invalid
    if (isNaN(numValue) || isNaN(numGood) || isNaN(numExcellent)) return 0;

    if (inverse) {
      if (numValue >= numExcellent) return 10;
      if (numValue < numGood) return 0;
      // Interpolate between good and excellent (5 to 10)
      const range = numExcellent - numGood;
      const position = numValue - numGood;
      return 5 + (position / range) * 5;
    } else {
      if (numValue <= numExcellent) return 10;
      if (numValue > numGood) return 0;
      // Interpolate between good and excellent (5 to 10), but backwards
      const range = numGood - numExcellent;
      const position = numGood - numValue;
      return 5 + (position / range) * 5;
    }
  };

  const getModuleAvgScore = (moduleName: string) => {
    const moduleMetrics = Object.values((accountHealth.metrics as any)[moduleName] || {});
    if (moduleMetrics.length === 0) return 0;

    let totalScore = 0;
    moduleMetrics.forEach((m: any) => {
      totalScore += calculateSingleMetricScore(m);
    });

    return totalScore / moduleMetrics.length;
  };

  const croScore = getModuleAvgScore('cro');
  const creativeScore = getModuleAvgScore('creative');
  const dataScore = getModuleAvgScore('data');
  const financeScore = getModuleAvgScore('finance');

  const overallHealthScore = (basicScore + campaignScore + trackingScore + croScore + creativeScore + dataScore + financeScore) / 7;
  const overallHealthConfig = getHealthColorConfig(overallHealthScore);

  const getMetricHealthColor = (metric: any) => {
    const { value, good, excellent, inverse } = metric;

    // Parse value to number just in case
    const numValue = Number(value);
    const numGood = Number(good);
    const numExcellent = Number(excellent);

    if (inverse) {
      if (numValue >= numExcellent) return 'text-emerald-500';
      if (numValue >= numGood) return 'text-amber-500';
      return 'text-red-500';
    } else {
      if (numValue <= numExcellent) return 'text-emerald-500';
      if (numValue <= numGood) return 'text-amber-500';
      return 'text-red-500';
    }
  };

  const parseNumberStr = (str: string | number | undefined | null) => {
    if (!str) return 0;
    const s = String(str).trim();
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
      } else {
        return parseFloat(s.replace(/,/g, ''));
      }
    } else if (s.includes(',')) {
      return parseFloat(s.replace(',', '.'));
    } else {
      return parseFloat(s.replace(/[^\d.-]/g, ''));
    }
  };

  const handleMetricChange = async (moduleName: string, metricKey: string, field: 'value' | 'good' | 'excellent', newValue: string) => {
    const numValue = Number(newValue);
    if (isNaN(numValue)) return;

    const newHealthState = {
      ...accountHealth,
      metrics: {
        ...accountHealth.metrics,
        [moduleName]: {
          ...(accountHealth.metrics as any)[moduleName],
          [metricKey]: {
            ...(accountHealth.metrics as any)[moduleName][metricKey],
            [field]: numValue
          }
        }
      }
    };

    setAccountHealth(newHealthState);
    setIsSavingHealth(true);

    try {
      await supabase
        .from('account_health')
        .upsert({
          company_id: selectedCompany,
          health_data: newHealthState
        }, { onConflict: 'company_id' });
    } catch (err) {
      console.error("Erro ao salvar métricas:", err);
    } finally {
      setIsSavingHealth(false);
    }
  };

  const currentCompany = dbCompanies.find((c) => c.id === selectedCompany);
  const mockMetrics =
    performanceMetrics[selectedCompany] || performanceMetrics["atual-card"];

  // Parse DD/MM or ISO date string to Date object
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes('T')) {
      const [year, month, day] = dateStr.split('T')[0].split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    const [day, month] = dateStr.split('/');
    if (!day || !month) return null;
    const year = new Date().getFullYear();
    return new Date(year, parseInt(month) - 1, parseInt(day));
  };

  // Check if a date is within the selected range
  const isDateInRange = (rowDate: Date | null) => {
    if (!rowDate) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedRowDate = new Date(rowDate);
    normalizedRowDate.setHours(0, 0, 0, 0);

    if (dateRange === "Hoje") {
      return normalizedRowDate.getTime() === today.getTime();
    }
    if (dateRange === "Ontem") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return normalizedRowDate.getTime() === yesterday.getTime();
    }
    if (dateRange === "Hoje e ontem") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return normalizedRowDate >= yesterday && normalizedRowDate <= today;
    }
    if (dateRange === "Últimos 7 dias") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      return normalizedRowDate >= sevenDaysAgo && normalizedRowDate <= today;
    }
    if (dateRange === "Últimos 14 dias") {
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(today.getDate() - 13);
      return normalizedRowDate >= fourteenDaysAgo && normalizedRowDate <= today;
    }
    if (dateRange === "Últimos 28 dias") {
      const twentyEightDaysAgo = new Date(today);
      twentyEightDaysAgo.setDate(today.getDate() - 27);
      return normalizedRowDate >= twentyEightDaysAgo && normalizedRowDate <= today;
    }
    if (dateRange === "Últimos 30 dias") {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 29);
      return normalizedRowDate >= thirtyDaysAgo && normalizedRowDate <= today;
    }
    if (dateRange === "Esta semana") {
      const firstDayOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // ajusta quando o dia é domingo
      firstDayOfWeek.setDate(diff);
      return normalizedRowDate >= firstDayOfWeek && normalizedRowDate <= today;
    }
    if (dateRange === "Semana passada") {
      const firstDayOfLastWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
      firstDayOfLastWeek.setDate(diff);

      const lastDayOfLastWeek = new Date(firstDayOfLastWeek);
      lastDayOfLastWeek.setDate(firstDayOfLastWeek.getDate() + 6);

      return normalizedRowDate >= firstDayOfLastWeek && normalizedRowDate <= lastDayOfLastWeek;
    }
    if (dateRange === "Este mês") {
      return normalizedRowDate.getMonth() === today.getMonth() && normalizedRowDate.getFullYear() === today.getFullYear();
    }
    if (dateRange === "Mês passado") {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      return normalizedRowDate.getMonth() === lastMonth.getMonth() && normalizedRowDate.getFullYear() === lastMonth.getFullYear();
    }
    if (dateRange === "Máximo") {
      return true;
    }
    if (dateRange === "Personalizado") {
      if (!customStartDate || !customEndDate) return true;
      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T00:00:00');
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return normalizedRowDate >= start && normalizedRowDate <= end;
    }
    return true;
  };

  // Check if a date is within the *previous* equivalent range
  const isDateInPreviousRange = (rowDate: Date | null) => {
    if (!rowDate) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedRowDate = new Date(rowDate);
    normalizedRowDate.setHours(0, 0, 0, 0);

    if (dateRange === "Hoje") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return normalizedRowDate.getTime() === yesterday.getTime();
    }
    if (dateRange === "Ontem") {
      const d2 = new Date(today);
      d2.setDate(today.getDate() - 2);
      return normalizedRowDate.getTime() === d2.getTime();
    }
    if (dateRange === "Hoje e ontem") {
      const d3 = new Date(today);
      d3.setDate(today.getDate() - 3);
      const d2 = new Date(today);
      d2.setDate(today.getDate() - 2);
      return normalizedRowDate >= d3 && normalizedRowDate <= d2;
    }
    if (dateRange === "Últimos 7 dias") {
      const d14 = new Date(today);
      d14.setDate(today.getDate() - 13);
      const d7 = new Date(today);
      d7.setDate(today.getDate() - 7);
      return normalizedRowDate >= d14 && normalizedRowDate <= d7;
    }
    if (dateRange === "Últimos 14 dias") {
      const d28 = new Date(today);
      d28.setDate(today.getDate() - 27);
      const d14 = new Date(today);
      d14.setDate(today.getDate() - 14);
      return normalizedRowDate >= d28 && normalizedRowDate <= d14;
    }
    if (dateRange === "Últimos 28 dias") {
      const d56 = new Date(today);
      d56.setDate(today.getDate() - 55);
      const d28 = new Date(today);
      d28.setDate(today.getDate() - 28);
      return normalizedRowDate >= d56 && normalizedRowDate <= d28;
    }
    if (dateRange === "Últimos 30 dias") {
      const d60 = new Date(today);
      d60.setDate(today.getDate() - 59);
      const d30 = new Date(today);
      d30.setDate(today.getDate() - 30);
      return normalizedRowDate >= d60 && normalizedRowDate <= d30;
    }
    if (dateRange === "Esta semana") {
      const firstDayOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      firstDayOfWeek.setDate(diff);

      const firstDayOfLastWeek = new Date(firstDayOfWeek);
      firstDayOfLastWeek.setDate(firstDayOfWeek.getDate() - 7);

      const lastDayOfLastWeekToToday = new Date(firstDayOfLastWeek);
      const currentDaysCount = Math.ceil((today.getTime() - firstDayOfWeek.getTime()) / (1000 * 3600 * 24));
      lastDayOfLastWeekToToday.setDate(firstDayOfLastWeek.getDate() + currentDaysCount);

      return normalizedRowDate >= firstDayOfLastWeek && normalizedRowDate <= lastDayOfLastWeekToToday;
    }
    if (dateRange === "Semana passada") {
      const firstDayOf2WeeksAgo = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 14;
      firstDayOf2WeeksAgo.setDate(diff);

      const lastDayOf2WeeksAgo = new Date(firstDayOf2WeeksAgo);
      lastDayOf2WeeksAgo.setDate(firstDayOf2WeeksAgo.getDate() + 6);

      return normalizedRowDate >= firstDayOf2WeeksAgo && normalizedRowDate <= lastDayOf2WeeksAgo;
    }
    if (dateRange === "Este mês") {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      return normalizedRowDate.getMonth() === lastMonth.getMonth() && normalizedRowDate.getFullYear() === lastMonth.getFullYear();
    }
    if (dateRange === "Mês passado") {
      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setMonth(today.getMonth() - 2);
      return normalizedRowDate.getMonth() === twoMonthsAgo.getMonth() && normalizedRowDate.getFullYear() === twoMonthsAgo.getFullYear();
    }
    if (dateRange === "Máximo") {
      return false; // Retorna false para que não hajama métricas "anteriores" em all-time
    }
    if (dateRange === "Personalizado") {
      if (!customStartDate || !customEndDate) return true;
      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T00:00:00');
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive

      const prevEnd = new Date(start);
      prevEnd.setDate(start.getDate() - 1);

      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - diffDays + 1);

      return normalizedRowDate >= prevStart && normalizedRowDate <= prevEnd;
    }
    return true;
  };

  // Filter sheet data based on selected date range
  const getFilteredData = () => {
    return sheetData.filter(row => isDateInRange(parseDate(row["Data"])));
  };
  const filteredData = getFilteredData();

  const getPreviousFilteredData = () => {
    return sheetData.filter(row => isDateInPreviousRange(parseDate(row["Data"])));
  };
  const previousFilteredData = getPreviousFilteredData();

  // Compute metrics from filtered sheet data
  const computedMetrics = {
    revenue: 0,
    purchases: 0,
    prevRevenue: 0,
    prevPurchases: 0,
    totalEntrada: 0,
    servicoAprovado: 0,
    totalSaidas: 0,
    prevTotalEntrada: 0,
    prevServicoAprovado: 0,
    prevTotalSaidas: 0,
  };

  filteredData.forEach(row => {
    const revenueStr = row["Pedidos Pagos"] || "0";
    const revenueNum = parseNumberStr(revenueStr);
    if (!isNaN(revenueNum)) computedMetrics.revenue += revenueNum;

    const purchasesStr = row["Quantidade Pedidos"] || "0";
    const purchasesNum = parseInt(purchasesStr, 10);
    if (!isNaN(purchasesNum)) computedMetrics.purchases += purchasesNum;

    const totalEntradaStr = row["Total de Entrada"] || "0";
    const totalEntradaNum = parseInt(totalEntradaStr, 10);
    if (!isNaN(totalEntradaNum)) computedMetrics.totalEntrada += totalEntradaNum;

    const servicoAprovadoStr = row["Quantidade Pedidos"] || "0"; // Mapeado anteriormente
    const servicoAprovadoNum = parseInt(servicoAprovadoStr, 10);
    if (!isNaN(servicoAprovadoNum)) computedMetrics.servicoAprovado += servicoAprovadoNum;

    const totalSaidasStr = row["Total de Saídas"] || "0";
    const totalSaidasNum = parseInt(totalSaidasStr, 10);
    if (!isNaN(totalSaidasNum)) computedMetrics.totalSaidas += totalSaidasNum;
  });

  previousFilteredData.forEach(row => {
    const revenueStr = row["Pedidos Pagos"] || "0";
    const revenueNum = parseNumberStr(revenueStr);
    if (!isNaN(revenueNum)) computedMetrics.prevRevenue += revenueNum;

    const purchasesStr = row["Quantidade Pedidos"] || "0";
    const purchasesNum = parseInt(purchasesStr, 10);
    if (!isNaN(purchasesNum)) computedMetrics.prevPurchases += purchasesNum;

    const totalEntradaStr = row["Total de Entrada"] || "0";
    const totalEntradaNum = parseInt(totalEntradaStr, 10);
    if (!isNaN(totalEntradaNum)) computedMetrics.prevTotalEntrada += totalEntradaNum;

    const servicoAprovadoStr = row["Quantidade Pedidos"] || "0";
    const servicoAprovadoNum = parseInt(servicoAprovadoStr, 10);
    if (!isNaN(servicoAprovadoNum)) computedMetrics.prevServicoAprovado += servicoAprovadoNum;

    const totalSaidasStr = row["Total de Saídas"] || "0";
    const totalSaidasNum = parseInt(totalSaidasStr, 10);
    if (!isNaN(totalSaidasNum)) computedMetrics.prevTotalSaidas += totalSaidasNum;
  });

  const formattedRevenue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedMetrics.revenue);

  // Calculate daily data for the chart from filteredData
  const dailyChartData = useMemo(() => {
    if (!filteredData.length && !trafficData.length && !googleAdsData.length) return [];

    const dailyMap = new Map<string, {
      dateStr: string,
      timestamp: number,
      totalRevenue: number,
      metaRevenue: number,
      metaCost: number,
      googleRevenue: number,
      googleCost: number
    }>();

    const getOrCreateDay = (d: Date) => {
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const timestamp = d.getTime();
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          dateStr,
          timestamp,
          totalRevenue: 0,
          metaRevenue: 0,
          metaCost: 0,
          googleRevenue: 0,
          googleCost: 0
        });
      }
      return dailyMap.get(dateStr)!;
    };

    // Process Revenue (Total)
    filteredData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d) {
        const dayData = getOrCreateDay(d);
        const rStr = row["Pedidos Pagos"] || "0";
        const rNum = parseNumberStr(rStr);
        if (!isNaN(rNum)) dayData.totalRevenue += rNum;
      }
    });

    // Process Meta Ads Costs & Revenue
    trafficData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInRange(d)) {
        const dayData = getOrCreateDay(d);

        const gStr = row["Investimento"] || row["Gastos"] || "0";
        const gNum = parseNumberStr(gStr);
        if (!isNaN(gNum)) dayData.metaCost += gNum;

        const rStr = row["Faturamento Meta Ads"] || "0";
        const rNum = parseNumberStr(rStr);
        if (!isNaN(rNum)) dayData.metaRevenue += rNum;
      }
    });

    // Process Google Ads Costs & Revenue
    googleAdsData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInRange(d)) {
        const dayData = getOrCreateDay(d);

        const gStr = row["Investimento"] || row["Gastos"] || "0";
        const gNum = parseNumberStr(gStr);
        if (!isNaN(gNum)) dayData.googleCost += gNum;

        const rStr = row["Faturamento Google Ads"] || row["Valor da conversão"] || "0";
        const rNum = parseNumberStr(rStr);
        if (!isNaN(rNum)) dayData.googleRevenue += rNum;
      }
    });

    // Calculate derived fields & Sort
    const result = Array.from(dailyMap.values()).map(item => ({
      ...item,
      totalCost: item.metaCost + item.googleCost,
      profit: item.totalRevenue - (item.metaCost + item.googleCost)
    })).sort((a, b) => a.timestamp - b.timestamp);

    return result;
  }, [filteredData, trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  // Compute traffic metrics
  const computedTrafficMetrics = useMemo(() => {
    let investimentoMeta = 0;
    let investimentoGoogle = 0;
    let prevInvestimentoMeta = 0;
    let prevInvestimentoGoogle = 0;

    let metaPurchases = 0;
    let googlePurchases = 0;
    let prevMetaPurchases = 0;
    let prevGooglePurchases = 0;

    let faturamentoMeta = 0;
    let faturamentoGoogle = 0;
    let prevFaturamentoMeta = 0;
    let prevFaturamentoGoogle = 0;

    trafficData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;

      const gStr = row["Investimento"] || row["Gastos"] || "0";
      const g = parseNumberStr(gStr);
      const pStr = row["Compras Meta"] || "0";
      const p = parseNumberStr(pStr);
      const fStr = row["Faturamento Meta Ads"] || "0";
      const f = parseNumberStr(fStr);

      if (isDateInRange(rowDate)) {
        if (!isNaN(g)) investimentoMeta += g;
        if (!isNaN(p)) metaPurchases += p;
        if (!isNaN(f)) faturamentoMeta += f;
      } else if (isDateInPreviousRange(rowDate)) {
        if (!isNaN(g)) prevInvestimentoMeta += g;
        if (!isNaN(p)) prevMetaPurchases += p;
        if (!isNaN(f)) prevFaturamentoMeta += f;
      }
    });

    googleAdsData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;

      const gStr = row["Investimento"] || row["Gastos"] || "0";
      const g = parseNumberStr(gStr);
      const pStr = row["Compras Meta"] || row["Conversões"] || "0";
      const p = parseNumberStr(pStr);
      const fStr = row["Faturamento Google Ads"] || row["Valor da conversão"] || "0";
      const f = parseNumberStr(fStr);

      if (isDateInRange(rowDate)) {
        if (!isNaN(g)) investimentoGoogle += g;
        if (!isNaN(p)) googlePurchases += p;
        if (!isNaN(f)) faturamentoGoogle += f;
      } else if (isDateInPreviousRange(rowDate)) {
        if (!isNaN(g)) prevInvestimentoGoogle += g;
        if (!isNaN(p)) prevGooglePurchases += p;
        if (!isNaN(f)) prevFaturamentoGoogle += f;
      }
    });

    const investimentoTotal = investimentoMeta + investimentoGoogle;
    const prevInvestimentoTotal = prevInvestimentoMeta + prevInvestimentoGoogle;

    return {
      investimentoMeta,
      investimentoGoogle,
      investimentoTotal,
      prevInvestimentoMeta,
      prevInvestimentoGoogle,
      prevInvestimentoTotal,
      metaPurchases,
      googlePurchases,
      prevMetaPurchases,
      prevGooglePurchases,
      faturamentoMeta,
      faturamentoGoogle,
      prevFaturamentoMeta,
      prevFaturamentoGoogle,
    };
  }, [trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  const funnelDataSources = useMemo(() => {
    const meta: Record<string, number> = {
      'Cliques no Link': 0,
      'Visualizações de Página': 0,
      'Adições no Carrinho': 0,
      'Checkout': 0,
      'Compras Meta': 0
    };

    const google: Record<string, number> = {
      'Cliques no Link': 0,
      'Visualizações de Página': 0,
      'Adições no Carrinho': 0,
      'Checkout': 0,
      'Compras Meta': 0
    };

    const all: Record<string, number> = {
      'Cliques no Link': 0,
      'Visualizações de Página': 0,
      'Adições no Carrinho': 0,
      'Checkout': 0,
      'Compras Meta': 0
    };

    trafficData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;

      if (isDateInRange(rowDate)) {
        ['Cliques no Link', 'Visualizações de Página', 'Adições no Carrinho', 'Checkout', 'Compras Meta'].forEach(key => {
          const valStr = row[key] || "0";
          const val = parseInt(valStr.replace(/\./g, ''), 10);
          if (!isNaN(val)) {
            meta[key] += val;
            all[key] += val;
          }
        });
      }
    });

    googleAdsData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;

      if (isDateInRange(rowDate)) {
        // Tenta os nomes novos da planilha, ou faz graceful fallback para os nomes antigos do CSV Google Ads default
        const clicks = row['Cliques no Link'] || row['Cliques'] || "0";
        const conversions = row['Compras Meta'] || row['Conversões'] || "0";

        const valClicks = parseNumberStr(clicks);
        if (!isNaN(valClicks)) {
          google['Cliques no Link'] += valClicks;
          all['Cliques no Link'] += valClicks;
        }

        const valConversions = parseNumberStr(conversions);
        if (!isNaN(valConversions)) {
          google['Compras Meta'] += valConversions;
          all['Compras Meta'] += valConversions;
        }
      }
    });

    return { meta, google, all };
  }, [trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  // Calculate ROI based on real revenue and real investment
  const investmentNum = computedTrafficMetrics.investimentoTotal;
  let calculatedRoi = "0.00x";
  let currentCalculatedRoiNum = 0;

  if (!isNaN(investmentNum) && investmentNum > 0 && computedMetrics.revenue > 0) {
    currentCalculatedRoiNum = computedMetrics.revenue / investmentNum;
    calculatedRoi = `${currentCalculatedRoiNum.toFixed(2)}x`;
  }

  const prevInvestmentNum = computedTrafficMetrics.prevInvestimentoTotal;
  let prevCalculatedRoiNum = 0;

  if (!isNaN(prevInvestmentNum) && prevInvestmentNum > 0 && computedMetrics.prevRevenue > 0) {
    prevCalculatedRoiNum = computedMetrics.prevRevenue / prevInvestmentNum;
  }

  let metaRoi = "0.00x";
  if (computedTrafficMetrics.investimentoMeta > 0) {
    metaRoi = `${(computedTrafficMetrics.faturamentoMeta / computedTrafficMetrics.investimentoMeta).toFixed(2)}x`;
  }

  let googleRoi = "0.00x";
  if (computedTrafficMetrics.investimentoGoogle > 0) {
    googleRoi = `${(computedTrafficMetrics.faturamentoGoogle / computedTrafficMetrics.investimentoGoogle).toFixed(2)}x`;
  }

  // Calculate new Metrics (Leads, CAC, CPL/CPA)
  const isWhatsapp = (dbCompanies.find(c => c.id === selectedCompany) as any)?.type === "whatsapp";
  const isItvManaus = (dbCompanies.find(c => c.id === selectedCompany) as any)?.type === "itv-manaus";

  const totalLeads = useMemo(() => {
    let leads = 0;
    trafficData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInRange(d)) {
        // We mapped Whatsapp Leads to Adições no Carrinho
        const lStr = row["Adições no Carrinho"] || "0";
        const l = parseInt(lStr.replace(/\./g, ''), 10);
        if (!isNaN(l)) leads += l;
      }
    });
    if (isItvManaus) {
      googleAdsData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (d && isDateInRange(d)) {
          const lStr = row["Conversões"] || "0";
          const l = parseInt(lStr.replace(/\./g, ''), 10);
          if (!isNaN(l)) leads += l;
        }
      });
    }
    return leads;
  }, [trafficData, googleAdsData, isItvManaus, dateRange, customStartDate, customEndDate]);

  const prevTotalLeads = useMemo(() => {
    let leads = 0;
    trafficData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInPreviousRange(d)) {
        const lStr = row["Adições no Carrinho"] || "0";
        const l = parseInt(lStr.replace(/\./g, ''), 10);
        if (!isNaN(l)) leads += l;
      }
    });
    if (isItvManaus) {
      googleAdsData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (d && isDateInPreviousRange(d)) {
          const lStr = row["Conversões"] || "0";
          const l = parseInt(lStr.replace(/\./g, ''), 10);
          if (!isNaN(l)) leads += l;
        }
      });
    }
    return leads;
  }, [trafficData, googleAdsData, isItvManaus, dateRange, customStartDate, customEndDate]);

  const totalConversions = isWhatsapp ? computedMetrics.purchases : computedMetrics.purchases;
  const prevTotalConversions = isWhatsapp ? computedMetrics.prevPurchases : computedMetrics.prevPurchases;

  const currentCac = totalConversions > 0 ? investmentNum / totalConversions : 0;
  const prevCac = prevTotalConversions > 0 ? prevInvestmentNum / prevTotalConversions : 0;

  const currentCpl = isWhatsapp
    ? (totalLeads > 0 ? investmentNum / totalLeads : 0)
    : (totalConversions > 0 ? investmentNum / totalConversions : 0); // fallback CPA for e-commerce
  const prevCpl = isWhatsapp
    ? (prevTotalLeads > 0 ? prevInvestmentNum / prevTotalLeads : 0)
    : (prevTotalConversions > 0 ? prevInvestmentNum / prevTotalConversions : 0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error || !data.user) {
        setLoginError("E-mail ou senha inválidos.");
      } else {
        setIsAuthenticated(true);
        setLoginEmail("");
        setLoginPassword("");
      }
    } catch (err) {
      setLoginError("Erro ao conectar.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsAuthenticated(false);
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
  };

  const monthlyMetrics = useMemo(() => {
    if (activeTab !== "monthly") return null;

    const [yearStr, monthStr] = monthlyTabMonth.split('-');
    if (!yearStr || !monthStr) return null;

    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let currentStart = new Date(firstDay);
    let weekCount = 1;

    while (currentStart <= lastDay) {
      const currentEnd = new Date(currentStart);
      while (currentEnd.getDay() !== 0 && currentEnd < lastDay) {
        currentEnd.setDate(currentEnd.getDate() + 1);
      }

      weeks.push({
        id: `week-${weekCount}`,
        label: `Semana ${weekCount}`,
        start: new Date(currentStart),
        end: new Date(currentEnd),
        dateLabel: `${currentStart.getDate().toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')} a ${currentEnd.getDate().toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}`
      });

      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
      weekCount++;
    }

    const calcMetricsForRange = (start: Date, end: Date) => {
      const isDateInRangeLocal = (d: Date | null) => {
        if (!d) return false;
        const norm = new Date(d);
        norm.setHours(0, 0, 0, 0);
        const ns = new Date(start); ns.setHours(0, 0, 0, 0);
        const ne = new Date(end); ne.setHours(0, 0, 0, 0);
        return norm >= ns && norm <= ne;
      };

      let revenue = 0, purchases = 0, invMeta = 0, invGoogle = 0;
      let metaRevenue = 0, googleRevenue = 0;
      let metaPurchases = 0, googlePurchases = 0;

      sheetData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (isDateInRangeLocal(d)) {
          const rStr = row["Pedidos Pagos"] || "0";
          const rNum = parseNumberStr(rStr);
          if (!isNaN(rNum)) revenue += rNum;
          const pStr = row["Quantidade Pedidos"] || "0";
          const pNum = parseInt(pStr, 10);
          if (!isNaN(pNum)) purchases += pNum;
        }
      });

      trafficData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (isDateInRangeLocal(d)) {
          const gStr = row["Investimento"] || row["Gastos"] || "0";
          const g = parseNumberStr(gStr);
          if (!isNaN(g)) invMeta += g;

          const pStr = row["Compras Meta"] || "0";
          const p = parseNumberStr(pStr);
          if (!isNaN(p)) metaPurchases += p;

          const fStr = row["Faturamento Meta Ads"] || "0";
          const f = parseNumberStr(fStr);
          if (!isNaN(f)) metaRevenue += f;
        }
      });

      googleAdsData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (isDateInRangeLocal(d)) {
          const gStr = row["Investimento"] || row["Gastos"] || "0";
          const g = parseNumberStr(gStr);
          if (!isNaN(g)) invGoogle += g;

          const pStr = row["Compras Meta"] || row["Conversões"] || "0";
          const p = parseNumberStr(pStr);
          if (!isNaN(p)) googlePurchases += p;

          const fStr = row["Faturamento Google Ads"] || row["Valor da conversão"] || "0";
          const f = parseNumberStr(fStr);
          if (!isNaN(f)) googleRevenue += f;
        }
      });

      const totalInv = invMeta + invGoogle;
      const roi = (totalInv > 0 && revenue > 0) ? (revenue / totalInv) : 0;
      const metaRoi = (invMeta > 0 && metaRevenue > 0) ? (metaRevenue / invMeta) : 0;
      const googleRoi = (invGoogle > 0 && googleRevenue > 0) ? (googleRevenue / invGoogle) : 0;

      return {
        revenue, purchases, totalInv, roi,
        metaRevenue, googleRevenue, metaPurchases, googlePurchases, invMeta, invGoogle, metaRoi, googleRoi
      };
    };

    const monthMetrics = calcMetricsForRange(firstDay, lastDay);
    const weeksMetrics = weeks.map(w => {
      const prevStart = new Date(w.start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(w.end);
      prevEnd.setDate(prevEnd.getDate() - 7);

      return {
        ...w,
        metrics: calcMetricsForRange(w.start, w.end),
        prevMetrics: calcMetricsForRange(prevStart, prevEnd)
      };
    });

    return { month: monthMetrics, weeks: weeksMetrics };
  }, [activeTab, monthlyTabMonth, sheetData, trafficData, googleAdsData]);

  const simBaseMetrics = useMemo(() => {
    if (activeTab !== "simulations") return null;

    const [yearStr, monthStr] = simulationTabMonth.split('-');
    if (!yearStr || !monthStr) return null;

    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const isDateInRangeLocal = (d: Date | null) => {
      if (!d) return false;
      const norm = new Date(d);
      norm.setHours(0, 0, 0, 0);
      const ns = new Date(start); ns.setHours(0, 0, 0, 0);
      const ne = new Date(end); ne.setHours(0, 0, 0, 0);
      return norm >= ns && norm <= ne;
    };

    let revenue = 0, purchases = 0, inv = 0, clicks = 0;
    let views = 0, carts = 0, checkouts = 0;

    let metaRevenue = 0, metaInv = 0, metaClicks = 0;
    let metaViews = 0, metaCarts = 0, metaCheckouts = 0;
    let metaPurchases = 0;

    sheetData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (isDateInRangeLocal(d)) {
        const rStr = row["Pedidos Pagos"] || "0";
        const rNum = parseNumberStr(rStr);
        if (!isNaN(rNum)) revenue += rNum;

        const pStr = row["Quantidade Pedidos"] || "0";
        const pNum = parseInt(pStr, 10);
        if (!isNaN(pNum)) purchases += pNum;
      }
    });

    trafficData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (isDateInRangeLocal(d)) {
        const gStr = row["Investimento"] || row["Gastos"] || "0";
        const g = parseNumberStr(gStr);
        if (!isNaN(g)) {
          inv += g;
          metaInv += g;
        }

        const cStr = row["Cliques no Link"] || row["Cliques"] || "0";
        const cNum = parseInt(cStr.replace(/\./g, ''), 10);
        if (!isNaN(cNum)) {
          clicks += cNum;
          metaClicks += cNum;
        }

        const vStr = row["Visualizações de página de destino"] || row["Visualizações de Página"] || "0";
        const vNum = parseInt(vStr.replace(/\./g, ''), 10);
        if (!isNaN(vNum)) {
          views += vNum;
          metaViews += vNum;
        }

        const cartStr = row["Adições no Carrinho"] || row["Adições ao Carrinho"] || row["Adições ao carrinho"] || "0";
        const cartNum = parseInt(cartStr.replace(/\./g, ''), 10);
        if (!isNaN(cartNum)) {
          carts += cartNum;
          metaCarts += cartNum;
        }

        const chkStr = row["Finalizações de compra iniciadas"] || row["Checkout"] || "0";
        const chkNum = parseInt(chkStr.replace(/\./g, ''), 10);
        if (!isNaN(chkNum)) {
          checkouts += chkNum;
          metaCheckouts += chkNum;
        }

        const purcStr = row["Compras Meta"] || row["Compras de no site"] || row["Compras"] || "0";
        const purcNum = parseInt(purcStr.replace(/\./g, ''), 10);
        if (!isNaN(purcNum)) {
          metaPurchases += purcNum;
        }

        const revStr = row["Faturamento Meta Ads"] || row["Valor de conversão de compras no site"] || row["Faturamento"] || "0";
        const rev = parseNumberStr(revStr);
        if (!isNaN(rev)) {
          metaRevenue += rev;
        }
      }
    });

    googleAdsData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (isDateInRangeLocal(d)) {
        const gStr = row["Investimento"] || row["Gastos"] || "0";
        const g = parseNumberStr(gStr);
        if (!isNaN(g)) inv += g;

        const cStr = row["Cliques no Link"] || row["Cliques"] || "0";
        const cNum = parseNumberStr(cStr);
        if (!isNaN(cNum)) clicks += cNum;

        const vStr = row["Visualizações de página de destino"] || row["Visualizações de Página"] || "0";
        const vNum = parseNumberStr(vStr);
        if (!isNaN(vNum)) views += vNum;

        const cartStr = row["Adições ao carrinho"] || row["Adições ao Carrinho"] || "0";
        const cartNum = parseNumberStr(cartStr);
        if (!isNaN(cartNum)) carts += cartNum;

        const chkStr = row["Finalizações de compra iniciadas"] || row["Checkout"] || "0";
        const chkNum = parseNumberStr(chkStr);
        if (!isNaN(chkNum)) checkouts += chkNum;
      }
    });

    const baseTicket = purchases > 0 ? revenue / purchases : 0;
    const baseCpc = clicks > 0 ? inv / clicks : 0;
    const baseCpa = purchases > 0 ? inv / purchases : 0;

    const baseMetaTicket = metaPurchases > 0 ? metaRevenue / metaPurchases : 150;
    const baseMetaCpc = metaClicks > 0 ? metaInv / metaClicks : 2.5;

    // Funnel Conversions
    const baseViewRate = clicks > 0 ? (views / clicks) * 100 : 0;
    const baseCartRate = views > 0 ? (carts / views) * 100 : 0;
    const baseCheckoutRate = carts > 0 ? (checkouts / carts) * 100 : 0;
    const basePurcRate = checkouts > 0 ? (purchases / checkouts) * 100 : 0;

    const baseMetaViewRate = metaClicks > 0 ? (metaViews / metaClicks) * 100 : 80;
    const baseMetaCartRate = metaViews > 0 ? (metaCarts / metaViews) * 100 : 50;
    const baseMetaCheckoutRate = metaCarts > 0 ? (metaCheckouts / metaCarts) * 100 : 40;
    const baseMetaPurcRate = metaCheckouts > 0 ? (metaPurchases / metaCheckouts) * 100 : 30;

    const baseConvRate = clicks > 0 ? (purchases / clicks) * 100 : 0;
    const roi = inv > 0 ? revenue / inv : 0;

    return {
      revenue, purchases, inv, clicks, views, carts, checkouts,
      baseTicket, baseCpc, baseCpa, baseConvRate, roi,
      baseViewRate, baseCartRate, baseCheckoutRate, basePurcRate,
      metaRevenue, metaInv, metaClicks, metaViews, metaCarts, metaCheckouts, metaPurchases,
      baseMetaTicket, baseMetaCpc, baseMetaViewRate, baseMetaCartRate, baseMetaCheckoutRate, baseMetaPurcRate
    };
  }, [activeTab, simulationTabMonth, sheetData, trafficData, googleAdsData]);

  // Derived Simulation Metrics (Full Funnel)
  const simulatedClicks = simCpc > 0 ? simInvestment / simCpc : 0;
  const simulatedViews = simulatedClicks * (simViewRate / 100);
  const simulatedCarts = simulatedViews * (simCartRate / 100);
  const simulatedCheckouts = simulatedCarts * (simCheckoutRate / 100);
  const simulatedPurchases = simulatedCheckouts * (simPurcRate / 100);

  const simulatedCpa = simulatedPurchases > 0 ? simInvestment / simulatedPurchases : 0;
  const simulatedRevenue = simulatedPurchases * simTicket;
  const simulatedRoi = simInvestment > 0 ? simulatedRevenue / simInvestment : 0;

  // Global Presumed Revenue: (Total Base - Meta Base) + Simulated Meta Revenue
  const simulatedGlobalRevenue = simBaseMetrics ?
    ((simBaseMetrics.revenue - (simBaseMetrics.metaRevenue || 0)) + simulatedRevenue) : 0;

  if (isLoadingCompanies && isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Login NAPAN</h2>
            <p className="text-neutral-500 mb-8">Faça login para acessar o Traffic Hub</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2"
              >
                {isLoggingIn ? "Acessando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              Dashboards
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                disabled={allowedCompanyIds.length <= 1 && allowedCompanyIds.length !== 0}
                className={`appearance-none bg-neutral-100 border border-neutral-200 text-neutral-800 py-2 pl-4 pr-10 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${allowedCompanyIds.length <= 1 && allowedCompanyIds.length !== 0 ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {dbCompanies.filter(c => allowedCompanyIds.includes(c.id)).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Sair do sistema"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8 min-h-[calc(100vh-4rem)]">
        {/* Sidebar Tabs */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto pb-4 md:pb-0">
            {[
              {
                id: "overview",
                label: "Visão Geral",
                icon: <LayoutDashboard className="w-4 h-4" />,
              },
              {
                id: "monthly",
                label: "Visão Mensal",
                icon: <CalendarDays className="w-4 h-4" />,
              },
              {
                id: "funnel",
                label: "Funil de Vendas",
                icon: <Filter className="w-4 h-4" />,
              },
              {
                id: "account-health",
                label: "Saúde da Conta",
                icon: <Activity className="w-4 h-4" />,
              },
              {
                id: "revenue",
                label: "Faturamento",
                icon: <Receipt className="w-4 h-4" />,
              },
              {
                id: "strategy",
                label: "Estratégia",
                icon: <Lightbulb className="w-4 h-4" />,
              },
              {
                id: "simulations",
                label: "Simulador",
                icon: <Lightbulb className="w-4 h-4" />,
              },
              ...(isAdmin ? [{
                id: "admin",
                label: "Gerenciar Clientes",
                icon: <Settings className="w-4 h-4" />,
              }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id
                  ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent"
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Tab Content */}
          {activeTab === "admin" && (
            <AdminPanel
              dbCompanies={dbCompanies}
              fetchCompanies={() => supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user?.email) fetchCompaniesAndAccess(session.user.email);
              })}
            />
          )}

          {activeTab === "overview" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Overview Header with Date Picker */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <h2 className="text-lg font-semibold text-neutral-800">
                  Resumo de Performance
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-600 transition-colors"
                    title="Atualizar dados base"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingSheet || isFetchingTraffic || isFetchingGoogleAds ? 'animate-spin' : ''}`} />
                  </button>
                  {dateRange === "Personalizado" && (
                    <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg p-1">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="bg-transparent text-sm text-neutral-700 px-2 py-1 focus:outline-none"
                      />
                      <span className="text-neutral-400 text-sm">até</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="bg-transparent text-sm text-neutral-700 px-2 py-1 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="appearance-none bg-neutral-50 border border-neutral-200 text-neutral-700 py-2 pl-10 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                    >
                      <option>Hoje</option>
                      <option>Ontem</option>
                      <option>Hoje e ontem</option>
                      <option>Últimos 7 dias</option>
                      <option>Últimos 14 dias</option>
                      <option>Últimos 28 dias</option>
                      <option>Últimos 30 dias</option>
                      <option>Esta semana</option>
                      <option>Semana passada</option>
                      <option>Este mês</option>
                      <option>Mês passado</option>
                      <option>Máximo</option>
                      <option>Personalizado</option>
                    </select>
                    <Calendar className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Metric Cards */}
              <div className={`grid grid-cols-1 md:grid-cols-2 ${isWhatsapp || isItvManaus ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
                {isItvManaus ? (
                  <>
                    <MetricCard
                      title="Total de Entrada"
                      value={computedMetrics.totalEntrada.toString()}
                      currentAmount={computedMetrics.totalEntrada}
                      previousAmount={computedMetrics.prevTotalEntrada}
                      isCurrency={false}
                      icon={<Users className="w-5 h-5 text-blue-600" />}
                    />
                    <MetricCard
                      title="Serviço Aprovado"
                      value={computedMetrics.servicoAprovado.toString()}
                      currentAmount={computedMetrics.servicoAprovado}
                      previousAmount={computedMetrics.prevServicoAprovado}
                      isCurrency={false}
                      icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    />
                    <MetricCard
                      title="Total de Saídas"
                      value={computedMetrics.totalSaidas.toString()}
                      currentAmount={computedMetrics.totalSaidas}
                      previousAmount={computedMetrics.prevTotalSaidas}
                      isCurrency={false}
                      icon={<ShoppingCart className="w-5 h-5 text-orange-600" />}
                    />
                    <MetricCard
                      title="Investimento Total"
                      value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.investimentoTotal)}
                      currentAmount={computedTrafficMetrics.investimentoTotal}
                      previousAmount={computedTrafficMetrics.prevInvestimentoTotal}
                      isCurrency={true}
                      icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
                      inverseChange
                      subtitle={
                        <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.investimentoMeta)} ({computedTrafficMetrics.investimentoTotal > 0 ? ((computedTrafficMetrics.investimentoMeta / computedTrafficMetrics.investimentoTotal) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              Google: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.investimentoGoogle)} ({computedTrafficMetrics.investimentoTotal > 0 ? ((computedTrafficMetrics.investimentoGoogle / computedTrafficMetrics.investimentoTotal) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title="Leads Totais"
                      value={totalLeads.toString()}
                      currentAmount={totalLeads}
                      previousAmount={prevTotalLeads}
                      isCurrency={false}
                      icon={<Users className="w-5 h-5 text-purple-600" />}
                      subtitle={
                        <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              Meta: {funnelDataSources.meta['Adições no Carrinho']} ({totalLeads > 0 ? ((funnelDataSources.meta['Adições no Carrinho'] / totalLeads) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              Google: {funnelDataSources.google['Compras Meta']} ({totalLeads > 0 ? ((funnelDataSources.google['Compras Meta'] / totalLeads) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>
                      }
                    />
                    <MetricCard
                      title="Faturamento"
                      value={formattedRevenue}
                      currentAmount={computedMetrics.revenue}
                      previousAmount={computedMetrics.prevRevenue}
                      isCurrency={true}
                      icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
                      subtitle={
                        <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.faturamentoMeta)} ({computedMetrics.revenue > 0 ? ((computedTrafficMetrics.faturamentoMeta / computedMetrics.revenue) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              Google: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.faturamentoGoogle)} ({computedMetrics.revenue > 0 ? ((computedTrafficMetrics.faturamentoGoogle / computedMetrics.revenue) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>
                      }
                    />
                  </>
                ) : (
                  <>
                <MetricCard
                  title="Faturamento"
                  value={formattedRevenue}
                  currentAmount={computedMetrics.revenue}
                  previousAmount={computedMetrics.prevRevenue}
                  isCurrency={true}
                  icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
                  subtitle={
                    <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.faturamentoMeta)} ({computedMetrics.revenue > 0 ? ((computedTrafficMetrics.faturamentoMeta / computedMetrics.revenue) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          Google: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.faturamentoGoogle)} ({computedMetrics.revenue > 0 ? ((computedTrafficMetrics.faturamentoGoogle / computedMetrics.revenue) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    </div>
                  }
                />
                <MetricCard
                  title="Investimento"
                  value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.investimentoTotal)}
                  currentAmount={computedTrafficMetrics.investimentoTotal}
                  previousAmount={computedTrafficMetrics.prevInvestimentoTotal}
                  isCurrency={true}
                  icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
                  inverseChange
                  subtitle={
                    <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.investimentoMeta)} ({computedTrafficMetrics.investimentoTotal > 0 ? ((computedTrafficMetrics.investimentoMeta / computedTrafficMetrics.investimentoTotal) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          Google: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedTrafficMetrics.investimentoGoogle)} ({computedTrafficMetrics.investimentoTotal > 0 ? ((computedTrafficMetrics.investimentoGoogle / computedTrafficMetrics.investimentoTotal) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    </div>
                  }
                />
                <MetricCard
                  title={isWhatsapp ? "Leads Totais" : "Compras"}
                  value={isWhatsapp ? totalLeads.toString() : computedMetrics.purchases.toString()}
                  currentAmount={isWhatsapp ? totalLeads : computedMetrics.purchases}
                  previousAmount={isWhatsapp ? prevTotalLeads : computedMetrics.prevPurchases}
                  isCurrency={false}
                  icon={isWhatsapp ? <Users className="w-5 h-5 text-blue-600" /> : <ShoppingCart className="w-5 h-5 text-blue-600" />}
                  subtitle={
                    !isWhatsapp ? (
                      <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            Meta: {computedTrafficMetrics.metaPurchases.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ({computedMetrics.purchases > 0 ? ((computedTrafficMetrics.metaPurchases / computedMetrics.purchases) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            Google: {computedTrafficMetrics.googlePurchases.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ({computedMetrics.purchases > 0 ? ((computedTrafficMetrics.googlePurchases / computedMetrics.purchases) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                      </div>
                    ) : undefined
                  }
                />
                {isWhatsapp ? (
                  <MetricCard
                    title="Fechamentos"
                    value={computedMetrics.purchases.toString()}
                    currentAmount={computedMetrics.purchases}
                    previousAmount={computedMetrics.prevPurchases}
                    isCurrency={false}
                    icon={<CheckCircle2 className="w-5 h-5 text-purple-600" />}
                  />
                ) : (
                  <MetricCard
                    title="ROI"
                    value={calculatedRoi}
                    currentAmount={currentCalculatedRoiNum}
                    previousAmount={prevCalculatedRoiNum}
                    isCurrency={false}
                    icon={<BarChart3 className="w-5 h-5 text-purple-600" />}
                    subtitle={
                      <div className="flex flex-col gap-1 mt-1 text-[10px] sm:text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            Meta: {metaRoi}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            Google: {googleRoi}
                          </span>
                        </div>
                      </div>
                    }
                  />
                )}
                {isWhatsapp ? (
                  <MetricCard
                    title="CAC"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCac)}
                    currentAmount={currentCac}
                    previousAmount={prevCac}
                    isCurrency={true}
                    icon={<Activity className="w-5 h-5 text-orange-600" />}
                    inverseChange
                  />
                ) : null}
                {isWhatsapp && (
                  <MetricCard
                    title="CPL"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCpl)}
                    currentAmount={currentCpl}
                    previousAmount={prevCpl}
                    isCurrency={true}
                    icon={<Filter className="w-5 h-5 text-teal-600" />}
                    inverseChange
                  />
                )}
                  </>
                )}
              </div>

              {/* Daily Profitability Chart */}
              {dailyChartData.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800">Faturamento Diário</h3>
                      <p className="text-sm text-neutral-500">Acompanhe as receitas e investimentos diários detalhados</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Chart Source Toggle */}
                      <div className="flex bg-neutral-100 p-1 rounded-lg">
                        <button
                          onClick={() => setChartSource('all')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${chartSource === 'all' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                          Juntos
                        </button>
                        <button
                          onClick={() => setChartSource('meta')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${chartSource === 'meta' ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                          Meta Ads
                        </button>
                        <button
                          onClick={() => setChartSource('google')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${chartSource === 'google' ? 'bg-white text-emerald-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                          Google Ads
                        </button>
                      </div>

                      {/* Chart Type Toggle */}
                      <div className="flex bg-neutral-100 p-1 rounded-lg">
                        <button
                          onClick={() => setChartType('bar')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${chartType === 'bar' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                          Barras
                        </button>
                        <button
                          onClick={() => setChartType('line')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${chartType === 'line' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                          Linhas
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'bar' ? (
                        <BarChart
                          data={dailyChartData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis
                            dataKey="dateStr"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                            dx={-10}
                          />
                          <RechartsTooltip
                            cursor={{ fill: '#F3F4F6' }}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                            labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <ReferenceLine y={0} stroke="#9CA3AF" />

                          <Bar dataKey="totalRevenue" name="Receita Total" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={40} />

                          {chartSource === 'meta' && (
                            <>
                              <Bar dataKey="metaRevenue" name="Receita Meta" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                              <Bar dataKey="metaCost" name="Custo Meta" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </>
                          )}

                          {chartSource === 'google' && (
                            <>
                              <Bar dataKey="googleRevenue" name="Receita Google" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                              <Bar dataKey="googleCost" name="Custo Google" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </>
                          )}

                          {chartSource === 'all' && (
                            <>
                              <Bar dataKey="totalCost" name="Custo Total" fill="#F87171" radius={[4, 4, 0, 0]} maxBarSize={40} />
                              <Bar dataKey="profit" name="Lucro" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </>
                          )}

                        </BarChart>
                      ) : (
                        <RechartsLineChart
                          data={dailyChartData}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis
                            dataKey="dateStr"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                            dx={-10}
                          />
                          <RechartsTooltip
                            cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '3 3' }}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                            labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <ReferenceLine y={0} stroke="#9CA3AF" />

                          <Line type="monotone" dataKey="totalRevenue" name="Receita Total" stroke="#34D399" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />

                          {chartSource === 'meta' && (
                            <>
                              <Line type="monotone" dataKey="metaRevenue" name="Receita Meta" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="metaCost" name="Custo Meta" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </>
                          )}

                          {chartSource === 'google' && (
                            <>
                              <Line type="monotone" dataKey="googleRevenue" name="Receita Google" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="googleCost" name="Custo Google" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </>
                          )}

                          {chartSource === 'all' && (
                            <>
                              <Line type="monotone" dataKey="totalCost" name="Custo Total" stroke="#F87171" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="profit" name="Lucro" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </>
                          )}

                        </RechartsLineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Main Charts Row */}
              {isWhatsapp && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Origins Pie Chart */}
                  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-neutral-800">
                        Origem dos Leads
                      </h3>
                      <p className="text-sm text-neutral-500">Distribuição entre Meta, Google e outras fontes</p>
                    </div>
                    <div className="h-[300px] w-full flex items-center justify-center">
                      {(() => {
                        const metaOrigin = computedTrafficMetrics.metaPurchases;
                        const googleOrigin = computedTrafficMetrics.googlePurchases;
                        const totalOrigin = totalLeads;
                        const otherOrigin = Math.max(0, totalOrigin - (metaOrigin + googleOrigin));

                        const pieData = [
                          { name: 'Meta Ads', value: metaOrigin, fill: '#3B82F6' },
                          { name: 'Google Ads', value: googleOrigin, fill: '#10B981' },
                          { name: 'Orgânico/Outros', value: otherOrigin, fill: '#9CA3AF' },
                        ].filter(item => item.value > 0);

                        if (pieData.length === 0) {
                          return <div className="text-neutral-400">Sem dados suficientes</div>;
                        }

                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              />
                              <RechartsTooltip
                                cursor={{ fill: '#F3F4F6' }}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => value}
                                labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                              />
                              <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Additional Placeholder for CPL / CPA over time*/}
                  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-neutral-800">
                        Custo por Lead Diário
                      </h3>
                      <p className="text-sm text-neutral-500">Evolução do custo de aquisição</p>
                    </div>

                    <div className="h-[300px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={dailyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <XAxis
                            dataKey="dateStr"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                            dx={-10}
                          />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <RechartsTooltip
                            cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '3 3' }}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                            labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                          <Line type="monotone" dataKey="totalCost" name="Custo Total" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>

                  </div>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="font-semibold text-neutral-800">
                      Insights Gerados por IA
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">
                    Em construção
                  </span>
                </div>
                <div className="p-6">
                  <ul className="space-y-4">
                    {mockMetrics.insights.map((insight: string, index: number) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-neutral-600"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                        <p className="leading-relaxed">{insight}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "funnel" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-800">
                    Funil de Vendas & Tráfego
                  </h2>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Google Sheets
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {dateRange === "Personalizado" && (
                    <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg p-1">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="bg-transparent text-sm text-neutral-700 px-2 py-1 focus:outline-none"
                      />
                      <span className="text-neutral-400 text-sm">até</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="bg-transparent text-sm text-neutral-700 px-2 py-1 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="appearance-none bg-neutral-50 border border-neutral-200 text-neutral-700 py-2 pl-10 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                    >
                      <option>Hoje</option>
                      <option>Ontem</option>
                      <option>Hoje e ontem</option>
                      <option>Últimos 7 dias</option>
                      <option>Últimos 14 dias</option>
                      <option>Últimos 28 dias</option>
                      <option>Últimos 30 dias</option>
                      <option>Esta semana</option>
                      <option>Semana passada</option>
                      <option>Este mês</option>
                      <option>Mês passado</option>
                      <option>Máximo</option>
                      <option>Personalizado</option>
                    </select>
                    <Calendar className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-center sm:justify-start">
                <div className="flex bg-neutral-100 p-1 rounded-lg">
                  {(['all', 'meta', 'google'] as const).map(source => (
                    <button
                      key={source}
                      onClick={() => setFunnelSource(source)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${funnelSource === source
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                      {source === 'all' ? 'Visão Geral (Todos)' : source === 'meta' ? 'Meta Ads' : 'Google Ads'}
                    </button>
                  ))}
                </div>
              </div>

              {isFetchingTraffic || isFetchingGoogleAds ? (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-16 flex flex-col items-center justify-center text-neutral-500">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                  <p>Calculando métricas do funil...</p>
                </div>
              ) : trafficError || googleAdsError ? (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4">
                    <X className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">Erro ao carregar dados de tráfego</h3>
                  <p className="text-neutral-500 max-w-md mx-auto mb-2">{trafficError}</p>
                  <p className="text-neutral-500 max-w-md mx-auto mb-6">{googleAdsError}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Visual Funnel */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                    <h3 className="font-semibold text-neutral-800 mb-6">Jornada do Cliente</h3>

                    <div className="space-y-4">
                      {(isItvManaus ? [
                        {
                          id: 'cliques',
                          label: 'Cliques no Link',
                          desc: 'Topo de Funil',
                          icon: <MousePointerClick className="w-5 h-5" />,
                          color: 'blue',
                          key: 'Cliques no Link'
                        },
                        {
                          id: 'views',
                          label: 'Visualizações de Página',
                          desc: 'Topo de Funil',
                          icon: <Users className="w-5 h-5" />,
                          color: 'indigo',
                          key: 'Visualizações de Página'
                        },
                        {
                          id: 'total_entrada',
                          label: 'Total de Entrada',
                          desc: 'Meio de Funil',
                          icon: <ShoppingCart className="w-5 h-5" />,
                          color: 'amber',
                          key: 'Total de Entrada',
                          valueOverwrite: computedMetrics.totalEntrada
                        },
                        {
                          id: 'servico_aprovado',
                          label: 'Serviço Aprovado',
                          desc: 'Fundo de Funil',
                          icon: <CheckCircle2 className="w-5 h-5" />,
                          color: 'emerald',
                          key: 'Serviço Aprovado',
                          valueOverwrite: computedMetrics.servicoAprovado
                        },
                        {
                          id: 'total_consertos',
                          label: 'Total de Consertos',
                          desc: 'Fundo de Funil',
                          icon: <Target className="w-5 h-5" />,
                          color: 'orange',
                          key: 'Total de Consertos',
                          valueOverwrite: computedMetrics.totalSaidas
                        }
                      ] : [
                        {
                          id: 'cliques',
                          label: 'Cliques no Link',
                          desc: 'Topo de Funil',
                          icon: <MousePointerClick className="w-5 h-5" />,
                          color: 'blue',
                          key: 'Cliques no Link'
                        },
                        {
                          id: 'views',
                          label: 'Visualizações de Página',
                          desc: 'Topo de Funil',
                          icon: <Users className="w-5 h-5" />,
                          color: 'indigo',
                          key: 'Visualizações de Página'
                        },
                        {
                          id: 'atc',
                          label: 'Adições ao Carrinho',
                          desc: 'Meio de Funil',
                          icon: <ShoppingCart className="w-5 h-5" />,
                          color: 'amber',
                          key: 'Adições no Carrinho'
                        },
                        {
                          id: 'checkout',
                          label: 'Checkout',
                          desc: 'Fundo de Funil',
                          icon: <CreditCard className="w-5 h-5" />,
                          color: 'orange',
                          key: 'Checkout'
                        },
                        {
                          id: 'purchases',
                          label: 'Compras Realizadas',
                          desc: 'Fundo de Funil',
                          icon: <Target className="w-5 h-5" />,
                          color: 'emerald',
                          key: 'Compras Meta'
                        }
                      ]).map((stage: any, index, array) => {
                        const currentFunnelData = funnelDataSources[funnelSource];
                        const value = stage.valueOverwrite !== undefined ? stage.valueOverwrite : (currentFunnelData[stage.key] || 0);
                        const nextStage = array[index + 1];
                        const nextValue = nextStage ? (nextStage.valueOverwrite !== undefined ? nextStage.valueOverwrite : (currentFunnelData[nextStage.key] || 0)) : null;
                        const conversionRate = nextValue !== null && value > 0 ? ((nextValue / value) * 100).toFixed(1) : "0.0";

                        const colorMap: Record<string, any> = {
                          blue: { bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100', text: 'text-blue-600', title: 'text-blue-900', val: 'text-blue-700' },
                          indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', iconBg: 'bg-indigo-100', text: 'text-indigo-600', title: 'text-indigo-900', val: 'text-indigo-700' },
                          amber: { bg: 'bg-amber-50', border: 'border-amber-100', iconBg: 'bg-amber-100', text: 'text-amber-600', title: 'text-amber-900', val: 'text-amber-700' },
                          orange: { bg: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100', text: 'text-orange-600', title: 'text-orange-900', val: 'text-orange-700' },
                          emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100', text: 'text-emerald-600', title: 'text-emerald-900', val: 'text-emerald-700' },
                        };

                        const colors = colorMap[stage.color];
                        const widthClass = index === 0 ? 'w-full' : index === 1 ? 'w-[95%]' : index === 2 ? 'w-[90%]' : index === 3 ? 'w-[85%]' : 'w-[80%]';

                        const getInvestmentForSource = () => {
                          if (funnelSource === 'meta') return computedTrafficMetrics.investimentoMeta;
                          if (funnelSource === 'google') return computedTrafficMetrics.investimentoGoogle;
                          return computedTrafficMetrics.investimentoTotal;
                        };

                        const costPerConversion = value > 0 ? getInvestmentForSource() / value : 0;

                        return (
                          <div key={stage.id} className="relative">
                            <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 flex items-center justify-between z-10 relative ${widthClass} mx-auto`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.text}`}>
                                  {stage.icon}
                                </div>
                                <div>
                                  <div className={`text-sm font-medium ${colors.title}`}>{stage.label}</div>
                                  <div className={`text-xs ${colors.text}/80`}>{stage.desc}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-2xl font-bold ${colors.val}`}>
                                  {value.toLocaleString('pt-BR')}
                                </div>
                                <div className={`text-xs font-medium ${colors.text}/70 mt-0.5`}>
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(costPerConversion)} / conv.
                                </div>
                              </div>
                            </div>

                            {nextStage && (
                              <div className="flex justify-center -my-2 relative z-0">
                                <div className="bg-white border border-neutral-200 rounded-full px-3 py-1 text-xs font-medium text-neutral-500 flex items-center gap-1 shadow-sm">
                                  <ArrowRight className="w-3 h-3 rotate-90" />
                                  {conversionRate}% conversão
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Meta vs Total Comparison */}
                  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col">
                    <h3 className="font-semibold text-neutral-800 mb-6">Origem das Compras</h3>

                    <div className="flex-1 flex flex-col justify-center gap-8">
                      {(() => {
                        const metaPurchases = computedTrafficMetrics.metaPurchases;
                        const googlePurchases = computedTrafficMetrics.googlePurchases;
                        const trackedPurchases = metaPurchases + googlePurchases;
                        const totalPurchases = computedMetrics.purchases; // From the first sheet

                        const metaPercentage = totalPurchases > 0 ? ((metaPurchases / totalPurchases) * 100).toFixed(1) : "0.0";
                        const googlePercentage = totalPurchases > 0 ? ((googlePurchases / totalPurchases) * 100).toFixed(1) : "0.0";
                        const otherPurchases = Math.max(0, totalPurchases - trackedPurchases);
                        const otherPercentage = totalPurchases > 0 ? ((otherPurchases / totalPurchases) * 100).toFixed(1) : "0.0";

                        return (
                          <>
                            <div className="text-center">
                              <div className="text-sm font-medium text-neutral-500 mb-1">Total de Compras (Geral)</div>
                              <div className="text-4xl font-bold text-neutral-900">{totalPurchases.toLocaleString('pt-BR')}</div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium text-indigo-700 flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    Meta Ads
                                  </span>
                                  <span className="font-bold text-indigo-700">{metaPurchases.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ({metaPercentage}%)</span>
                                </div>
                                <div className="w-full bg-neutral-100 rounded-full h-2.5">
                                  <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${metaPercentage}%` }}></div>
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium text-emerald-700 flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    Google Ads
                                  </span>
                                  <span className="font-bold text-emerald-700">{googlePurchases.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ({googlePercentage}%)</span>
                                </div>
                                <div className="w-full bg-neutral-100 rounded-full h-2.5">
                                  <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${googlePercentage}%` }}></div>
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium text-neutral-600 flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-neutral-300"></div>
                                    Outras Fontes (Orgânico, etc)
                                  </span>
                                  <span className="font-bold text-neutral-700">{otherPurchases.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ({otherPercentage}%)</span>
                                </div>
                                <div className="w-full bg-neutral-100 rounded-full h-2.5">
                                  <div className="bg-neutral-300 h-2.5 rounded-full" style={{ width: `${otherPercentage}%` }}></div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-neutral-100">
                              <p className="text-xs text-neutral-500 text-center">
                                Os dados do Meta e Google vêm da planilha de tráfego, enquanto o total vem da planilha de faturamento real.
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "revenue" && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-neutral-800">
                    Auditoria de Faturamento
                  </h2>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Google Sheets
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar transação..."
                    className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {isFetchingSheet ? (
                <div className="p-16 flex flex-col items-center justify-center text-neutral-500">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                  <p>Sincronizando com Google Sheets...</p>
                </div>
              ) : sheetError ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4">
                    <X className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">Erro ao carregar dados</h3>
                  <p className="text-neutral-500 max-w-md mx-auto mb-6">{sheetError}</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 text-left max-w-2xl mx-auto">
                    <strong>Como resolver:</strong>
                    <ol className="list-decimal ml-5 mt-2 space-y-1">
                      <li>Abra a planilha no Google Sheets.</li>
                      <li>Clique em "Compartilhar" no canto superior direito.</li>
                      <li>Em "Acesso geral", mude para <strong>"Qualquer pessoa com o link"</strong>.</li>
                      <li>Verifique se existe uma aba (página) com o nome exato: <strong>"{currentCompany?.name}"</strong>.</li>
                    </ol>
                  </div>
                </div>
              ) : sheetData.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-200">
                        <tr>
                          {sheetHeaders.map((header, i) => (
                            <th key={i} className="px-6 py-3 whitespace-nowrap">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {sheetData.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="hover:bg-neutral-50/50 transition-colors"
                          >
                            {sheetHeaders.map((header, colIndex) => {
                              const value = row[header];
                              const isStatus = header.toLowerCase().includes('status');

                              return (
                                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-neutral-600">
                                  {isStatus ? (
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value?.toLowerCase() === "aprovado" || value?.toLowerCase() === "pago"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : value?.toLowerCase() === "pendente"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-neutral-100 text-neutral-800"
                                        }`}
                                    >
                                      {value || '-'}
                                    </span>
                                  ) : (
                                    value || '-'
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between text-sm text-neutral-500">
                    <span>Mostrando {sheetData.length} resultados da planilha</span>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 border border-neutral-200 rounded hover:bg-neutral-100 disabled:opacity-50">
                        Anterior
                      </button>
                      <button className="px-3 py-1 border border-neutral-200 rounded hover:bg-neutral-100">
                        Próxima
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-neutral-500">
                  <p>A aba "{currentCompany?.name}" foi encontrada, mas está vazia.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "strategy" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Strategy Header */}
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <h2 className="text-lg font-semibold text-neutral-800">
                  Planejamento Estratégico
                </h2>
                <button
                  onClick={() =>
                    isEditingStrategy
                      ? handleSaveStrategy()
                      : setIsEditingStrategy(true)
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isEditingStrategy
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                    }`}
                >
                  {isEditingStrategy ? (
                    <>
                      <Save className="w-4 h-4" /> Salvar Alterações
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" /> Editar Estratégia
                    </>
                  )}
                </button>
              </div>

              {/* Budget & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Wallet className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-neutral-500 mb-1">
                      Verba Mensal
                    </h3>
                    {isEditingStrategy ? (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 font-medium">R$</span>
                        <input
                          type="text"
                          value={localStrategy.verbaMensal}
                          onChange={(e) =>
                            setLocalStrategy({
                              ...localStrategy,
                              verbaMensal: e.target.value,
                            })
                          }
                          className="text-2xl font-semibold text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <div className="text-2xl font-semibold text-neutral-900">
                        R$ {localStrategy.verbaMensal}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-neutral-500 mb-1">
                      Data de Recarga
                    </h3>
                    {isEditingStrategy ? (
                      <input
                        type="text"
                        value={localStrategy.dataRecarga}
                        onChange={(e) =>
                          setLocalStrategy({
                            ...localStrategy,
                            dataRecarga: e.target.value,
                          })
                        }
                        className="text-xl font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="text-xl font-medium text-neutral-900">
                        {localStrategy.dataRecarga}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StrategyCard
                  title="Personas Alvo"
                  icon={<Users className="w-5 h-5 text-blue-500" />}
                  items={localStrategy.personas}
                  isEditing={isEditingStrategy}
                  onChange={(newItems) =>
                    setLocalStrategy({ ...localStrategy, personas: newItems })
                  }
                />
                <StrategyCard
                  title="Vantagens Únicas (USPs)"
                  icon={<Award className="w-5 h-5 text-amber-500" />}
                  items={localStrategy.uniqueAdvantages}
                  isEditing={isEditingStrategy}
                  onChange={(newItems) =>
                    setLocalStrategy({
                      ...localStrategy,
                      uniqueAdvantages: newItems,
                    })
                  }
                />
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-neutral-800">
                    Resumo da Estratégia
                  </h3>
                </div>
                {isEditingStrategy ? (
                  <textarea
                    value={localStrategy.trafficStrategy}
                    onChange={(e) =>
                      setLocalStrategy({
                        ...localStrategy,
                        trafficStrategy: e.target.value,
                      })
                    }
                    className="w-full min-h-[100px] p-3 text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                ) : (
                  <p className="text-neutral-600 leading-relaxed">
                    {localStrategy.trafficStrategy}
                  </p>
                )}
              </div>

              {/* Visual Funnel Map */}
              {localStrategy.funnel && (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-semibold text-neutral-800">
                        Mapa do Funil de Tráfego
                      </h3>
                    </div>
                    {isEditingStrategy && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                        Modo de Edição
                      </span>
                    )}
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Captação Column */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-6">
                        <Users className="w-5 h-5 text-blue-500" />
                        <h4 className="font-medium text-neutral-900">
                          Captação (Públicos)
                        </h4>
                      </div>

                      <FunnelStage
                        label="Público Frio"
                        color="bg-blue-50 border-blue-200 text-blue-700 focus-within:ring-blue-500"
                        content={localStrategy.funnel.captacao.frio}
                        isEditing={isEditingStrategy}
                        onChange={(val) =>
                          setLocalStrategy({
                            ...localStrategy,
                            funnel: {
                              ...localStrategy.funnel,
                              captacao: {
                                ...localStrategy.funnel.captacao,
                                frio: val,
                              },
                            },
                          })
                        }
                      />
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-neutral-300 rotate-90 md:rotate-0" />
                      </div>
                      <FunnelStage
                        label="Público Morno"
                        color="bg-amber-50 border-amber-200 text-amber-700 focus-within:ring-amber-500"
                        content={localStrategy.funnel.captacao.morno}
                        isEditing={isEditingStrategy}
                        onChange={(val) =>
                          setLocalStrategy({
                            ...localStrategy,
                            funnel: {
                              ...localStrategy.funnel,
                              captacao: {
                                ...localStrategy.funnel.captacao,
                                morno: val,
                              },
                            },
                          })
                        }
                      />
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-neutral-300 rotate-90 md:rotate-0" />
                      </div>
                      <FunnelStage
                        label="Público Quente"
                        color="bg-red-50 border-red-200 text-red-700 focus-within:ring-red-500"
                        content={localStrategy.funnel.captacao.quente}
                        isEditing={isEditingStrategy}
                        onChange={(val) =>
                          setLocalStrategy({
                            ...localStrategy,
                            funnel: {
                              ...localStrategy.funnel,
                              captacao: {
                                ...localStrategy.funnel.captacao,
                                quente: val,
                              },
                            },
                          })
                        }
                      />
                    </div>

                    {/* Distribuição Column */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-6">
                        <Megaphone className="w-5 h-5 text-purple-500" />
                        <h4 className="font-medium text-neutral-900">
                          Distribuição (Mensagem)
                        </h4>
                      </div>

                      <FunnelStage
                        label="Topo de Funil"
                        color="bg-purple-50 border-purple-200 text-purple-700 focus-within:ring-purple-500"
                        content={localStrategy.funnel.distribuicao.topo}
                        isEditing={isEditingStrategy}
                        onChange={(val) =>
                          setLocalStrategy({
                            ...localStrategy,
                            funnel: {
                              ...localStrategy.funnel,
                              distribuicao: {
                                ...localStrategy.funnel.distribuicao,
                                topo: val,
                              },
                            },
                          })
                        }
                      />
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-neutral-300 rotate-90 md:rotate-0" />
                      </div>
                      <FunnelStage
                        label="Meio de Funil"
                        color="bg-indigo-50 border-indigo-200 text-indigo-700 focus-within:ring-indigo-500"
                        content={localStrategy.funnel.distribuicao.meio}
                        isEditing={isEditingStrategy}
                        onChange={(val) =>
                          setLocalStrategy({
                            ...localStrategy,
                            funnel: {
                              ...localStrategy.funnel,
                              distribuicao: {
                                ...localStrategy.funnel.distribuicao,
                                meio: val,
                              },
                            },
                          })
                        }
                      />
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-neutral-300 rotate-90 md:rotate-0" />
                      </div>
                      <FunnelStage
                        label="Fundo de Funil"
                        color="bg-emerald-50 border-emerald-200 text-emerald-700 focus-within:ring-emerald-500"
                        content={localStrategy.funnel.distribuicao.fundo}
                        isEditing={isEditingStrategy}
                        onChange={(val) =>
                          setLocalStrategy({
                            ...localStrategy,
                            funnel: {
                              ...localStrategy.funnel,
                              distribuicao: {
                                ...localStrategy.funnel.distribuicao,
                                fundo: val,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "account-health" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-neutral-800 mb-1">
                    Auditoria: Saúde da Conta
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Verifique se a configuração técnica da {currentCompany?.name} está de acordo com as melhores práticas.
                  </p>
                </div>
                <div className={`flex items-center gap-4 px-5 py-3 rounded-xl border ${overallHealthConfig.bg} ${overallHealthConfig.border}`}>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">Nota Geral</div>
                    <div className={`text-2xl font-bold ${overallHealthConfig.text}`}>{overallHealthScore.toFixed(1)} <span className="text-sm">/ 10</span></div>
                  </div>
                  <div className="relative w-14 h-14">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="28" cy="28" r="24" className="stroke-neutral-200" strokeWidth="6" fill="none" />
                      <circle cx="28" cy="28" r="24" className={`${overallHealthConfig.circle} transition-all duration-1000 ease-out`} strokeWidth="6" fill="none" strokeDasharray="150" strokeDashoffset={150 - (150 * overallHealthScore) / 10} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Activity className={`w-5 h-5 ${overallHealthConfig.text}`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Basic Configs */}
                <HealthCategoryCard
                  title="Configurações Básicas"
                  score={basicScore}
                  config={getHealthColorConfig(basicScore)}
                  items={[
                    { id: 'bmVerified', label: 'Business Manager Verificada' },
                    { id: 'paymentMethods', label: 'Métodos de Pagamento Secundários Ativos' },
                    { id: 'pagesConnected', label: 'Páginas do Facebook/IG Conectadas Corretamente' },
                    { id: 'spendingLimit', label: 'Limite de Gastos Configurado' },
                  ]}
                  state={accountHealth.basic}
                  onChange={(item, val) => handleHealthCheckChange('basic', item, val)}
                />

                {/* Campaign Structure */}
                <HealthCategoryCard
                  title="Estrutura de Campanhas"
                  score={campaignScore}
                  config={getHealthColorConfig(campaignScore)}
                  items={[
                    { id: 'naming', label: 'Nomenclatura Padrão Aplicada Sistematicamente' },
                    { id: 'audiences', label: 'Públicos Frios e Quentes Separados' },
                    { id: 'cboAbo', label: 'Estratégias de CBO/ABO aplicadas no Estágio Correto' },
                  ]}
                  state={accountHealth.campaign}
                  onChange={(item, val) => handleHealthCheckChange('campaign', item, val)}
                />

                {/* Tracking & API */}
                <HealthCategoryCard
                  title="Traqueamento e API"
                  score={trackingScore}
                  config={getHealthColorConfig(trackingScore)}
                  items={[
                    { id: 'pixel', label: 'Pixel Base Instalado' },
                    { id: 'capi', label: 'API de Conversões (CAPI) Configurada com Nota > 8' },
                    { id: 'events', label: 'Eventos Base (Page View, Lead, Purchase) Priorizados' },
                    { id: 'utm', label: 'UTMs Padronizadas em todos os Anúncios' },
                  ]}
                  state={accountHealth.tracking}
                  onChange={(item, val) => handleHealthCheckChange('tracking', item, val)}
                />
              </div>

              {/* Advanced Analytical Modules Divider */}
              <div className="pt-8 pb-4">
                <h2 className="text-xl font-bold text-neutral-800 mb-1">Módulos Analíticos Avançados</h2>
                <p className="text-sm text-neutral-500">Métricas operacionais de performance divididas por área de atuação. Edite os valores ou limiares (engrenagem) para personalizar a régua.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Modulo 1: CRO */}
                <AdHealthModule title="CRO e Experiência de Página" score={croScore} config={getHealthColorConfig(croScore)}>
                  {Object.entries((accountHealth.metrics as any).cro).map(([key, metric]: [string, any]) => (
                    <EditableMetricCard key={key} metric={metric} metricKey={key} moduleName="cro" getMetricHealthColor={getMetricHealthColor} onChange={handleMetricChange} />
                  ))}
                </AdHealthModule>

                {/* Modulo 2: Creative */}
                <AdHealthModule title="Saúde Criativa e Retenção" score={creativeScore} config={getHealthColorConfig(creativeScore)}>
                  {Object.entries((accountHealth.metrics as any).creative).map(([key, metric]: [string, any]) => (
                    <EditableMetricCard key={key} metric={metric} metricKey={key} moduleName="creative" getMetricHealthColor={getMetricHealthColor} onChange={handleMetricChange} />
                  ))}
                </AdHealthModule>

                {/* Modulo 3: Data */}
                <AdHealthModule title="Qualidade de Dados (CAPI)" score={dataScore} config={getHealthColorConfig(dataScore)}>
                  {Object.entries((accountHealth.metrics as any).data).map(([key, metric]: [string, any]) => (
                    <EditableMetricCard key={key} metric={metric} metricKey={key} moduleName="data" getMetricHealthColor={getMetricHealthColor} onChange={handleMetricChange} />
                  ))}
                </AdHealthModule>

                {/* Modulo 4: Finance */}
                <AdHealthModule title="Saúde Financeira e Escala" score={financeScore} config={getHealthColorConfig(financeScore)}>
                  {Object.entries((accountHealth.metrics as any).finance).map(([key, metric]: [string, any]) => (
                    <EditableMetricCard key={key} metric={metric} metricKey={key} moduleName="finance" getMetricHealthColor={getMetricHealthColor} onChange={handleMetricChange} />
                  ))}
                </AdHealthModule>
              </div>

              {isSavingHealth && (
                <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-5">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Sincronizando...
                </div>
              )}
            </div>
          )}

          {activeTab === "simulations" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-neutral-800 mb-1 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Laboratório de Metas 🚀
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Ajuste os controles abaixo para projetar cenários dinamicamente.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                  <span className="text-sm font-medium text-neutral-500 pl-2">Mês Base:</span>
                  <input
                    type="month"
                    value={simulationTabMonth}
                    onChange={(e) => setSimulationTabMonth(e.target.value)}
                    className="bg-white border border-neutral-200 text-neutral-700 py-1.5 px-3 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                  <button
                    onClick={() => {
                      if (simBaseMetrics) {
                        setSimInvestment(simBaseMetrics.metaInv || 0);
                        setSimTicket(simBaseMetrics.baseMetaTicket || 0);
                        setSimCpc(simBaseMetrics.baseMetaCpc || 0);
                        setSimViewRate(simBaseMetrics.baseMetaViewRate || 0);
                        setSimCartRate(simBaseMetrics.baseMetaCartRate || 0);
                        setSimCheckoutRate(simBaseMetrics.baseMetaCheckoutRate || 0);
                        setSimPurcRate(simBaseMetrics.baseMetaPurcRate || 0);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                    title="Puxar dados do mês base (Apenas Meta Ads)"
                  >
                    <Download className="w-4 h-4" />
                    Puxar Base
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Controles Column */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
                    <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                      <Settings className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-semibold text-neutral-800">Mesa de Controle</h3>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Orçamento (Investimento)</label>
                          <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simInvestment)}</span>
                        </div>
                        <input type="range" min="100" max="50000" step="100" value={simInvestment} onChange={(e) => setSimInvestment(Number(e.target.value))} className="w-full transition-all accent-indigo-600" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Custo por Visita (CPC)</label>
                          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simCpc)}</span>
                        </div>
                        <input type="range" min="0.05" max="10" step="0.05" value={simCpc} onChange={(e) => setSimCpc(Number(e.target.value))} className="w-full transition-all accent-blue-600" />
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Taxa de Carregamento (Link {'->'} Site)</label>
                          <span className="text-sm font-bold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-md">{simViewRate.toFixed(1)}%</span>
                        </div>
                        <input type="range" min="10" max="100" step="1" value={simViewRate} onChange={(e) => setSimViewRate(Number(e.target.value))} className="w-full transition-all accent-neutral-600" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Taxa de Adição ao Carrinho</label>
                          <span className="text-sm font-bold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-md">{simCartRate.toFixed(1)}%</span>
                        </div>
                        <input type="range" min="1" max="100" step="1" value={simCartRate} onChange={(e) => setSimCartRate(Number(e.target.value))} className="w-full transition-all accent-neutral-600" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Taxa de Início de Checkout</label>
                          <span className="text-sm font-bold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-md">{simCheckoutRate.toFixed(1)}%</span>
                        </div>
                        <input type="range" min="1" max="100" step="1" value={simCheckoutRate} onChange={(e) => setSimCheckoutRate(Number(e.target.value))} className="w-full transition-all accent-neutral-600" />
                      </div>

                      <div className="space-y-3 border-b border-neutral-100 pb-4">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Taxa de Conversão Final (Compra)</label>
                          <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{simPurcRate.toFixed(1)}%</span>
                        </div>
                        <input type="range" min="1" max="100" step="1" value={simPurcRate} onChange={(e) => setSimPurcRate(Number(e.target.value))} className="w-full transition-all accent-emerald-600" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-neutral-700">Ticket Médio (Preço Médio)</label>
                          <span className="text-sm font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simTicket)}</span>
                        </div>
                        <input type="range" min="10" max="5000" step="10" value={simTicket} onChange={(e) => setSimTicket(Number(e.target.value))} className="w-full transition-all accent-purple-600" />
                      </div>
                    </div>

                    <div className="mt-2 bg-neutral-800 text-white shadow-inner rounded-xl p-5 border border-neutral-700 flex flex-col gap-3">
                      <h4 className="text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1">Volumes Esperados na Cascata</h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-300">Cliques no Link:</span>
                        <span className="font-semibold text-white">{Math.round(simulatedClicks).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-300">Views de Página:</span>
                        <span className="font-semibold text-white">{Math.round(simulatedViews).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-300">Carrinhos (AddToCart):</span>
                        <span className="font-semibold text-white">{Math.round(simulatedCarts).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-300">Checkouts Iniciados:</span>
                        <span className="font-semibold text-white">{Math.round(simulatedCheckouts).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-neutral-600">
                        <span className="text-neutral-300">Compras Fechadas:</span>
                        <span className="font-bold text-emerald-400">{Math.round(simulatedPurchases).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-neutral-300">CPA (Custo por Compra):</span>
                        <span className="font-bold text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simulatedCpa)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Futuro Visual Column */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl shadow-md text-white flex flex-col min-w-0">
                      <span className="text-indigo-100 text-sm font-medium mb-1 truncate" title="Faturamento Presumido">Faturamento Presumido</span>
                      <span className="text-2xl 2xl:text-3xl font-black tracking-tight truncate block w-full" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simulatedRevenue)}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simulatedRevenue)}
                      </span>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-md text-white flex flex-col">
                      <span className="text-emerald-100 text-sm font-medium mb-1">Vendas Concluídas</span>
                      <span className="text-3xl font-black tracking-tight">{Math.round(simulatedPurchases).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 rounded-2xl shadow-md text-white flex flex-col">
                      <span className="text-orange-100 text-sm font-medium mb-1">ROI Garantido</span>
                      <span className="text-3xl font-black tracking-tight">{simulatedRoi.toFixed(2)}x</span>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm relative overflow-hidden">
                    <h3 className="font-semibold text-neutral-800 mb-8 z-10 relative flex justify-between items-center">
                      Comparação: Mês Base vs Simulação
                      {simBaseMetrics && (
                        <span className="text-xs font-normal text-neutral-400 bg-neutral-100 px-2 py-1 rounded">
                          Referência: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simBaseMetrics.revenue)} Fat. / {simBaseMetrics.roi.toFixed(2)}x ROI
                        </span>
                      )}
                    </h3>

                    {/* Chart Playground */}
                    <div className="h-64 flex items-end justify-center gap-12 mt-4 px-4 relative z-10 w-full mx-auto max-w-2xl border-b-2 border-dashed border-neutral-200 pb-2">
                      {/* Context: Find the max bar value for height scaling */}
                      {(() => {
                        const maxRev = Math.max((simBaseMetrics?.revenue || 0), simulatedGlobalRevenue, 1);
                        const revBaseHeight = simBaseMetrics ? (simBaseMetrics.revenue / maxRev) * 100 : 0;
                        const revSimHeight = (simulatedGlobalRevenue / maxRev) * 100;

                        const maxRoi = Math.max((simBaseMetrics?.roi || 0), simulatedRoi, 1);
                        const roiBaseHeight = simBaseMetrics ? (simBaseMetrics.roi / maxRoi) * 100 : 0;
                        const roiSimHeight = (simulatedRoi / maxRoi) * 100;

                        return (
                          <>
                            {/* Group 1: Revenue */}
                            <div className="flex flex-col items-center gap-2 group w-24">
                              <div className="w-full flex items-end justify-between gap-1 h-48 relative">
                                <div className="w-1/2 bg-neutral-200 rounded-t-md relative transition-all duration-700 ease-out flex flex-col justify-end" style={{ height: `${revBaseHeight}%` }}>
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{simBaseMetrics ? new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(simBaseMetrics.revenue) : '0'}</span>
                                </div>
                                <div className="w-1/2 bg-indigo-500 rounded-t-md relative transition-all duration-700 ease-out shadow-lg flex flex-col justify-end" style={{ height: `${revSimHeight}%` }}>
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-indigo-600 whitespace-nowrap">{new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(simulatedGlobalRevenue)}</span>
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-neutral-500">Faturamento</span>
                            </div>

                            {/* Group 2: ROI */}
                            <div className="flex flex-col items-center gap-2 group w-24">
                              <div className="w-full flex items-end justify-between gap-1 h-48 relative">
                                <div className="w-1/2 bg-neutral-200 rounded-t-md relative transition-all duration-700 ease-out flex flex-col justify-end" style={{ height: `${roiBaseHeight}%` }}>
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{simBaseMetrics ? simBaseMetrics.roi.toFixed(1) + 'x' : '0x'}</span>
                                </div>
                                <div className="w-1/2 bg-amber-500 rounded-t-md relative transition-all duration-700 ease-out shadow-lg flex flex-col justify-end" style={{ height: `${roiSimHeight}%` }}>
                                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-600 whitespace-nowrap">{simulatedRoi.toFixed(1)}x</span>
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-neutral-500">ROI Geral</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    {/* Background Decorative */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-50 rounded-full blur-3xl opacity-50 z-0"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "monthly" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <h2 className="text-lg font-semibold text-neutral-800">
                  Resumo Mensal
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleRefresh} className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-600 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${isFetchingSheet || isFetchingTraffic || isFetchingGoogleAds ? 'animate-spin' : ''}`} />
                  </button>
                  <input
                    type="month"
                    value={monthlyTabMonth}
                    onChange={(e) => setMonthlyTabMonth(e.target.value)}
                    className="bg-neutral-50 border border-neutral-200 text-neutral-700 py-2 px-3 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {monthlyMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-neutral-500">Faturamento</h3>
                      <div className="p-2 bg-neutral-50 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                    <div className="mt-auto">
                      <div className="text-2xl font-semibold text-neutral-900 mb-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyMetrics.month.revenue)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-neutral-500">Investimento</h3>
                      <div className="p-2 bg-neutral-50 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-600" /></div>
                    </div>
                    <div className="mt-auto">
                      <div className="text-2xl font-semibold text-neutral-900 mb-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyMetrics.month.totalInv)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-neutral-500">Compras</h3>
                      <div className="p-2 bg-neutral-50 rounded-lg"><ShoppingCart className="w-5 h-5 text-blue-600" /></div>
                    </div>
                    <div className="mt-auto">
                      <div className="text-2xl font-semibold text-neutral-900 mb-1">
                        {monthlyMetrics.month.purchases.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-neutral-500">ROI</h3>
                      <div className="p-2 bg-neutral-50 rounded-lg"><BarChart3 className="w-5 h-5 text-purple-600" /></div>
                    </div>
                    <div className="mt-auto">
                      <div className="text-2xl font-semibold text-neutral-900 mb-1">
                        {monthlyMetrics.month.roi.toFixed(2)}x
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {monthlyMetrics && monthlyMetrics.weeks.length > 0 && (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mt-8">
                  <h3 className="font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    Comparativo Semanal
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {monthlyMetrics.weeks.map((week) => {
                      const isExpanded = expandedWeekIds.includes(week.id);
                      return (
                        <div key={week.id} className={`border ${isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50/50 block-expanded z-10 scale-[1.01]' : 'border-neutral-100 shadow-sm'} bg-white rounded-xl p-5 transition-all duration-300 relative`}>
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200/60 cursor-pointer group" onClick={() => {
                            setExpandedWeekIds(prev =>
                              prev.includes(week.id)
                                ? prev.filter(id => id !== week.id)
                                : [...prev, week.id]
                            );
                          }}>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-neutral-800 flex items-center gap-1.5 transition-colors group-hover:text-indigo-600">
                                {week.label}
                                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                              </h4>
                            </div>
                            <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded shadow-inner">
                              {week.dateLabel}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-neutral-500">Faturamento</span>
                              <div className="flex items-center gap-2">
                                <VariationBadge current={week.metrics.revenue} previous={week.prevMetrics.revenue} />
                                <span className="font-semibold text-neutral-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(week.metrics.revenue)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-neutral-500">Investimento</span>
                              <div className="flex items-center gap-2">
                                <VariationBadge current={week.metrics.totalInv} previous={week.prevMetrics.totalInv} neutral />
                                <span className="font-semibold text-indigo-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(week.metrics.totalInv)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-neutral-500">Compras</span>
                              <div className="flex items-center gap-2">
                                <VariationBadge current={week.metrics.purchases} previous={week.prevMetrics.purchases} />
                                <span className="font-semibold text-blue-700">{week.metrics.purchases}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-neutral-200/60">
                              <span className="font-medium text-neutral-600">ROI da Semana</span>
                              <div className="flex items-center gap-2">
                                <VariationBadge current={week.metrics.roi} previous={week.prevMetrics.roi} />
                                <span className={`font-bold ${week.metrics.roi >= 2 ? 'text-emerald-600' : week.metrics.roi >= 1 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {week.metrics.roi.toFixed(2)}x
                                </span>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-indigo-100 flex gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              {/* Meta Ads Column */}
                              <div className="flex-1 bg-blue-50/50 border border-blue-100/50 rounded-lg p-3">
                                <h5 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Activity className="w-3 h-3" /> Meta Ads</h5>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[13px]">
                                    <span className="text-blue-600/70">Fat.</span>
                                    <span className="font-semibold text-blue-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(week.metrics.metaRevenue)}</span>
                                  </div>
                                  <div className="flex justify-between text-[13px]">
                                    <span className="text-blue-600/70">Inv.</span>
                                    <span className="font-semibold text-blue-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(week.metrics.invMeta)}</span>
                                  </div>
                                  <div className="flex justify-between text-[13px]">
                                    <span className="text-blue-600/70">Compras</span>
                                    <span className="font-semibold text-blue-900 truncate max-w-[80px] text-right" title={String(week.metrics.metaPurchases)}>{Math.round(week.metrics.metaPurchases || 0)}</span>
                                  </div>
                                  <div className="flex justify-between text-[13px] pt-1 border-t border-blue-100">
                                    <span className="font-medium text-blue-800">ROI</span>
                                    <span className="font-bold text-blue-700">{week.metrics.metaRoi.toFixed(2)}x</span>
                                  </div>
                                </div>
                              </div>

                              {/* Google Ads Column */}
                              <div className="flex-1 bg-rose-50/50 border border-rose-100/50 rounded-lg p-3">
                                <h5 className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search className="w-3 h-3" /> Google Ads</h5>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[13px]">
                                    <span className="text-rose-600/70">Fat.</span>
                                    <span className="font-semibold text-rose-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(week.metrics.googleRevenue)}</span>
                                  </div>
                                  <div className="flex justify-between text-[13px]">
                                    <span className="text-rose-600/70">Inv.</span>
                                    <span className="font-semibold text-rose-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(week.metrics.invGoogle)}</span>
                                  </div>
                                  <div className="flex justify-between text-[13px]">
                                    <span className="text-rose-600/70">Compras</span>
                                    <span className="font-semibold text-rose-900 truncate max-w-[80px] text-right" title={String(week.metrics.googlePurchases)}>{Math.round(week.metrics.googlePurchases || 0)}</span>
                                  </div>
                                  <div className="flex justify-between text-[13px] pt-1 border-t border-rose-100">
                                    <span className="font-medium text-rose-800">ROI</span>
                                    <span className="font-bold text-rose-700">{week.metrics.googleRoi.toFixed(2)}x</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function HealthCategoryCard({ title, score, config, items, state, onChange }: {
  title: string,
  score: number,
  config: any,
  items: { id: string, label: string }[],
  state: Record<string, boolean>,
  onChange: (id: string, val: boolean) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden">
      <div className={`p-5 min-h-[140px] flex flex-col justify-between ${config.bg} border-b ${config.border} transition-colors duration-500`}>
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-neutral-800 leading-tight">{title}</h3>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-white shadow-sm ${config.text}`}>
            {config.label}
          </span>
        </div>
        <div className="mt-4">
          <div className="flex items-end justify-between mb-2">
            <span className={`text-3xl font-black ${config.text}`}>{score.toFixed(1)}</span>
            <span className="text-xs font-semibold text-neutral-500 uppercase">Score Calculado</span>
          </div>
          <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
            <div className={`h-full ${config.bar} transition-all duration-500 ease-out`} style={{ width: `${score * 10}%` }} />
          </div>
        </div>
      </div>
      <div className="p-5 flex-1 bg-white">
        <ul className="space-y-3.5">
          {items.map(item => (
            <li key={item.id} className="flex items-start gap-3 group">
              <button
                onClick={() => onChange(item.id, !state[item.id])}
                className="mt-0.5 shrink-0 transition-transform active:scale-95 focus:outline-none"
              >
                {state[item.id] ? (
                  <CheckCircle2 className={`w-5 h-5 ${config.text}`} />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-neutral-300 group-hover:border-neutral-400 transition-colors" />
                )}
              </button>
              <span
                className={`text-sm leading-tight mt-0.5 cursor-pointer select-none transition-colors ${state[item.id] ? 'text-neutral-900 font-medium' : 'text-neutral-500 hover:text-neutral-700'}`}
                onClick={() => onChange(item.id, !state[item.id])}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdHealthModule({ title, score, config, children }: { title: string, score: number, config: any, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden">
      <div className={`p-5 min-h-[140px] flex flex-col justify-between ${config.bg} border-b ${config.border} transition-colors duration-500`}>
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-neutral-800 leading-tight">{title}</h3>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-white shadow-sm ${config.text}`}>
            {config.label}
          </span>
        </div>
        <div className="mt-4">
          <div className="flex items-end justify-between mb-2">
            <span className={`text-3xl font-black ${config.text}`}>{score.toFixed(1)}</span>
            <span className="text-xs font-semibold text-neutral-500 uppercase">Média do Módulo</span>
          </div>
          <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
            <div className={`h-full ${config.bar} transition-all duration-500 ease-out`} style={{ width: `${score * 10}%` }} />
          </div>
        </div>
      </div>
      <div className="p-5 flex-1 bg-white space-y-4">
        {children}
      </div>
    </div>
  );
}

function EditableMetricCard({ metric, metricKey, moduleName, getMetricHealthColor, onChange }: {
  key?: React.Key, metric: any, metricKey: string, moduleName: string, getMetricHealthColor: (m: any) => string, onChange: (mod: string, key: string, field: 'value' | 'good' | 'excellent', val: string) => void
}) {
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);

  // Local state for immediate typing before onBlur save
  const [localVal, setLocalVal] = useState(metric.value.toString());
  const [localGood, setLocalGood] = useState(metric.good.toString());
  const [localExc, setLocalExc] = useState(metric.excellent.toString());

  // Keep local state in sync if prop changes from elsewhere
  useEffect(() => { setLocalVal(metric.value.toString()); }, [metric.value]);
  useEffect(() => { setLocalGood(metric.good.toString()); }, [metric.good]);
  useEffect(() => { setLocalExc(metric.excellent.toString()); }, [metric.excellent]);

  const valueColorClass = getMetricHealthColor(metric);

  const handleSaveValue = () => {
    setIsEditingValue(false);
    if (localVal !== metric.value.toString()) {
      onChange(moduleName, metricKey, 'value', localVal);
    }
  };

  const handleSaveThresholds = () => {
    setIsEditingThresholds(false);
    if (localGood !== metric.good.toString()) onChange(moduleName, metricKey, 'good', localGood);
    if (localExc !== metric.excellent.toString()) onChange(moduleName, metricKey, 'excellent', localExc);
  };

  return (
    <div className="flex flex-col p-3 rounded-xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-50/80 transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-neutral-700">{metric.label}</span>
          <div className="relative flex items-center justify-center">
            <Info className="w-4 h-4 text-neutral-400 peer hover:text-indigo-500 transition-colors cursor-help" />
            <div className="invisible peer-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-xl z-20 font-medium leading-relaxed">
              {metric.desc}
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsEditingThresholds(!isEditingThresholds)}
          className="p-1 rounded-md text-neutral-400 hover:text-indigo-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
          title="Editar Limiares"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {isEditingValue ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                step="0.1"
                className="w-16 text-xl font-bold bg-white border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 px-1"
                value={localVal}
                onChange={e => setLocalVal(e.target.value)}
                onBlur={handleSaveValue}
                onKeyDown={e => e.key === 'Enter' && handleSaveValue()}
              />
              <span className="text-neutral-500 font-medium">{metric.unit}</span>
            </div>
          ) : (
            <div
              className={`text-2xl font-black cursor-pointer hover:opacity-80 transition-opacity ${valueColorClass}`}
              onClick={() => setIsEditingValue(true)}
              title="Clique para editar"
            >
              {metric.value}{metric.unit}
            </div>
          )}
        </div>

        {/* Threshold indicators */}
        <div className="flex flex-col items-end gap-1 relative z-10">
          {isEditingThresholds ? (
            <div className="flex gap-2">
              <div className="flex flex-col text-[10px] items-end">
                <span className="font-semibold text-emerald-600 uppercase">Exc</span>
                <input type="number" step="0.1" className="w-10 p-0.5 text-center bg-white border border-neutral-300 rounded font-bold" value={localExc} onChange={e => setLocalExc(e.target.value)} onBlur={handleSaveThresholds} onKeyDown={e => e.key === 'Enter' && handleSaveThresholds()} />
              </div>
              <div className="flex flex-col text-[10px] items-end">
                <span className="font-semibold text-amber-500 uppercase">Bom</span>
                <input type="number" step="0.1" className="w-10 p-0.5 text-center bg-white border border-neutral-300 rounded font-bold" value={localGood} onChange={e => setLocalGood(e.target.value)} onBlur={handleSaveThresholds} onKeyDown={e => e.key === 'Enter' && handleSaveThresholds()} />
              </div>
            </div>
          ) : (
            <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex flex-col items-end text-neutral-400">
                <span className="text-emerald-500">Exc</span>
                {metric.inverse ? '>' : '<'} {metric.excellent}{metric.unit}
              </div>
              <div className="flex flex-col items-end text-neutral-400">
                <span className="text-amber-500">Bom</span>
                {metric.inverse ? '>' : '<'} {metric.good}{metric.unit}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  currentAmount,
  previousAmount,
  isCurrency = false,
  icon,
  inverseChange = false,
  subtitle,
}: {
  title: string;
  value: string;
  currentAmount: number;
  previousAmount: number;
  isCurrency?: boolean;
  icon: React.ReactNode;
  inverseChange?: boolean;
  subtitle?: React.ReactNode;
}) {
  let percentChange = 0;
  if (previousAmount > 0) {
    percentChange = ((currentAmount - previousAmount) / previousAmount) * 100;
  } else if (currentAmount > 0) {
    percentChange = 100;
  }

  const isPositive = percentChange >= 0;
  const isGood = inverseChange ? !isPositive : isPositive;
  const formattedPercent = Math.abs(percentChange).toFixed(1) + "%";

  const formatAmount = (amt: number) => {
    if (isCurrency) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amt);
    return amt % 1 !== 0 ? amt.toFixed(2) : amt.toString();
  };

  const tooltipText = `Anterior: ${formatAmount(previousAmount)} | Atual: ${formatAmount(currentAmount)}`;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-500">{title}</h3>
        <div className="p-2 bg-neutral-50 rounded-lg">{icon}</div>
      </div>
      <div className="mt-auto">
        <div className="text-2xl font-semibold text-neutral-900 mb-1">
          {value}
        </div>
        <div
          title={tooltipText}
          className={`text-sm font-medium flex items-center gap-1 w-max cursor-help border-b border-transparent hover:border-current transition-colors ${isGood ? "text-emerald-600" : "text-red-600"}`}
        >
          {isPositive ? "↑" : "↓"} {formattedPercent}
          <span className="text-neutral-400 font-normal ml-1">
            vs período anterior
          </span>
        </div>
        {subtitle && <div className="mt-3">{subtitle}</div>}
      </div>
    </div>
  );
}

function StrategyCard({
  title,
  icon,
  items,
  isEditing,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  isEditing?: boolean;
  onChange?: (items: string[]) => void;
}) {
  const handleItemChange = (index: number, value: string) => {
    if (!onChange) return;
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  const handleAddItem = () => {
    if (!onChange) return;
    onChange([...items, ""]);
  };

  const handleRemoveItem = (index: number) => {
    if (!onChange) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        {icon}
        <h3 className="font-semibold text-neutral-800">{title}</h3>
      </div>
      <ul className="space-y-3 flex-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-xs font-medium text-neutral-500 mt-0.5">
              {index + 1}
            </div>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  className="flex-1 text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="text-neutral-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-neutral-600 pt-0.5 text-sm">{item}</span>
            )}
          </li>
        ))}
      </ul>
      {isEditing && (
        <button
          onClick={handleAddItem}
          className="mt-4 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <Plus className="w-4 h-4" /> Adicionar item
        </button>
      )}
    </div>
  );
}

function FunnelStage({
  label,
  color,
  content,
  isEditing,
  onChange,
}: {
  label: string;
  color: string;
  content: string;
  isEditing?: boolean;
  onChange?: (val: string) => void;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${color} relative transition-all ${isEditing ? "ring-2 ring-offset-2 ring-transparent" : ""}`}
    >
      <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-80">
        {label}
      </div>
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full min-h-[80px] text-sm font-medium bg-white/50 border border-black/10 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-current resize-y"
          placeholder={`Descreva a estratégia para ${label.toLowerCase()}...`}
        />
      ) : (
        <div className="text-sm font-medium whitespace-pre-line">{content}</div>
      )}
    </div>
  );
}
