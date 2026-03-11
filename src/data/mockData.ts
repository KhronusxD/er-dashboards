export const companies = [
  { id: "atual-card", name: "Atual Card" },
  { id: "fabrica-do-livro", name: "Fábrica do Livro", sheetGid: "1616676463", trafficGid: "1328007383", googleAdsGid: "512858276" },
  { id: "grafica-cores", name: "Gráfica Cores" },
  { id: "cartoes-mais-barato", name: "Cartões Mais Barato" },
  { id: "paulista-cartoes", name: "Paulista Cartões" },
  { id: "imprima-rapido", name: "Imprima Rápido" },
  { id: "grafica-das-graficas", name: "Gráfica das Gráficas" },
  { id: "cartao-de-visita", name: "Cartão de Visita" },
  { id: "nordeste-graf", name: "Nordeste Graf" },
  { id: "orion-olimpia", name: "Órion Olímpia" },
  { id: "clinvet", name: "Clinvet BSB", type: "whatsapp", spreadsheetId: "1KoDWDJ19pN4hNq7YCWNzkhB1VrabCLGLJvIBfAeS9Nk", sheetTab: "Dashboard" },
];

export const performanceMetrics: Record<string, any> = {
  "atual-card": {
    revenue: "R$ 1.250.000",
    revenueChange: "+12.5%",
    investment: "R$ 350.000",
    investmentChange: "-2.4%",
    purchases: "15.430",
    purchasesChange: "+8.2%",
    roi: "3.57",
    roiChange: "+15.1%",
    insights: [
      "Aumento no custo por compra nos últimos 3 dias nas campanhas de Meta Ads.",
      "Campanha de 'Cartão de Visita Premium' com ROAS 45% acima da média histórica.",
      "Oportunidade de escalar orçamento no Google Search para termos de 'impressão rápida'.",
    ],
  },
  "paulista-cartoes": {
    revenue: "R$ 850.000",
    revenueChange: "+5.2%",
    investment: "R$ 210.000",
    investmentChange: "+1.5%",
    purchases: "9.850",
    purchasesChange: "+4.1%",
    roi: "4.04",
    roiChange: "+3.6%",
    insights: [
      "Taxa de conversão do site caiu 1.2% após a última atualização de layout.",
      "Custo por clique (CPC) no Google Ads reduziu em 15% na última semana.",
      "Público de remarketing apresenta fadiga de criativos. Necessária renovação.",
    ],
  },
};

export const revenueLogs: Record<string, any[]> = {
  "atual-card": [
    {
      id: "TRX-001",
      date: "2023-10-25 14:32",
      product: "Cartão de Visita Couchê 300g",
      value: "R$ 145,00",
      status: "Aprovado",
    },
    {
      id: "TRX-002",
      date: "2023-10-25 15:10",
      product: "Panfleto 10x15cm",
      value: "R$ 280,00",
      status: "Aprovado",
    },
    {
      id: "TRX-003",
      date: "2023-10-25 15:45",
      product: "Banner Lona 440g",
      value: "R$ 120,00",
      status: "Pendente",
    },
    {
      id: "TRX-004",
      date: "2023-10-25 16:20",
      product: "Adesivo Vinil",
      value: "R$ 85,00",
      status: "Aprovado",
    },
    {
      id: "TRX-005",
      date: "2023-10-25 17:05",
      product: "Cartão de Visita Couchê 300g",
      value: "R$ 145,00",
      status: "Cancelado",
    },
  ],
  "paulista-cartoes": [
    {
      id: "TRX-101",
      date: "2023-10-25 09:15",
      product: "Folder 2 Dobras",
      value: "R$ 450,00",
      status: "Aprovado",
    },
    {
      id: "TRX-102",
      date: "2023-10-25 10:30",
      product: "Cartão de Visita Supremo",
      value: "R$ 190,00",
      status: "Aprovado",
    },
    {
      id: "TRX-103",
      date: "2023-10-25 11:45",
      product: "Receituário",
      value: "R$ 110,00",
      status: "Aprovado",
    },
    {
      id: "TRX-104",
      date: "2023-10-25 13:20",
      product: "Pasta com Bolsa",
      value: "R$ 320,00",
      status: "Pendente",
    },
  ],
};

export const strategyConfig: Record<string, any> = {
  "atual-card": {
    verbaMensal: "150.000",
    dataRecarga: "Dia 05 de cada mês",
    personas: [
      "Revendedores Gráficos Autônomos",
      "Pequenas Agências de Publicidade",
      "Designers Freelancers",
    ],
    uniqueAdvantages: [
      "Maior parque gráfico da América Latina",
      "Preço agressivo para revenda",
      "Prazos de produção expressos (24h)",
    ],
    trafficStrategy:
      "Foco agressivo em fundo de funil (Google Search) para captação de revendedores. Meta Ads focado em remarketing e lookalike de top compradores. Orçamento distribuído 60% Google / 40% Meta.",
    funnel: {
      captacao: {
        frio: "Lookalike 1% Compradores, Interesses em Design Gráfico",
        morno: "Engajamento Instagram 365d, Visualização de Vídeo 50%",
        quente: "Visitantes do site 30d, Abandonos de Carrinho 7d",
      },
      distribuicao: {
        topo: "Vídeos de bastidores da gráfica, Dicas de design para impressão",
        meio: "Depoimentos de revendedores de sucesso, Comparativo de materiais",
        fundo:
          "Oferta agressiva de frete grátis, Cupom de primeira compra (Google Search)",
      },
    },
  },
  "paulista-cartoes": {
    verbaMensal: "80.000",
    dataRecarga: "Dia 10 de cada mês",
    personas: [
      "Empreendedores Locais",
      "Profissionais Liberais (Advogados, Médicos)",
      "Comércio Varejista",
    ],
    uniqueAdvantages: [
      "Atendimento humanizado via WhatsApp",
      "Qualidade premium de acabamento",
      "Frete grátis para capital",
    ],
    trafficStrategy:
      "Estratégia focada em geração de leads via Meta Ads (WhatsApp) e campanhas locais no Google Ads. Forte investimento em criativos de vídeo demonstrando a qualidade do material.",
    funnel: {
      captacao: {
        frio: "Segmentação local (Raio 15km), Interesses em Empreendedorismo",
        morno: "Mensagens WhatsApp 90d, Engajamento FB/IG",
        quente:
          "Lista de clientes antigos (LTV), Visitantes da página de contato",
      },
      distribuicao: {
        topo: "Importância da primeira impressão, Branding para negócios locais",
        meio: "Portfólio de materiais premium, Como funciona nosso atendimento",
        fundo:
          "Botão WhatsApp direto com consultor, Promoção de combos para escritório",
      },
    },
  },
};
