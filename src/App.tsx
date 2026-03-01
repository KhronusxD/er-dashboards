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
  MousePointerClick,
  CreditCard,
} from "lucide-react";
import {
  companies,
  performanceMetrics,
  strategyConfig,
} from "./data/mockData";

export default function App() {
  const [selectedCompany, setSelectedCompany] = useState(companies[0].id);
  const [activeTab, setActiveTab] = useState("overview");
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

  // Strategy Edit State
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [localStrategy, setLocalStrategy] = useState(
    strategyConfig[selectedCompany] || strategyConfig["atual-card"],
  );

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

  const SHEET_ID = "1kGjFoEJ36-g1empy9HmYzQmF0Rd-y_06sy54YvOYlps";
  const TRAFFIC_SHEET_ID = "1om3vD7mik6psxaLjt6QGqnkEnGdpr6T5dBrNIjYa4BY";

  useEffect(() => {
    setLocalStrategy(
      strategyConfig[selectedCompany] || strategyConfig["atual-card"],
    );
    setIsEditingStrategy(false);
  }, [selectedCompany]);

  useEffect(() => {
    setIsFetchingSheet(true);
    setSheetError(null);
    setIsFetchingTraffic(true);
    setTrafficError(null);
    setIsFetchingGoogleAds(true);
    setGoogleAdsError(null);

    const currentCompanyObj = companies.find((c) => c.id === selectedCompany);
    const tabName = currentCompanyObj?.name || "";

    // Fetch Revenue Sheet
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

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
            setSheetHeaders(results.meta.fields || []);
            const validData = results.data.filter((row: any) => Object.values(row).some(val => val !== ""));
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

    // Fetch Traffic Sheet
    const trafficUrl = `https://docs.google.com/spreadsheets/d/${TRAFFIC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

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
            const validData = results.data.filter((row: any) => Object.values(row).some(val => val !== ""));
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
    const googleAdsTabName = `${tabName} - Google Ads`;
    const googleAdsUrl = `https://docs.google.com/spreadsheets/d/${TRAFFIC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(googleAdsTabName)}`;

    Papa.parse(googleAdsUrl, {
      download: true,
      header: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setGoogleAdsError(`Erro ao carregar a planilha do Google Ads. Verifique se ela está pública e se existe uma aba com o nome exato: "${googleAdsTabName}".`);
        } else {
          if (results.meta.fields && results.meta.fields.length === 1 && results.meta.fields[0].includes("<!DOCTYPE html>")) {
            setGoogleAdsError(`A planilha do Google Ads é privada. Você precisa alterar o acesso para "Qualquer pessoa com o link".`);
          } else {
            const validData = results.data.filter((row: any) => Object.values(row).some(val => val !== ""));
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

  }, [selectedCompany]);

  const handleSaveStrategy = () => {
    // In a real app, this would save to a backend
    setIsEditingStrategy(false);
  };

  const currentCompany = companies.find((c) => c.id === selectedCompany);
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

    // Normalize rowDate to midnight for accurate comparison
    const normalizedRowDate = new Date(rowDate);
    normalizedRowDate.setHours(0, 0, 0, 0);

    if (dateRange === "Hoje") {
      return normalizedRowDate.getTime() === today.getTime();
    }
    if (dateRange === "Últimos 7 dias") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      return normalizedRowDate >= sevenDaysAgo && normalizedRowDate <= today;
    }
    if (dateRange === "Últimos 30 dias") {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return normalizedRowDate >= thirtyDaysAgo && normalizedRowDate <= today;
    }
    if (dateRange === "Este mês") {
      return normalizedRowDate.getMonth() === today.getMonth() && normalizedRowDate.getFullYear() === today.getFullYear();
    }
    if (dateRange === "Mês passado") {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      return normalizedRowDate.getMonth() === lastMonth.getMonth() && normalizedRowDate.getFullYear() === lastMonth.getFullYear();
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

  // Filter sheet data based on selected date range
  const getFilteredData = () => {
    return sheetData.filter(row => isDateInRange(parseDate(row["Data"])));
  };

  const filteredData = getFilteredData();

  // Compute metrics from filtered sheet data
  const computedMetrics = {
    revenue: 0,
    purchases: 0,
  };

  filteredData.forEach(row => {
    const revenueStr = row["Pedidos Pagos"] || "0";
    const revenueNum = parseFloat(revenueStr.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(revenueNum)) computedMetrics.revenue += revenueNum;

    const purchasesStr = row["Quantidade Pedidos"] || "0";
    const purchasesNum = parseInt(purchasesStr, 10);
    if (!isNaN(purchasesNum)) computedMetrics.purchases += purchasesNum;
  });

  const formattedRevenue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(computedMetrics.revenue);

  // Compute traffic metrics
  const computedTrafficMetrics = useMemo(() => {
    let investimentoMeta = 0;
    let investimentoGoogle = 0;
    let metaPurchases = 0;
    let googlePurchases = 0;
    let faturamentoMeta = 0;
    let faturamentoGoogle = 0;

    trafficData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;

      if (isDateInRange(rowDate)) {
        const gStr = row["Investimento"] || row["Gastos"] || "0";
        const g = parseFloat(gStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(g)) investimentoMeta += g;

        const pStr = row["Compras Meta"] || "0";
        const p = parseFloat(pStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(p)) metaPurchases += p;

        const fStr = row["Faturamento Meta Ads"] || "0";
        const f = parseFloat(fStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(f)) faturamentoMeta += f;
      }
    });

    googleAdsData.forEach(row => {
      const rowDate = parseDate(row["Data"]);
      if (!rowDate) return;

      if (isDateInRange(rowDate)) {
        const gStr = row["Investimento"] || row["Gastos"] || "0";
        const g = parseFloat(gStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(g)) investimentoGoogle += g;

        const pStr = row["Compras Meta"] || row["Conversões"] || "0";
        const p = parseFloat(pStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(p)) googlePurchases += p;

        const fStr = row["Faturamento Google Ads"] || row["Valor da conversão"] || "0";
        const f = parseFloat(fStr.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(f)) faturamentoGoogle += f;
      }
    });

    const investimentoTotal = investimentoMeta + investimentoGoogle;

    return {
      investimentoMeta,
      investimentoGoogle,
      investimentoTotal,
      metaPurchases,
      googlePurchases,
      faturamentoMeta,
      faturamentoGoogle
    };
  }, [trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  const funnelData = useMemo(() => {
    const data: Record<string, number> = {
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
          if (!isNaN(val)) data[key] += val;
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

        const valClicks = parseFloat(clicks.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(valClicks)) data['Cliques no Link'] += valClicks;

        const valConversions = parseFloat(conversions.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(valConversions)) data['Compras Meta'] += valConversions;
      }
    });

    return data;
  }, [trafficData, googleAdsData, dateRange, customStartDate, customEndDate]);

  // Calculate ROI based on real revenue and real investment
  const investmentNum = computedTrafficMetrics.investimentoTotal;
  let calculatedRoi = "0.00x";

  if (!isNaN(investmentNum) && investmentNum > 0 && computedMetrics.revenue > 0) {
    const roi = computedMetrics.revenue / investmentNum;
    calculatedRoi = `${roi.toFixed(2)}x`;
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
              NAPAN Traffic Hub
            </h1>
          </div>

          <div className="relative">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="appearance-none bg-neutral-100 border border-neutral-200 text-neutral-800 py-2 pl-4 pr-10 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                id: "funnel",
                label: "Funil de Vendas",
                icon: <Filter className="w-4 h-4" />,
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
          {activeTab === "overview" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Overview Header with Date Picker */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                <h2 className="text-lg font-semibold text-neutral-800">
                  Resumo de Performance
                </h2>
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
                      <option>Últimos 7 dias</option>
                      <option>Últimos 30 dias</option>
                      <option>Este mês</option>
                      <option>Mês passado</option>
                      <option>Personalizado</option>
                    </select>
                    <Calendar className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Faturamento"
                  value={formattedRevenue}
                  change={mockMetrics.revenueChange}
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
                  change={mockMetrics.investmentChange}
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
                  title="Compras"
                  value={computedMetrics.purchases.toString()}
                  change={mockMetrics.purchasesChange}
                  icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
                  subtitle={
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
                  }
                />
                <MetricCard
                  title="ROI"
                  value={calculatedRoi}
                  change={mockMetrics.roiChange}
                  icon={<BarChart3 className="w-5 h-5 text-purple-600" />}
                />
              </div>

              {/* Insights Panel */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-neutral-800">
                    Insights Gerados por IA
                  </h2>
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
                      <option>Últimos 7 dias</option>
                      <option>Últimos 30 dias</option>
                      <option>Este mês</option>
                      <option>Mês passado</option>
                      <option>Personalizado</option>
                    </select>
                    <Calendar className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
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
                      {[
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
                      ].map((stage, index, array) => {
                        const value = funnelData[stage.key] || 0;
                        const nextStage = array[index + 1];
                        const nextValue = nextStage ? (funnelData[nextStage.key] || 0) : null;
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
                        const costPerConversion = value > 0 ? computedTrafficMetrics.investimentoMeta / value : 0;

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
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  icon,
  inverseChange = false,
  subtitle,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  inverseChange?: boolean;
  subtitle?: React.ReactNode;
}) {
  const isPositive = change.startsWith("+");
  const isGood = inverseChange ? !isPositive : isPositive;

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
          className={`text-sm font-medium flex items-center gap-1 ${isGood ? "text-emerald-600" : "text-red-600"}`}
        >
          {isPositive ? "↑" : "↓"} {change.replace(/[+-]/, "")}
          <span className="text-neutral-400 font-normal ml-1">
            vs último mês
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
