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

export class ItemsService {
  async getItems(): Promise<Item[]> {
    try {
      const response = await fetch('/api/items');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch items:', error);
      throw error;
    }
  }
}