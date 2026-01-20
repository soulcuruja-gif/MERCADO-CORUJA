export const Category = {
  BEBIDAS: 'Bebidas',
  ALIMENTOS: 'Alimentos',
  LIMPEZA: 'Limpeza',
  HIGIENE: 'Higiene',
  OUTROS: 'Outros'
} as const;
export type Category = typeof Category[keyof typeof Category];

export const PaymentMethod = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  FIADO: 'Fiado',
  CREDITO: 'Crédito',
  DEBITO: 'Débito'
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const ExpenseType = {
  FIXA: 'Fixa',
  ESTOQUE: 'Estoque'
} as const;
export type ExpenseType = typeof ExpenseType[keyof typeof ExpenseType];

export interface Product {
  id: string;
  name: string;
  category: Category;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  lastUpdated?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  total: number;
  totalCost: number;
  profit: number;
  paymentMethod: PaymentMethod;
  customerId?: string;
}

export interface Expense {
  id: string;
  date: string;
  dueDate: string;
  description: string;
  amount: number;
  type: ExpenseType;
  isPaid: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  currentDebt: number;
  totalPaid: number;
}

export type View = 'dashboard' | 'pos' | 'inventory' | 'expenses' | 'reports' | 'customers' | 'sales_history' | 'settings';

export interface ScannedProduct {
  name: string;
  costPrice: number;
  quantity: number;
  category?: Category;
}

export interface ScannedExpense {
  description: string;
  amount: number;
  dueDate: string;
  type: ExpenseType;
}