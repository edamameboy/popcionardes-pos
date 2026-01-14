import Dexie, { Table } from 'dexie';

// Interface Transaksi (Tetap sama)
export interface OfflineTransaction {
  id?: number;
  cart: any[];
  total: number;
  paymentMethod: string;
  location: string;
  proofFiles: Blob[];
  discountType: string;
  discountValue: number;
  userId: string;
  createdAt: number;
}

// Interface Produk (BARU)
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
  transactions!: Table<OfflineTransaction>;
  products!: Table<OfflineProduct>; // <-- Tabel Baru

  constructor() {
    super('PopcionardesPOS');
    this.version(1).stores({
      transactions: '++id, createdAt',
      // Schema untuk produk: id jadi primary key, index di name & barcode biar pencarian cepat
      products: 'id, name, barcode, description' 
    });
  }
}

export const db = new POSDatabase();