const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      throw error;
    }
    return response.json();
  }

  async uploadContract(file: File, contractId: string, address?: string): Promise<{
    ok: boolean;
    contract_id: string;
    length: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contract_id', contractId);
    if (address) {
      formData.append('addr', address);
    }

    const response = await fetch(`${this.baseUrl}/ingest`, {
      method: 'POST',
      body: formData,
    });

    return this.handleResponse(response);
  }

  async analyzeContract(question: string): Promise<{
    answer: string;
  }> {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    return this.handleResponse(response);
  }
}

export const aiApi = new ApiClient(AI_API_URL);

// Next.js API Route Proxy
export async function proxyToAI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`/api/ai${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `API error: ${response.status}`,
    }));
    throw error;
  }

  return response.json();
}