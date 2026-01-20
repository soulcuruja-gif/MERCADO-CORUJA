import { Product, Category, Expense, Sale, PaymentMethod, ExpenseType, Customer } from './types.ts';

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Arroz 5kg', category: Category.ALIMENTOS, costPrice: 18.50, salePrice: 24.90, stock: 45, minStock: 10 },
  { id: '2', name: 'Feijão Carioca 1kg', category: Category.ALIMENTOS, costPrice: 4.20, salePrice: 7.50, stock: 12, minStock: 15 },
  { id: '3', name: 'Coca-Cola 2L', category: Category.BEBIDAS, costPrice: 6.80, salePrice: 11.00, stock: 30, minStock: 12 },
  { id: '4', name: 'Sabão em Pó 1kg', category: Category.LIMPEZA, costPrice: 9.50, salePrice: 15.90, stock: 8, minStock: 10 },
  { id: '5', name: 'Papel Higiênico 12un', category: Category.HIGIENE, costPrice: 12.00, salePrice: 22.00, stock: 25, minStock: 5 },
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'e1', date: '2024-05-01', dueDate: '2024-06-05', description: 'Aluguel do Ponto', amount: 1500, type: ExpenseType.FIXA, isPaid: true },
  { id: 'e2', date: '2024-05-05', dueDate: '2024-06-10', description: 'Energia Elétrica', amount: 450.50, type: ExpenseType.FIXA, isPaid: false },
  { id: 'e3', date: '2024-05-10', dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], description: 'Fornecedor Ambev', amount: 1200.00, type: ExpenseType.ESTOQUE, isPaid: false },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'João Silva', phone: '(11) 98765-4321', creditLimit: 500.00, currentDebt: 150.00, totalPaid: 50.00 },
  { id: 'c2', name: 'Maria Souza', phone: '(11) 91234-5678', creditLimit: 300.00, currentDebt: 0.00, totalPaid: 120.00 },
  { id: 'c3', name: 'José Oliveira', phone: '(11) 99887-7665', creditLimit: 1000.00, currentDebt: 750.00, totalPaid: 300.00 },
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 's1',
    date: '2024-05-15T10:30:00',
    items: [{ productId: '1', name: 'Arroz 5kg', quantity: 1, price: 24.90, cost: 18.50 }],
    total: 24.90,
    totalCost: 18.50,
    profit: 6.40,
    paymentMethod: PaymentMethod.DINHEIRO
  },
  {
    id: 's2',
    date: '2024-05-15T14:20:00',
    items: [
      { productId: '3', name: 'Coca-Cola 2L', quantity: 2, price: 22.00, cost: 13.60 },
      { productId: '4', name: 'Sabão em Pó 1kg', quantity: 1, price: 15.90, cost: 9.50 }
    ],
    total: 37.90,
    totalCost: 23.10,
    profit: 14.80,
    paymentMethod: PaymentMethod.PIX
  }
];