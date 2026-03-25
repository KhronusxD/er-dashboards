// Company types
export interface Company {
  id: string;
  name: string;
  type: 'default' | 'whatsapp' | 'servicos' | string;
  spreadsheet_id?: string;
  orders_spreadsheet_id?: string;
  sheet_tab?: string;
  traffic_tab?: string;
  google_ads_tab?: string;
  sheet_gid?: number;
  traffic_gid?: number;
  google_ads_gid?: number;
  template_id?: string;
  updated_at?: string;
  // Deprecated (from old schema):
  spreadsheetId?: string;
  ordersSpreadsheetId?: string;
  sheetTab?: string;
  trafficTab?: string;
  googleAdsTab?: string;
  sheetGid?: number;
  trafficGid?: number;
  googleAdsGid?: number;
}

// Template types
export interface ClientTemplate {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  column_mapping?: Record<string, any>;
  created_by?: string;
  updated_at?: string;
}

// User access types
export interface UserAccess {
  user_email: string;
  company_id: string;
  role?: string;
  created_at?: string;
}

// Feedback notification
export interface Feedback {
  type: 'success' | 'error';
  msg: string;
}

// Form data for companies
export interface CompanyFormData {
  id: string;
  name: string;
  type: string;
  spreadsheet_id: string;
  orders_spreadsheet_id: string;
  sheet_tab: string;
  traffic_tab: string;
  google_ads_tab: string;
  sheet_gid: string;
  traffic_gid: string;
  google_ads_gid: string;
}

// Template data for forms
export interface NewTemplateData {
  id: string;
  name: string;
  description: string;
  baseType: string;
}
