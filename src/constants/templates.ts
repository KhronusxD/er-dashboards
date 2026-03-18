// Built-in template definitions
export const BUILT_IN_BASE_TEMPLATES = [
  { id: 'default', name: 'Padrão (E-commerce)', description: 'Template padrão para lojas e-commerce' },
  { id: 'whatsapp', name: 'WhatsApp / Leads', description: 'Para clientes que usam WhatsApp como canal principal' },
  { id: 'servicos', name: 'Serviços', description: 'Para negócios de serviços (inspeção, consultoria, etc)' }
];

// Template column mappings
export const BUILT_IN_TEMPLATE_MAPPINGS: Record<string, any> = {
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

// Template field labels for UI
export const TEMPLATE_FIELD_LABELS: Record<string, Array<{key: string, label: string}>> = {
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
