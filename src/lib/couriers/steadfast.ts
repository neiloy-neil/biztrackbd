export class SteadfastClient {
  private apiKey: string
  private secretKey: string
  private baseUrl = 'https://portal.steadfast.com.bd/api/v1'

  constructor(apiKey: string, secretKey: string) {
    this.apiKey = apiKey
    this.secretKey = secretKey
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Api-Key': this.apiKey,
        'Secret-Key': this.secretKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Steadfast API Error: ${errorData.message || response.statusText}`)
    }

    return response.json()
  }

  async createOrder(payload: {
    invoice: string
    recipient_name: string
    recipient_phone: string
    recipient_address: string
    cod_amount: number
    note?: string
  }) {
    // Steadfast API requires invoice, recipient_name, recipient_phone, recipient_address, cod_amount
    return this.fetchApi('/create_order', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getStatus(consignmentId: string) {
    return this.fetchApi(`/status_by_cid/${consignmentId}`)
  }
}
