export class PathaoClient {
  private clientId: string
  private clientSecret: string
  private username: string
  private password: string
  private baseUrl = 'https://api-hermes.pathao.com/aladdin/api/v1'

  constructor(clientId: string, clientSecret: string, username?: string, password?: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.username = username || ''
    this.password = password || ''
  }

  // To truly use Pathao, we need to generate an access_token first.
  // We'll mock the auth flow for the initial skeleton.
  private async getAccessToken() {
    // Return a mock token if no full auth flow is implemented yet
    return 'mock_pathao_token'
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAccessToken()
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Pathao API Error: ${errorData.message || response.statusText}`)
    }

    return response.json()
  }

  async createOrder(payload: {
    store_id: string
    merchant_order_id: string
    recipient_name: string
    recipient_phone: string
    recipient_address: string
    recipient_city: string
    recipient_zone: string
    delivery_type: number // 48 for Normal, 12 for Express
    item_type: number // 1 for Document, 2 for Parcel
    special_instruction?: string
    item_quantity: number
    item_weight: number
    amount_to_collect: number
  }) {
    return this.fetchApi('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}
