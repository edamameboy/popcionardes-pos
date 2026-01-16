import Dexie, { Table } from 'dexie';

// Interface Transaksi
export interface OfflineTransaction {
  id?: number;
  cart: any[];
  total: number;
  paymentMethod: string;
  location: string;
  proofFiles: Blob[]; // Blob karena file gambar disimpan di indexedDB
  discountType: string;
  discountValue: number;
  userId: string;
  createdAt: number;
}

// Interface Produk (Ini yang sebelumnya hilang/kurang)
export interface OfflineProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  description: string | null;
  category: string;
}

class POSDatabase extends Dexie {
  // Definisi Type Table
  transactions!: Table<OfflineTransaction>;
  products!: Table<OfflineProduct>; 

  constructor() {
    super('PopcionardesPOS');
    
    // PENTING: Versi dinaikkan ke 2 agar tabel 'products' dibuat
    this.version(2).stores({
      transactions: '++id, createdAt', 
      products: 'id, name, barcode, description' // Schema pencarian
    });
  }
}

export const db = new POSDatabase();