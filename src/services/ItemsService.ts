export interface Item {
  mac_address: string;
  brand: string;
  model: string;
  serial_number: string;
  epc: string;
  image: string;
  inventory_code: string;
  category: string;
  updated_at: string;
  antenna: string;
  group_id: number;
  designation: string;
  sec: number;
  heure: string;
  updated_atposix: number;
  group: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    count?: number;
    endpoint?: string;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

export class ItemsService {
  async getItems(): Promise<Item[]> {
    try {
      const response = await fetch('/api/items');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiResponse: ApiResponse<Item[]> = await response.json();
      
      // Handle both old format (direct array) and new format (with success/data/meta)
      if (apiResponse.success !== undefined) {
        // New API format
        return apiResponse.data;
      } else {
        // Legacy format (direct array) - for backward compatibility
        return apiResponse as unknown as Item[];
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
      throw error;
    }
  }
}