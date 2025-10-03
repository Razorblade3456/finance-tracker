export type CategoryKey =
  | 'income'
  | 'financial-obligations'
  | 'lifestyle-recurring'
  | 'personal-family'
  | 'savings-investments'
  | 'miscellaneous';

export type TransactionCadence =
  | 'Weekly'
  | 'Bi-weekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Annual'
  | 'One-time';

export type TransactionFlow = 'Expense' | 'Income' | 'Savings';

export interface Transaction {
  id: string;
  label: string;
  amount: number;
  cadence: TransactionCadence;
  flow: TransactionFlow;
  note?: string;
  createdAt: string;
}

export interface Category {
  id: CategoryKey;
  name: string;
  accent: string;
  description: string;
  transactions: Transaction[];
}

export interface PinNote {
  id: string;
  label: string;
  detail: string;
  accent: string;
}
