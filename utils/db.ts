import Dexie, { Table } from 'dexie';

export interface OfflineTransaction {
  id?: number;
  cart: any[];
  total: number;
  paymentMethod: string;
  location: string;
  proofFiles: Blob[]; // Kita simpan File asli (Blob) di sini
  discountType: string;
  discountValue: number;
  userId: string;
  createdAt: number;
}

class POSDatabase extends Dexie {
  transactions!: Table<OfflineTransaction>;

  constructor() {
    super('PopcionardesPOS');
    // Schema database lokal
    this.version(1).stores({
      transactions: '++id, createdAt' // Primary key auto-increment
    });
  }
}

export const db = new POSDatabase();