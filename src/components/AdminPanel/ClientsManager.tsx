import React, { useState } from 'react';
import { X, Plus, Save, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Feedback } from '../../types';

interface ClientsManagerProps {
  dbCompanies: any[];
  fetchCompanies: () => void;
}

export const ClientsManager: React.FC<ClientsManagerProps> = ({ dbCompanies, fetchCompanies }) => {
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [formData, setFormData] = useState<any>({
    id: '', name: '', type: 'default', spreadsheet_id: '',
    orders_spreadsheet_id: '',
    sheet_tab: '', traffic_tab: '', google_ads_tab: '',
    sheet_gid: '', traffic_gid: '', google_ads_gid: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
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
        orders_spreadsheet_id: formData.orders_spreadsheet_id || null,
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
    setFormData({ id: '', name: '', type: 'default', spreadsheet_id: '', orders_spreadsheet_id: '', sheet_tab: '', traffic_tab: '', google_ads_tab: '', sheet_gid: '', traffic_gid: '', google_ads_gid: '' });
    setIsEditingCompany(true);
  };

  const openEditForm = (c: any) => {
    setFormData({
      id: c.id, name: c.name, type: c.type || 'default',
      spreadsheet_id: c.spreadsheet_id || c.spreadsheetId || '',
      orders_spreadsheet_id: c.orders_spreadsheet_id || c.ordersSpreadsheetId || '',
      sheet_tab: c.sheet_tab || c.sheetTab || '',
      traffic_tab: c.traffic_tab || c.trafficTab || '',
      google_ads_tab: c.google_ads_tab || c.googleAdsTab || '',
      sheet_gid: c.sheet_gid || c.sheetGid || '',
      traffic_gid: c.traffic_gid || c.trafficGid || '',
      google_ads_gid: c.google_ads_gid || c.googleAdsGid || ''
    });
    setIsEditingCompany(true);
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'default': 'Padrão (E-commerce)',
      'whatsapp': 'WhatsApp / Leads',
      'servicos': 'Serviços'
    };
    return labels[type] || type;
  };

  const typeBadgeClass = (type: string) => {
    const classes: Record<string, string> = {
      'default': 'bg-blue-50 text-blue-700',
      'whatsapp': 'bg-green-50 text-green-700',
      'servicos': 'bg-purple-50 text-purple-700'
    };
    return classes[type] || 'bg-neutral-100 text-neutral-600';
  };

  return (
    <>
      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {feedback.msg}
        </div>
      )}

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
                  <option value="servicos">Serviços</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  ID da Planilha de Ads <span className="text-neutral-400 font-normal text-xs">(Meta Ads / Google Ads)</span>
                </label>
                <input
                  value={formData.spreadsheet_id}
                  onChange={e => setFormData({ ...formData, spreadsheet_id: e.target.value })}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="Cole o ID da URL do Google Sheets"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  ID da Planilha de Pedidos <span className="text-neutral-400 font-normal text-xs">(Faturamento)</span>
                </label>
                <input
                  value={formData.orders_spreadsheet_id}
                  onChange={e => setFormData({ ...formData, orders_spreadsheet_id: e.target.value })}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="Cole o ID da URL do Google Sheets"
                />
                <p className="text-xs text-neutral-400 mt-1">Colunas: A=Data · B=Qtd Pedidos · C=Pedidos Pagos (Faturamento) · D=Pedidos não pagos</p>
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
  );
};
