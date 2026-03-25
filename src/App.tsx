import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  Receipt,
  Lightbulb,
  Filter,
  Activity,
  CalendarDays,
  Settings,
  LogOut,
} from "lucide-react";

import {
  companies,
  performanceMetrics,
  strategyConfig,
} from "./data/mockData";
import { supabase } from "./lib/supabase";
import { AdminPanel } from "./components/AdminPanel";
import { OverviewTab } from "./components/Dashboard/tabs/OverviewTab";
import { MonthlyTab } from "./components/Dashboard/tabs/MonthlyTab";
import { FunnelTab } from "./components/Dashboard/tabs/FunnelTab";
import { AccountHealthTab } from "./components/Dashboard/tabs/AccountHealthTab";
import { RevenueTab } from "./components/Dashboard/tabs/RevenueTab";
import { StrategyTab } from "./components/Dashboard/tabs/StrategyTab";
import { SimulationsTab } from "./components/Dashboard/tabs/SimulationsTab";

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
  const [simCpc, setSimCpc] = useState(0.85);
  const [simViewRate, setSimViewRate] = useState(70);
  const [simCartRate, setSimCartRate] = useState(15);
  const [simCheckoutRate, setSimCheckoutRate] = useState(40);
  const [simPurcRate, setSimPurcRate] = useState(30);
  const [simTicket, setSimTicket] = useState(120);

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
    servicos: { revenue: { date: ["Data", ""], payment: ["Faturamento Diário"], quantity: ["Serviço aprovado"] }, traffic: { date: ["Data", ""], investment: ["Investimento"], revenue: [], purchases: [], clicks: ["Cliques"], pageViews: [], cartAdditions: ["Mensagens"] }, googleAds: { date: ["Data", ""], investment: ["Investimento"], revenue: ["Faturamento Google Ads"], conversions: ["Conversões"], clicks: ["Cliques no Link"], cartAdditions: [] } },
    "itv-manaus": { revenue: { date: ["Data", ""], payment: ["Faturamento Diário"], quantity: ["Serviço aprovado"] }, traffic: { date: ["Data", ""], investment: ["Gasto da conta", "Gasto", "Gastos", "Investimento"], revenue: [], purchases: [], clicks: ["Cliques"], pageViews: [], cartAdditions: ["Mensagens"] }, googleAds: { date: ["Data", ""], investment: ["Custo", "Gasto", "Gastos", "Investimento"], revenue: ["Faturamento Google Ads"], conversions: ["Conversões"], clicks: ["Cliques no Link"], cartAdditions: [] } }
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
    const customSpreadsheetId = currentCompanyObj?.spreadsheet_id || (currentCompanyObj as any)?.spreadsheetId;
    const ordersSpreadsheetId = currentCompanyObj?.orders_spreadsheet_id || (currentCompanyObj as any)?.ordersSpreadsheetId;
    const customSheetTab = currentCompanyObj?.sheet_tab || (currentCompanyObj as any)?.sheetTab || tabName;
    const customTrafficTab = currentCompanyObj?.traffic_tab || (currentCompanyObj as any)?.trafficTab || tabName;
    const customGoogleAdsTab = currentCompanyObj?.google_ads_tab || (currentCompanyObj as any)?.googleAdsTab || `${tabName} - Google Ads`;
    const sheetRange = (currentCompanyObj as any)?.sheetRange;
    const rangeParams = sheetRange ? `&range=${sheetRange}` : "";

    // Fetch Revenue Sheet
    // Se há uma planilha de pedidos configurada, usa ela (estrutura fixa: A=Data, B=Qtd Pedidos, C=Pedidos Pagos, D=Pedidos não pagos)
    const url = hasSheetGid
      ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${(currentCompanyObj as any).sheetGid}${rangeParams}`
      : ordersSpreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${ordersSpreadsheetId}/gviz/tq?tqx=out:csv${rangeParams}`
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
            if (results.meta.fields) {
              setSheetHeaders(results.meta.fields);
            }
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

    if (isNaN(numValue) || isNaN(numGood) || isNaN(numExcellent)) return 0;

    if (inverse) {
      if (numValue >= numExcellent) return 10;
      if (numValue < numGood) return 0;
      const range = numExcellent - numGood;
      const position = numValue - numGood;
      return 5 + (position / range) * 5;
    } else {
      if (numValue <= numExcellent) return 10;
      if (numValue > numGood) return 0;
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

    if (dateRange === "Hoje") return normalizedRowDate.getTime() === today.getTime();
    if (dateRange === "Ontem") { const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); return normalizedRowDate.getTime() === yesterday.getTime(); }
    if (dateRange === "Hoje e ontem") { const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); return normalizedRowDate >= yesterday && normalizedRowDate <= today; }
    if (dateRange === "Últimos 7 dias") { const d = new Date(today); d.setDate(today.getDate() - 6); return normalizedRowDate >= d && normalizedRowDate <= today; }
    if (dateRange === "Últimos 14 dias") { const d = new Date(today); d.setDate(today.getDate() - 13); return normalizedRowDate >= d && normalizedRowDate <= today; }
    if (dateRange === "Últimos 28 dias") { const d = new Date(today); d.setDate(today.getDate() - 27); return normalizedRowDate >= d && normalizedRowDate <= today; }
    if (dateRange === "Últimos 30 dias") { const d = new Date(today); d.setDate(today.getDate() - 29); return normalizedRowDate >= d && normalizedRowDate <= today; }
    if (dateRange === "Esta semana") { const firstDayOfWeek = new Date(today); const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1); firstDayOfWeek.setDate(diff); return normalizedRowDate >= firstDayOfWeek && normalizedRowDate <= today; }
    if (dateRange === "Semana passada") { const firstDayOfLastWeek = new Date(today); const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7; firstDayOfLastWeek.setDate(diff); const lastDayOfLastWeek = new Date(firstDayOfLastWeek); lastDayOfLastWeek.setDate(firstDayOfLastWeek.getDate() + 6); return normalizedRowDate >= firstDayOfLastWeek && normalizedRowDate <= lastDayOfLastWeek; }
    if (dateRange === "Este mês") return normalizedRowDate.getMonth() === today.getMonth() && normalizedRowDate.getFullYear() === today.getFullYear();
    if (dateRange === "Mês passado") { const lastMonth = new Date(today); lastMonth.setMonth(today.getMonth() - 1); return normalizedRowDate.getMonth() === lastMonth.getMonth() && normalizedRowDate.getFullYear() === lastMonth.getFullYear(); }
    if (dateRange === "Máximo") return true;
    if (dateRange === "Personalizado") { if (!customStartDate || !customEndDate) return true; const start = new Date(customStartDate + 'T00:00:00'); const end = new Date(customEndDate + 'T00:00:00'); start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); return normalizedRowDate >= start && normalizedRowDate <= end; }
    return true;
  };

  // Check if a date is within the *previous* equivalent range
  const isDateInPreviousRange = (rowDate: Date | null) => {
    if (!rowDate) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedRowDate = new Date(rowDate);
    normalizedRowDate.setHours(0, 0, 0, 0);

    if (dateRange === "Hoje") { const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); return normalizedRowDate.getTime() === yesterday.getTime(); }
    if (dateRange === "Ontem") { const d2 = new Date(today); d2.setDate(today.getDate() - 2); return normalizedRowDate.getTime() === d2.getTime(); }
    if (dateRange === "Hoje e ontem") { const d3 = new Date(today); d3.setDate(today.getDate() - 3); const d2 = new Date(today); d2.setDate(today.getDate() - 2); return normalizedRowDate >= d3 && normalizedRowDate <= d2; }
    if (dateRange === "Últimos 7 dias") { const d14 = new Date(today); d14.setDate(today.getDate() - 13); const d7 = new Date(today); d7.setDate(today.getDate() - 7); return normalizedRowDate >= d14 && normalizedRowDate <= d7; }
    if (dateRange === "Últimos 14 dias") { const d28 = new Date(today); d28.setDate(today.getDate() - 27); const d14 = new Date(today); d14.setDate(today.getDate() - 14); return normalizedRowDate >= d28 && normalizedRowDate <= d14; }
    if (dateRange === "Últimos 28 dias") { const d56 = new Date(today); d56.setDate(today.getDate() - 55); const d28 = new Date(today); d28.setDate(today.getDate() - 28); return normalizedRowDate >= d56 && normalizedRowDate <= d28; }
    if (dateRange === "Últimos 30 dias") { const d60 = new Date(today); d60.setDate(today.getDate() - 59); const d30 = new Date(today); d30.setDate(today.getDate() - 30); return normalizedRowDate >= d60 && normalizedRowDate <= d30; }
    if (dateRange === "Esta semana") { const firstDayOfWeek = new Date(today); const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1); firstDayOfWeek.setDate(diff); const firstDayOfLastWeek = new Date(firstDayOfWeek); firstDayOfLastWeek.setDate(firstDayOfWeek.getDate() - 7); const lastDayOfLastWeekToToday = new Date(firstDayOfLastWeek); const currentDaysCount = Math.ceil((today.getTime() - firstDayOfWeek.getTime()) / (1000 * 3600 * 24)); lastDayOfLastWeekToToday.setDate(firstDayOfLastWeek.getDate() + currentDaysCount); return normalizedRowDate >= firstDayOfLastWeek && normalizedRowDate <= lastDayOfLastWeekToToday; }
    if (dateRange === "Semana passada") { const firstDayOf2WeeksAgo = new Date(today); const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 14; firstDayOf2WeeksAgo.setDate(diff); const lastDayOf2WeeksAgo = new Date(firstDayOf2WeeksAgo); lastDayOf2WeeksAgo.setDate(firstDayOf2WeeksAgo.getDate() + 6); return normalizedRowDate >= firstDayOf2WeeksAgo && normalizedRowDate <= lastDayOf2WeeksAgo; }
    if (dateRange === "Este mês") { const lastMonth = new Date(today); lastMonth.setMonth(today.getMonth() - 1); return normalizedRowDate.getMonth() === lastMonth.getMonth() && normalizedRowDate.getFullYear() === lastMonth.getFullYear(); }
    if (dateRange === "Mês passado") { const twoMonthsAgo = new Date(today); twoMonthsAgo.setMonth(today.getMonth() - 2); return normalizedRowDate.getMonth() === twoMonthsAgo.getMonth() && normalizedRowDate.getFullYear() === twoMonthsAgo.getFullYear(); }
    if (dateRange === "Máximo") return false;
    if (dateRange === "Personalizado") { if (!customStartDate || !customEndDate) return true; const start = new Date(customStartDate + 'T00:00:00'); const end = new Date(customEndDate + 'T00:00:00'); start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); const diffTime = Math.abs(end.getTime() - start.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 1); const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - diffDays + 1); return normalizedRowDate >= prevStart && normalizedRowDate <= prevEnd; }
    return true;
  };

  // Filter sheet data based on selected date range
  const filteredData = sheetData.filter(row => isDateInRange(parseDate(row["Data"])));
  const previousFilteredData = sheetData.filter(row => isDateInPreviousRange(parseDate(row["Data"])));

  // Compute metrics from filtered sheet data
  const computedMetrics = {
    revenue: 0, purchases: 0, prevRevenue: 0, prevPurchases: 0,
    totalEntrada: 0, servicoAprovado: 0, totalSaidas: 0,
    prevTotalEntrada: 0, prevServicoAprovado: 0, prevTotalSaidas: 0,
  };

  filteredData.forEach(row => {
    const revenueNum = parseNumberStr(row["Pedidos Pagos"] || "0");
    if (!isNaN(revenueNum)) computedMetrics.revenue += revenueNum;
    const purchasesNum = parseInt(row["Quantidade Pedidos"] || "0", 10);
    if (!isNaN(purchasesNum)) computedMetrics.purchases += purchasesNum;
    const totalEntradaNum = parseInt(row["Total de Entrada"] || "0", 10);
    if (!isNaN(totalEntradaNum)) computedMetrics.totalEntrada += totalEntradaNum;
    const servicoAprovadoNum = parseInt(row["Quantidade Pedidos"] || "0", 10);
    if (!isNaN(servicoAprovadoNum)) computedMetrics.servicoAprovado += servicoAprovadoNum;
    const totalSaidasNum = parseInt(row["Total de Saídas"] || "0", 10);
    if (!isNaN(totalSaidasNum)) computedMetrics.totalSaidas += totalSaidasNum;
  });

  previousFilteredData.forEach(row => {
    const revenueNum = parseNumberStr(row["Pedidos Pagos"] || "0");
    if (!isNaN(revenueNum)) computedMetrics.prevRevenue += revenueNum;
    const purchasesNum = parseInt(row["Quantidade Pedidos"] || "0", 10);
    if (!isNaN(purchasesNum)) computedMetrics.prevPurchases += purchasesNum;
    const totalEntradaNum = parseInt(row["Total de Entrada"] || "0", 10);
    if (!isNaN(totalEntradaNum)) computedMetrics.prevTotalEntrada += totalEntradaNum;
    const servicoAprovadoNum = parseInt(row["Quantidade Pedidos"] || "0", 10);
    if (!isNaN(servicoAprovadoNum)) computedMetrics.prevServicoAprovado += servicoAprovadoNum;
    const totalSaidasNum = parseInt(row["Total de Saídas"] || "0", 10);
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
        dailyMap.set(dateStr, { dateStr, timestamp, totalRevenue: 0, metaRevenue: 0, metaCost: 0, googleRevenue: 0, googleCost: 0 });
      }
      return dailyMap.get(dateStr)!;
    };

    filteredData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d) {
        const dayData = getOrCreateDay(d);
        const rNum = parseNumberStr(row["Pedidos Pagos"] || "0");
        if (!isNaN(rNum)) dayData.totalRevenue += rNum;
      }
    });

    trafficData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInRange(d)) {
        const dayData = getOrCreateDay(d);
        const gNum = parseNumberStr(row["Investimento"] || row["Gastos"] || "0");
        if (!isNaN(gNum)) dayData.metaCost += gNum;
        const rNum = parseNumberStr(row["Faturamento Meta Ads"] || "0");
        if (!isNaN(rNum)) dayData.metaRevenue += rNum;
      }
    });

    googleAdsData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInRange(d)) {
        const dayData = getOrCreateDay(d);
        const gNum = parseNumberStr(row["Investimento"] || row["Gastos"] || "0");
        if (!isNaN(gNum)) dayData.googleCost += gNum;
        const rNum = parseNumberStr(row["Faturamento Google Ads"] || row["Valor da conversão"] || "0");
        if (!isNaN(rNum)) dayData.googleRevenue += rNum;
      }
    });

    return Array.from(dailyMap.values()).map(item => ({
      ...item,
      totalCost: item.metaCost + item.googleCost,
      profit: item.totalRevenue - (item.metaCost + item.googleCost)
    })).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredData, trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  // Compute traffic metrics
  const computedTrafficMetrics = useMemo(() => {
    let investimentoMeta = 0, investimentoGoogle = 0, prevInvestimentoMeta = 0, prevInvestimentoGoogle = 0;
    let metaPurchases = 0, googlePurchases = 0, prevMetaPurchases = 0, prevGooglePurchases = 0;
    let faturamentoMeta = 0, faturamentoGoogle = 0, prevFaturamentoMeta = 0, prevFaturamentoGoogle = 0;

    trafficData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;
      const g = parseNumberStr(row["Investimento"] || row["Gastos"] || "0");
      const p = parseNumberStr(row["Compras Meta"] || "0");
      const f = parseNumberStr(row["Faturamento Meta Ads"] || "0");
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
      const g = parseNumberStr(row["Investimento"] || row["Gastos"] || "0");
      const p = parseNumberStr(row["Compras Meta"] || row["Conversões"] || "0");
      const f = parseNumberStr(row["Faturamento Google Ads"] || row["Valor da conversão"] || "0");
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

    return {
      investimentoMeta, investimentoGoogle, investimentoTotal: investimentoMeta + investimentoGoogle,
      prevInvestimentoMeta, prevInvestimentoGoogle, prevInvestimentoTotal: prevInvestimentoMeta + prevInvestimentoGoogle,
      metaPurchases, googlePurchases, prevMetaPurchases, prevGooglePurchases,
      faturamentoMeta, faturamentoGoogle, prevFaturamentoMeta, prevFaturamentoGoogle,
    };
  }, [trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  const funnelDataSources = useMemo(() => {
    const meta: Record<string, number> = { 'Cliques no Link': 0, 'Visualizações de Página': 0, 'Adições no Carrinho': 0, 'Checkout': 0, 'Compras Meta': 0 };
    const google: Record<string, number> = { 'Cliques no Link': 0, 'Visualizações de Página': 0, 'Adições no Carrinho': 0, 'Checkout': 0, 'Compras Meta': 0 };
    const all: Record<string, number> = { 'Cliques no Link': 0, 'Visualizações de Página': 0, 'Adições no Carrinho': 0, 'Checkout': 0, 'Compras Meta': 0 };

    trafficData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;
      if (isDateInRange(rowDate)) {
        ['Cliques no Link', 'Visualizações de Página', 'Adições no Carrinho', 'Checkout', 'Compras Meta'].forEach(key => {
          const val = parseInt((row[key] || "0").replace(/\./g, ''), 10);
          if (!isNaN(val)) { meta[key] += val; all[key] += val; }
        });
      }
    });

    googleAdsData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;
      if (isDateInRange(rowDate)) {
        const valClicks = parseNumberStr(row['Cliques no Link'] || row['Cliques'] || "0");
        if (!isNaN(valClicks)) { google['Cliques no Link'] += valClicks; all['Cliques no Link'] += valClicks; }
        const valConversions = parseNumberStr(row['Compras Meta'] || row['Conversões'] || "0");
        if (!isNaN(valConversions)) { google['Compras Meta'] += valConversions; all['Compras Meta'] += valConversions; }
      }
    });

    return { meta, google, all };
  }, [trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  // Calculate ROI
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
  if (computedTrafficMetrics.investimentoMeta > 0) metaRoi = `${(computedTrafficMetrics.faturamentoMeta / computedTrafficMetrics.investimentoMeta).toFixed(2)}x`;
  let googleRoi = "0.00x";
  if (computedTrafficMetrics.investimentoGoogle > 0) googleRoi = `${(computedTrafficMetrics.faturamentoGoogle / computedTrafficMetrics.investimentoGoogle).toFixed(2)}x`;

  // Client type
  const isWhatsapp = (dbCompanies.find(c => c.id === selectedCompany) as any)?.type === "whatsapp";
  const isItvManaus = (dbCompanies.find(c => c.id === selectedCompany) as any)?.type === "itv-manaus";

  const totalLeads = useMemo(() => {
    let leads = 0;
    trafficData.forEach(row => {
      const d = parseDate(row["Data"]);
      if (d && isDateInRange(d)) {
        const l = parseInt((row["Adições no Carrinho"] || "0").replace(/\./g, ''), 10);
        if (!isNaN(l)) leads += l;
      }
    });
    if (isItvManaus) {
      googleAdsData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (d && isDateInRange(d)) {
          const l = parseInt((row["Conversões"] || "0").replace(/\./g, ''), 10);
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
        const l = parseInt((row["Adições no Carrinho"] || "0").replace(/\./g, ''), 10);
        if (!isNaN(l)) leads += l;
      }
    });
    if (isItvManaus) {
      googleAdsData.forEach(row => {
        const d = parseDate(row["Data"]);
        if (d && isDateInPreviousRange(d)) {
          const l = parseInt((row["Conversões"] || "0").replace(/\./g, ''), 10);
          if (!isNaN(l)) leads += l;
        }
      });
    }
    return leads;
  }, [trafficData, googleAdsData, isItvManaus, dateRange, customStartDate, customEndDate]);

  const currentCac = computedMetrics.purchases > 0 ? investmentNum / computedMetrics.purchases : 0;
  const prevCac = computedMetrics.prevPurchases > 0 ? prevInvestmentNum / computedMetrics.prevPurchases : 0;
  const currentCpl = isWhatsapp ? (totalLeads > 0 ? investmentNum / totalLeads : 0) : (computedMetrics.purchases > 0 ? investmentNum / computedMetrics.purchases : 0);
  const prevCpl = isWhatsapp ? (prevTotalLeads > 0 ? prevInvestmentNum / prevTotalLeads : 0) : (computedMetrics.prevPurchases > 0 ? prevInvestmentNum / computedMetrics.prevPurchases : 0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
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
    const weeks: any[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let currentStart = new Date(firstDay);
    let weekCount = 1;
    while (currentStart <= lastDay) {
      const currentEnd = new Date(currentStart);
      while (currentEnd.getDay() !== 0 && currentEnd < lastDay) { currentEnd.setDate(currentEnd.getDate() + 1); }
      weeks.push({ id: `week-${weekCount}`, label: `Semana ${weekCount}`, start: new Date(currentStart), end: new Date(currentEnd), dateLabel: `${currentStart.getDate().toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')} a ${currentEnd.getDate().toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}` });
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
      weekCount++;
    }
    const calcMetricsForRange = (start: Date, end: Date) => {
      const isDateInRangeLocal = (d: Date | null) => { if (!d) return false; const norm = new Date(d); norm.setHours(0, 0, 0, 0); const ns = new Date(start); ns.setHours(0, 0, 0, 0); const ne = new Date(end); ne.setHours(0, 0, 0, 0); return norm >= ns && norm <= ne; };
      let revenue = 0, purchases = 0, invMeta = 0, invGoogle = 0, metaRevenue = 0, googleRevenue = 0, metaPurchases = 0, googlePurchases = 0;
      sheetData.forEach(row => { const d = parseDate(row["Data"]); if (isDateInRangeLocal(d)) { const rNum = parseNumberStr(row["Pedidos Pagos"] || "0"); if (!isNaN(rNum)) revenue += rNum; const pNum = parseInt(row["Quantidade Pedidos"] || "0", 10); if (!isNaN(pNum)) purchases += pNum; } });
      trafficData.forEach(row => { const d = parseDate(row["Data"]); if (isDateInRangeLocal(d)) { const g = parseNumberStr(row["Investimento"] || row["Gastos"] || "0"); if (!isNaN(g)) invMeta += g; const p = parseNumberStr(row["Compras Meta"] || "0"); if (!isNaN(p)) metaPurchases += p; const f = parseNumberStr(row["Faturamento Meta Ads"] || "0"); if (!isNaN(f)) metaRevenue += f; } });
      googleAdsData.forEach(row => { const d = parseDate(row["Data"]); if (isDateInRangeLocal(d)) { const g = parseNumberStr(row["Investimento"] || row["Gastos"] || "0"); if (!isNaN(g)) invGoogle += g; const p = parseNumberStr(row["Compras Meta"] || row["Conversões"] || "0"); if (!isNaN(p)) googlePurchases += p; const f = parseNumberStr(row["Faturamento Google Ads"] || row["Valor da conversão"] || "0"); if (!isNaN(f)) googleRevenue += f; } });
      const totalInv = invMeta + invGoogle;
      return { revenue, purchases, totalInv, roi: (totalInv > 0 && revenue > 0) ? (revenue / totalInv) : 0, metaRevenue, googleRevenue, metaPurchases, googlePurchases, invMeta, invGoogle, metaRoi: (invMeta > 0 && metaRevenue > 0) ? (metaRevenue / invMeta) : 0, googleRoi: (invGoogle > 0 && googleRevenue > 0) ? (googleRevenue / invGoogle) : 0 };
    };
    const monthMetrics = calcMetricsForRange(firstDay, lastDay);
    const weeksMetrics = weeks.map(w => {
      const prevStart = new Date(w.start); prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(w.end); prevEnd.setDate(prevEnd.getDate() - 7);
      return { ...w, metrics: calcMetricsForRange(w.start, w.end), prevMetrics: calcMetricsForRange(prevStart, prevEnd) };
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
    const isDateInRangeLocal = (d: Date | null) => { if (!d) return false; const norm = new Date(d); norm.setHours(0, 0, 0, 0); const ns = new Date(start); ns.setHours(0, 0, 0, 0); const ne = new Date(end); ne.setHours(0, 0, 0, 0); return norm >= ns && norm <= ne; };
    let revenue = 0, purchases = 0, inv = 0, clicks = 0, views = 0, carts = 0, checkouts = 0;
    let metaRevenue = 0, metaInv = 0, metaClicks = 0, metaViews = 0, metaCarts = 0, metaCheckouts = 0, metaPurchases = 0;
    sheetData.forEach(row => { const d = parseDate(row["Data"]); if (isDateInRangeLocal(d)) { const rNum = parseNumberStr(row["Pedidos Pagos"] || "0"); if (!isNaN(rNum)) revenue += rNum; const pNum = parseInt(row["Quantidade Pedidos"] || "0", 10); if (!isNaN(pNum)) purchases += pNum; } });
    trafficData.forEach(row => { const d = parseDate(row["Data"]); if (isDateInRangeLocal(d)) { const g = parseNumberStr(row["Investimento"] || row["Gastos"] || "0"); if (!isNaN(g)) { inv += g; metaInv += g; } const cNum = parseInt((row["Cliques no Link"] || row["Cliques"] || "0").replace(/\./g, ''), 10); if (!isNaN(cNum)) { clicks += cNum; metaClicks += cNum; } const vNum = parseInt((row["Visualizações de página de destino"] || row["Visualizações de Página"] || "0").replace(/\./g, ''), 10); if (!isNaN(vNum)) { views += vNum; metaViews += vNum; } const cartNum = parseInt((row["Adições no Carrinho"] || row["Adições ao Carrinho"] || row["Adições ao carrinho"] || "0").replace(/\./g, ''), 10); if (!isNaN(cartNum)) { carts += cartNum; metaCarts += cartNum; } const chkNum = parseInt((row["Finalizações de compra iniciadas"] || row["Checkout"] || "0").replace(/\./g, ''), 10); if (!isNaN(chkNum)) { checkouts += chkNum; metaCheckouts += chkNum; } const purcNum = parseInt((row["Compras Meta"] || row["Compras de no site"] || row["Compras"] || "0").replace(/\./g, ''), 10); if (!isNaN(purcNum)) metaPurchases += purcNum; const rev = parseNumberStr(row["Faturamento Meta Ads"] || row["Valor de conversão de compras no site"] || row["Faturamento"] || "0"); if (!isNaN(rev)) metaRevenue += rev; } });
    googleAdsData.forEach(row => { const d = parseDate(row["Data"]); if (isDateInRangeLocal(d)) { const g = parseNumberStr(row["Investimento"] || row["Gastos"] || "0"); if (!isNaN(g)) inv += g; const cNum = parseNumberStr(row["Cliques no Link"] || row["Cliques"] || "0"); if (!isNaN(cNum)) clicks += cNum; const vNum = parseNumberStr(row["Visualizações de página de destino"] || row["Visualizações de Página"] || "0"); if (!isNaN(vNum)) views += vNum; const cartNum = parseNumberStr(row["Adições ao carrinho"] || row["Adições ao Carrinho"] || "0"); if (!isNaN(cartNum)) carts += cartNum; const chkNum = parseNumberStr(row["Finalizações de compra iniciadas"] || row["Checkout"] || "0"); if (!isNaN(chkNum)) checkouts += chkNum; } });
    const baseMetaTicket = metaPurchases > 0 ? metaRevenue / metaPurchases : 150;
    const baseMetaCpc = metaClicks > 0 ? metaInv / metaClicks : 2.5;
    return {
      revenue, purchases, inv, clicks, views, carts, checkouts,
      baseTicket: purchases > 0 ? revenue / purchases : 0,
      baseCpc: clicks > 0 ? inv / clicks : 0,
      baseCpa: purchases > 0 ? inv / purchases : 0,
      baseConvRate: clicks > 0 ? (purchases / clicks) * 100 : 0,
      roi: inv > 0 ? revenue / inv : 0,
      baseViewRate: clicks > 0 ? (views / clicks) * 100 : 0,
      baseCartRate: views > 0 ? (carts / views) * 100 : 0,
      baseCheckoutRate: carts > 0 ? (checkouts / carts) * 100 : 0,
      basePurcRate: checkouts > 0 ? (purchases / checkouts) * 100 : 0,
      metaRevenue, metaInv, metaClicks, metaViews, metaCarts, metaCheckouts, metaPurchases,
      baseMetaTicket, baseMetaCpc,
      baseMetaViewRate: metaClicks > 0 ? (metaViews / metaClicks) * 100 : 80,
      baseMetaCartRate: metaViews > 0 ? (metaCarts / metaViews) * 100 : 50,
      baseMetaCheckoutRate: metaCarts > 0 ? (metaCheckouts / metaCarts) * 100 : 40,
      baseMetaPurcRate: metaCheckouts > 0 ? (metaPurchases / metaCheckouts) * 100 : 30,
    };
  }, [activeTab, simulationTabMonth, sheetData, trafficData, googleAdsData]);

  // Derived Simulation Metrics
  const simulatedClicks = simCpc > 0 ? simInvestment / simCpc : 0;
  const simulatedViews = simulatedClicks * (simViewRate / 100);
  const simulatedCarts = simulatedViews * (simCartRate / 100);
  const simulatedCheckouts = simulatedCarts * (simCheckoutRate / 100);
  const simulatedPurchases = simulatedCheckouts * (simPurcRate / 100);
  const simulatedCpa = simulatedPurchases > 0 ? simInvestment / simulatedPurchases : 0;
  const simulatedRevenue = simulatedPurchases * simTicket;
  const simulatedRoi = simInvestment > 0 ? simulatedRevenue / simInvestment : 0;
  const simulatedGlobalRevenue = simBaseMetrics ? ((simBaseMetrics.revenue - (simBaseMetrics.metaRevenue || 0)) + simulatedRevenue) : 0;

  // --- Render ---

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
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Senha</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" required />
              </div>
              {loginError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{loginError}</div>
              )}
              <button type="submit" disabled={isLoggingIn} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2">
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
            <h1 className="text-xl font-semibold tracking-tight">Dashboards</h1>
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
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button onClick={handleLogout} className="flex items-center justify-center w-10 h-10 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Sair do sistema">
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
              { id: "overview", label: "Visão Geral", icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: "monthly", label: "Visão Mensal", icon: <CalendarDays className="w-4 h-4" /> },
              { id: "funnel", label: "Funil de Vendas", icon: <Filter className="w-4 h-4" /> },
              { id: "account-health", label: "Saúde da Conta", icon: <Activity className="w-4 h-4" /> },
              { id: "revenue", label: "Faturamento", icon: <Receipt className="w-4 h-4" /> },
              { id: "strategy", label: "Estratégia", icon: <Lightbulb className="w-4 h-4" /> },
              { id: "simulations", label: "Simulador", icon: <Lightbulb className="w-4 h-4" /> },
              ...(isAdmin ? [{ id: "admin", label: "Gerenciar Clientes", icon: <Settings className="w-4 h-4" /> }] : []),
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
          {activeTab === "admin" && (
            <AdminPanel
              dbCompanies={dbCompanies}
              fetchCompanies={() => supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user?.email) fetchCompaniesAndAccess(session.user.email);
              })}
            />
          )}

          {activeTab === "overview" && (
            <OverviewTab
              isFetchingSheet={isFetchingSheet}
              isFetchingTraffic={isFetchingTraffic}
              isFetchingGoogleAds={isFetchingGoogleAds}
              dateRange={dateRange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              chartSource={chartSource}
              chartType={chartType}
              computedMetrics={computedMetrics}
              computedTrafficMetrics={computedTrafficMetrics}
              funnelDataSources={funnelDataSources}
              dailyChartData={dailyChartData}
              formattedRevenue={formattedRevenue}
              calculatedRoi={calculatedRoi}
              currentCalculatedRoiNum={currentCalculatedRoiNum}
              prevCalculatedRoiNum={prevCalculatedRoiNum}
              metaRoi={metaRoi}
              googleRoi={googleRoi}
              isWhatsapp={isWhatsapp}
              isItvManaus={isItvManaus}
              totalLeads={totalLeads}
              prevTotalLeads={prevTotalLeads}
              currentCac={currentCac}
              prevCac={prevCac}
              currentCpl={currentCpl}
              prevCpl={prevCpl}
              mockMetrics={mockMetrics}
              setDateRange={setDateRange}
              setCustomStartDate={setCustomStartDate}
              setCustomEndDate={setCustomEndDate}
              setChartSource={setChartSource}
              setChartType={setChartType}
              handleRefresh={handleRefresh}
            />
          )}

          {activeTab === "monthly" && (
            <MonthlyTab
              isFetchingSheet={isFetchingSheet}
              isFetchingTraffic={isFetchingTraffic}
              isFetchingGoogleAds={isFetchingGoogleAds}
              monthlyTabMonth={monthlyTabMonth}
              monthlyMetrics={monthlyMetrics}
              expandedWeekIds={expandedWeekIds}
              setMonthlyTabMonth={setMonthlyTabMonth}
              setExpandedWeekIds={setExpandedWeekIds}
              handleRefresh={handleRefresh}
            />
          )}

          {activeTab === "funnel" && (
            <FunnelTab
              isFetchingTraffic={isFetchingTraffic}
              isFetchingGoogleAds={isFetchingGoogleAds}
              trafficError={trafficError}
              googleAdsError={googleAdsError}
              dateRange={dateRange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              funnelSource={funnelSource}
              funnelDataSources={funnelDataSources}
              computedTrafficMetrics={computedTrafficMetrics}
              computedMetrics={computedMetrics}
              isItvManaus={isItvManaus}
              setDateRange={setDateRange}
              setCustomStartDate={setCustomStartDate}
              setCustomEndDate={setCustomEndDate}
              setFunnelSource={setFunnelSource}
            />
          )}

          {activeTab === "account-health" && (
            <AccountHealthTab
              currentCompany={currentCompany}
              accountHealth={accountHealth}
              basicScore={basicScore}
              campaignScore={campaignScore}
              trackingScore={trackingScore}
              croScore={croScore}
              creativeScore={creativeScore}
              dataScore={dataScore}
              financeScore={financeScore}
              overallHealthScore={overallHealthScore}
              overallHealthConfig={overallHealthConfig}
              isSavingHealth={isSavingHealth}
              getHealthColorConfig={getHealthColorConfig}
              getMetricHealthColor={getMetricHealthColor}
              handleHealthCheckChange={handleHealthCheckChange}
              handleMetricChange={handleMetricChange}
            />
          )}

          {activeTab === "revenue" && (
            <RevenueTab
              isFetchingSheet={isFetchingSheet}
              sheetError={sheetError}
              sheetData={sheetData}
              sheetHeaders={sheetHeaders}
              currentCompany={currentCompany}
            />
          )}

          {activeTab === "strategy" && (
            <StrategyTab
              isEditingStrategy={isEditingStrategy}
              localStrategy={localStrategy}
              isSavingStrategy={isSavingStrategy}
              setIsEditingStrategy={setIsEditingStrategy}
              setLocalStrategy={setLocalStrategy}
              handleSaveStrategy={handleSaveStrategy}
            />
          )}

          {activeTab === "simulations" && (
            <SimulationsTab
              simulationTabMonth={simulationTabMonth}
              simInvestment={simInvestment}
              simCpc={simCpc}
              simViewRate={simViewRate}
              simCartRate={simCartRate}
              simCheckoutRate={simCheckoutRate}
              simPurcRate={simPurcRate}
              simTicket={simTicket}
              simBaseMetrics={simBaseMetrics}
              simulatedClicks={simulatedClicks}
              simulatedViews={simulatedViews}
              simulatedCarts={simulatedCarts}
              simulatedCheckouts={simulatedCheckouts}
              simulatedPurchases={simulatedPurchases}
              simulatedCpa={simulatedCpa}
              simulatedRevenue={simulatedRevenue}
              simulatedRoi={simulatedRoi}
              simulatedGlobalRevenue={simulatedGlobalRevenue}
              setSimulationTabMonth={setSimulationTabMonth}
              setSimInvestment={setSimInvestment}
              setSimCpc={setSimCpc}
              setSimViewRate={setSimViewRate}
              setSimCartRate={setSimCartRate}
              setSimCheckoutRate={setSimCheckoutRate}
              setSimPurcRate={setSimPurcRate}
              setSimTicket={setSimTicket}
            />
          )}
        </main>
      </div>
    </div>
  );
}
