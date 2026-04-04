export const API_URL = 'https://simulado-api.simulado-ata-mf.workers.dev';
export const apiKey = "simulasupport2025";

// Supabase config
export const SUPABASE_URL = "https://unhnnuvubhlobctdjjlf.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuaG5udXZ1Ymhsb2JjdGRqamxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjY5NzEsImV4cCI6MjA5MDY0Mjk3MX0.3ZMQX6lLmEr67C_s9JmiYzN2rSh24aHSPsBr8H4E7U0";

// Cliente Supabase Singleton — compartilhado por toda a aplicação
let _supabaseClient = null;
export const getSupabaseClient = () => {
  if (!_supabaseClient && window.supabase) {
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabaseClient;
};

// Helper pra fazer fetch autenticado com JWT do Supabase
export const apiFetch = async (endpoint, options = {}) => {
  const supabase = getSupabaseClient();
  let token = null;

  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  const fullUrl = `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}admin_key=${apiKey}`;
  
  console.log(`Simulai API Request [${options.method || 'GET'}]: ${fullUrl}`);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': apiKey, // Chave Administrativa Mestra
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal
    });
    
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    console.error("Simulai API Error:", error, "URL:", fullUrl);
    if (error.name === 'AbortError') {
      console.error("Fetch timeout: A requisição demorou demais e foi cancelada.");
      throw new Error("O servidor demorou muito para responder. Tente novamente.");
    }
    throw error;
  }
};
