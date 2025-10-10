const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables are not defined.');
}

type SupabaseResponse<T> = {
  data: T | null;
  error: Error | null;
};

const baseHeaders: HeadersInit = {
  apikey: supabaseKey ?? '',
  Authorization: `Bearer ${supabaseKey ?? ''}`,
  'Content-Type': 'application/json'
};

function missingConfigResponse<T>(): SupabaseResponse<T> {
  return {
    data: null,
    error: new Error('Supabase environment variables are not defined.')
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<SupabaseResponse<T>> {
  if (!supabaseUrl || !supabaseKey) {
    return missingConfigResponse<T>();
  }
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...baseHeaders,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: new Error(errorText || response.statusText) };
    }

    if (response.status === 204) {
      return { data: null, error: null };
    }

    const json = (await response.json()) as T;
    return { data: json, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function fetchCategories() {
  if (!supabaseUrl) {
    return missingConfigResponse();
  }
  const url = `${supabaseUrl}/rest/v1/categories?select=*&order=sort_order`;
  return fetchJson(url);
}

export async function fetchTransactions() {
  if (!supabaseUrl) {
    return missingConfigResponse();
  }
  const url = `${supabaseUrl}/rest/v1/transactions?select=*`;
  return fetchJson(url);
}

export async function insertTransaction(payload: {
  category_id: string;
  label: string;
  amount: number;
  cadence: string;
  flow: string;
  note: string;
}) {
  if (!supabaseUrl) {
    return missingConfigResponse();
  }
  const url = `${supabaseUrl}/rest/v1/transactions`;
  return fetchJson(url, {
    method: 'POST',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
}

export async function updateTransactionCategory(transactionId: string, toCategory: string) {
  if (!supabaseUrl) {
    return missingConfigResponse();
  }
  const url = `${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`;
  return fetchJson(url, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ category_id: toCategory })
  });
}

export async function deleteTransactionById(transactionId: string) {
  if (!supabaseUrl) {
    return missingConfigResponse();
  }
  const url = `${supabaseUrl}/rest/v1/transactions?id=eq.${transactionId}`;
  return fetchJson(url, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal'
    }
  });
}
