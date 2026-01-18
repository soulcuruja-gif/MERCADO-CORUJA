
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Receipt, 
  TrendingUp, 
  Menu, 
  X, 
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  Camera,
  RefreshCw,
  Check,
  Percent,
  Wallet,
  Smartphone,
  CreditCard,
  Banknote,
  Users,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  UserPlus,
  ArrowRight,
  HandCoins,
  Filter,
  ChevronDown,
  Edit2,
  History,
  Undo2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';

import { Product, Sale, Expense, View, Category, SaleItem, ScannedProduct, PaymentMethod, ExpenseType, Customer } from './types';
import { INITIAL_PRODUCTS, INITIAL_EXPENSES, INITIAL_SALES, INITIAL_CUSTOMERS } from './constants';
import { getBusinessInsights, extractProductsFromInvoice, identifyProductFromImage, extractExpenseFromInvoice } from './services/geminiService';

// --- Sub-components (Helpers) ---

const SidebarItem: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, trend?: string, trendUp?: boolean }> = ({ 
  title, value, icon, trend, trendUp 
}) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
    <div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
      {trend && (
        <span className={`text-xs font-semibold mt-2 inline-block px-2 py-0.5 rounded ${trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {trend}
        </span>
      )}
    </div>
    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
      {icon}
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [sales, setSales] = useState<Sale[]>(INITIAL_SALES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Filters State
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [competency, setCompetency] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Settings
  const [defaultMargin, setDefaultMargin] = useState(35);

  // AI State
  const [aiInsights, setAiInsights] = useState<string>("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedProduct[]>([]);
  
  // Expense Scan
  const [isExpenseScanning, setIsExpenseScanning] = useState(false);
  const [expenseScanLoading, setExpenseScanLoading] = useState(false);

  // POS Scanning
  const [isPOSScanning, setIsPOSScanning] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Payment Selection
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PaymentMethod.DINHEIRO);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // Expense Management
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<ExpenseType | 'TODAS'>('TODAS');
  const [newExpense, setNewExpense] = useState({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Customer Management
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', creditLimit: 0 });

  // History Tab (within Sales)
  const [showSalesHistory, setShowSalesHistory] = useState(false);

  // Filtered Data Computation
  const filteredSales = useMemo(() => {
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');
    return sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
  }, [sales, filterStartDate, filterEndDate]);

  const filteredExpensesForDashboard = useMemo(() => {
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');
    return expenses.filter(e => {
      const d = new Date(e.dueDate);
      return d >= start && d <= end;
    });
  }, [expenses, filterStartDate, filterEndDate]);

  // Notifications logic (Bills due in 1 day)
  const billsDueSoon = expenses.filter(e => {
    if (e.isPaid) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(e.dueDate + 'T00:00:00');
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 1;
  });

  // Cart State (for POS)
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchAIInsights = useCallback(async () => {
    setIsLoadingAI(true);
    const insights = await getBusinessInsights(products, filteredSales, filteredExpensesForDashboard);
    setAiInsights(insights || "Nenhum insight disponível para este período.");
    setIsLoadingAI(false);
  }, [products, filteredSales, filteredExpensesForDashboard]);

  useEffect(() => {
    if (activeView === 'dashboard' || activeView === 'reports') {
      fetchAIInsights();
    }
  }, [activeView, fetchAIInsights]);

  // Handler for competency change
  const handleCompetencyChange = (val: string) => {
    setCompetency(val);
    const [year, month] = val.split('-').map(Number);
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  // Dashboard Calculations based on filtered data
  const totalSales = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const paidExpenses = filteredExpensesForDashboard.filter(e => e.isPaid).reduce((acc, e) => acc + e.amount, 0);
  const pendingExpenses = filteredExpensesForDashboard.filter(e => !e.isPaid).reduce((acc, e) => acc + e.amount, 0);
  const totalOutstandingDebt = customers.reduce((acc, c) => acc + c.currentDebt, 0);
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  const calculateMonthlyRotation = (productId: string) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return sales.reduce((total, sale) => {
      if (new Date(sale.date) >= thirtyDaysAgo) {
        const item = sale.items.find(i => i.productId === productId);
        return total + (item?.quantity || 0);
      }
      return total;
    }, 0);
  };

  const paymentBreakdown = filteredSales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
    return acc;
  }, {} as Record<string, number>);

  const paymentData = Object.entries(paymentBreakdown).map(([name, value]) => ({ name, value }));

  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredSales.forEach(s => {
      const dateStr = new Date(s.date).toLocaleDateString('pt-BR');
      grouped[dateStr] = (grouped[dateStr] || 0) + s.total;
    });
    return Object.entries(grouped)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        return new Date(ya, ma-1, da).getTime() - new Date(yb, mb-1, db).getTime();
      });
  }, [filteredSales]);

  // General Camera Access
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      return true;
    } catch (err) {
      alert("Câmera indisponível.");
      return false;
    }
  };

  // Inventory Scan
  const startScanner = async () => {
    setIsScanning(true);
    setScannedResults([]);
    await startCamera();
  };

  const capturePhotoNF = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    stopCamera();
    try {
      const extracted = await extractProductsFromInvoice(base64Image);
      setScannedResults(extracted);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setScanLoading(false);
    }
  };

  // Expense Scan
  const startExpenseScanner = async () => {
    setIsExpenseScanning(true);
    await startCamera();
  };

  const captureExpensePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setExpenseScanLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    stopCamera();
    try {
      const extracted = await extractExpenseFromInvoice(base64Image);
      setNewExpense({
        description: extracted.description,
        amount: extracted.amount,
        dueDate: extracted.dueDate,
        type: extracted.type
      });
      setIsExpenseScanning(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExpenseScanLoading(false);
    }
  };

  // POS Scanning
  const startPOSScanner = async () => {
    setIsPOSScanning(true);
    setPendingProduct(null);
    await startCamera();
  };

  const capturePOSPhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setPosLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    try {
      const product = await identifyProductFromImage(base64Image, products);
      if (product) setPendingProduct(product);
      else alert("Produto não reconhecido.");
    } catch (err) {
      alert("Erro ao identificar produto.");
    } finally {
      setPosLoading(false);
    }
  };

  const confirmPOSInclusion = () => {
    if (pendingProduct) {
      addToCart(pendingProduct);
      setPendingProduct(null);
    }
  };

  const confirmImport = () => {
    setProducts(prev => {
      const updated = [...prev];
      let totalValue = 0;
      scannedResults.forEach(item => {
        const existingIndex = updated.findIndex(p => p.name.toLowerCase() === item.name.toLowerCase());
        const suggestedSalePrice = item.costPrice * (1 + defaultMargin / 100);
        totalValue += (item.costPrice * item.quantity);
        if (existingIndex > -1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            stock: updated[existingIndex].stock + item.quantity,
            costPrice: item.costPrice,
            salePrice: Math.max(updated[existingIndex].salePrice, suggestedSalePrice),
            lastUpdated: new Date().toISOString()
          };
        } else {
          updated.push({
            id: `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name,
            category: (item.category as Category) || Category.OUTROS,
            costPrice: item.costPrice,
            salePrice: suggestedSalePrice,
            stock: item.quantity,
            minStock: 5,
            lastUpdated: new Date().toISOString()
          });
        }
      });
      
      if (confirm(`Deseja registrar uma despesa de R$ ${totalValue.toFixed(2)} referente a este estoque?`)) {
         const expense: Expense = {
           id: `e${Date.now()}`,
           date: new Date().toISOString(),
           dueDate: new Date().toISOString().split('T')[0],
           description: `Estoque: NF ${new Date().toLocaleDateString()}`,
           amount: totalValue,
           type: ExpenseType.ESTOQUE,
           isPaid: false
         };
         setExpenses(e => [expense, ...e]);
      }

      return updated;
    });
    setIsScanning(false);
    setScannedResults([]);
  };

  // Handlers
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert("Produto sem estoque!");
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.salePrice, cost: product.costPrice }];
    });
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.productId !== productId));

  const finalizeSale = () => {
    if (cart.length === 0) return;
    const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const totalCost = cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0);
    
    if (selectedPayment === PaymentMethod.FIADO) {
      if (!selectedCustomerId) return alert("Selecione um cliente para venda fiada.");
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer && (customer.currentDebt + total > customer.creditLimit)) {
        return alert(`Limite de crédito excedido! Limite: R$ ${customer.creditLimit.toFixed(2)} | Dívida atual: R$ ${customer.currentDebt.toFixed(2)}`);
      }
    }

    const newSale: Sale = {
      id: `s${Date.now()}`,
      date: new Date().toISOString(),
      items: [...cart],
      total,
      totalCost,
      profit: total - totalCost,
      paymentMethod: selectedPayment,
      customerId: selectedPayment === PaymentMethod.FIADO ? selectedCustomerId : undefined
    };

    if (selectedPayment === PaymentMethod.FIADO) {
      setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, currentDebt: c.currentDebt + total } : c));
    }

    setProducts(prev => prev.map(p => {
      const soldItem = cart.find(ci => ci.productId === p.id);
      return soldItem ? { ...p, stock: p.stock - soldItem.quantity } : p;
    }));

    setSales(prev => [newSale, ...prev]);
    setCart([]);
    setIsCheckoutModalOpen(false);
    setSelectedCustomerId("");
  };

  // NEW: Delete Sale Handler (Rollback stock and debt)
  const handleDeleteSale = (saleId: string) => {
    if (!confirm("Deseja realmente excluir esta venda? O estoque será devolvido e a dívida (se houver) será ajustada.")) return;
    
    const saleToDelete = sales.find(s => s.id === saleId);
    if (!saleToDelete) return;

    // 1. Revert Stock
    setProducts(prev => prev.map(p => {
      const soldItem = saleToDelete.items.find(si => si.productId === p.id);
      return soldItem ? { ...p, stock: p.stock + soldItem.quantity } : p;
    }));

    // 2. Revert Debt if Fiado
    if (saleToDelete.paymentMethod === PaymentMethod.FIADO && saleToDelete.customerId) {
      setCustomers(prev => prev.map(c => 
        c.id === saleToDelete.customerId 
          ? { ...c, currentDebt: Math.max(0, c.currentDebt - saleToDelete.total) } 
          : c
      ));
    }

    // 3. Remove Sale
    setSales(prev => prev.filter(s => s.id !== saleId));
    alert("Venda excluída e estoque estornado.");
  };

  const handleRegisterPayment = (customerId: string, amount: number) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        const reduction = Math.min(c.currentDebt, amount);
        return {
          ...c,
          currentDebt: c.currentDebt - reduction,
          totalPaid: c.totalPaid + reduction
        };
      }
      return c;
    }));
    alert("Pagamento registrado com sucesso!");
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name || newCustomer.creditLimit <= 0) return alert("Dados inválidos.");
    const customer: Customer = {
      id: `c${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      creditLimit: newCustomer.creditLimit,
      currentDebt: 0,
      totalPaid: 0
    };
    setCustomers(prev => [...prev, customer]);
    setNewCustomer({ name: '', phone: '', creditLimit: 0 });
    setIsCustomerModalOpen(false);
  };

  const toggleExpensePaid = (id: string) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, isPaid: !e.isPaid } : e));
  };

  // NEW: Delete Expense Handler
  const handleDeleteExpense = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta despesa?")) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (editingExpenseId === id) {
        setEditingExpenseId(null);
        setNewExpense({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });
      }
    }
  };

  // NEW: Edit Expense Handler (Load data into form)
  const handleEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setNewExpense({
      description: expense.description,
      amount: expense.amount,
      dueDate: expense.dueDate,
      type: expense.type
    });
    // Scroll to form if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddOrUpdateExpense = () => {
    if (!newExpense.description || newExpense.amount <= 0 || !newExpense.dueDate) return alert("Preencha todos os campos.");
    
    if (editingExpenseId) {
      setExpenses(prev => prev.map(e => e.id === editingExpenseId ? {
        ...e,
        description: newExpense.description,
        amount: newExpense.amount,
        dueDate: newExpense.dueDate,
        type: newExpense.type
      } : e));
      setEditingExpenseId(null);
      alert("Despesa atualizada!");
    } else {
      const expense: Expense = {
        id: `e${Date.now()}`,
        date: new Date().toISOString(),
        dueDate: newExpense.dueDate,
        description: newExpense.description,
        amount: newExpense.amount,
        type: newExpense.type,
        isPaid: false
      };
      setExpenses(prev => [expense, ...prev]);
      alert("Nova despesa registrada!");
    }
    setNewExpense({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });
  };

  const COLORS_PAYMENT: Record<string, string> = { 'PIX': '#10b981', 'Dinheiro': '#f59e0b', 'Fiado': '#ef4444', 'Crédito': '#4f46e5', 'Débito': '#8b5cf6' };

  const filteredExpenses = expenses.filter(e => expenseTypeFilter === 'TODAS' || e.type === expenseTypeFilter);

  const monthOptions = useMemo(() => {
    const options = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const val = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ val, label });
    }
    return options;
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-100 transform transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><ShoppingCart size={20} /></div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight text-nowrap">MarketMaster</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400"><X size={20} /></button>
        </div>
        <nav className="px-4 mt-6 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
          <SidebarItem icon={<ShoppingCart size={20} />} label="PDV" active={activeView === 'pos'} onClick={() => setActiveView('pos')} />
          <SidebarItem icon={<Package size={20} />} label="Estoque" active={activeView === 'inventory'} onClick={() => setActiveView('inventory')} />
          <SidebarItem icon={<Receipt size={20} />} label="Despesas" active={activeView === 'expenses'} onClick={() => setActiveView('expenses')} />
          <SidebarItem icon={<Users size={20} />} label="Fiados" active={activeView === 'customers'} onClick={() => setActiveView('customers')} />
          <SidebarItem icon={<TrendingUp size={20} />} label="Relatórios" active={activeView === 'reports'} onClick={() => setActiveView('reports')} />
        </nav>
      </aside>

      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : ''}`}>
        <header className="bg-white h-16 border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-100 rounded-lg"><Menu size={20}/></button>}
            <h2 className="text-lg font-semibold text-slate-700 capitalize">
              {activeView === 'pos' ? 'PDV Inteligente' : activeView === 'customers' ? 'Controle de Fiados' : activeView}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
             {billsDueSoon.length > 0 && (
               <div className="animate-pulse bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 flex items-center">
                 <Bell size={14} className="mr-1" />
                 {billsDueSoon.length} alertas financeiras
               </div>
             )}
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 shadow-sm">A</div>
          </div>
        </header>

        <div className="p-8">
          
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Filter size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mês / Competência</p>
                    <select 
                      value={competency} 
                      onChange={(e) => handleCompetencyChange(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-sm"
                    >
                      {monthOptions.map(opt => (
                        <option key={opt.val} value={opt.val}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-100 hidden md:block"></div>

                <div className="flex items-center space-x-3">
                  <Calendar size={18} className="text-slate-400" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período Customizado</p>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="date" 
                        value={filterStartDate} 
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="bg-transparent font-semibold text-slate-700 focus:outline-none text-xs"
                      />
                      <span className="text-slate-300">até</span>
                      <input 
                        type="date" 
                        value={filterEndDate} 
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="bg-transparent font-semibold text-slate-700 focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1"></div>

                {isLoadingAI && (
                  <div className="flex items-center text-indigo-600 text-xs font-bold animate-pulse">
                    <RefreshCw size={14} className="mr-2 animate-spin" />
                    Sincronizando IA...
                  </div>
                )}
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Vendas Brutas" 
                  value={`R$ ${totalSales.toFixed(2)}`} 
                  icon={<TrendingUp size={24} />} 
                  trend={`${filteredSales.length} transações`} 
                  trendUp={true}
                />
                <StatCard 
                  title="Total Fiado" 
                  value={`R$ ${totalOutstandingDebt.toFixed(2)}`} 
                  icon={<Users size={24} />} 
                  trend="Dívida global"
                />
                <StatCard 
                  title="Despesas Pendentes" 
                  value={`R$ ${pendingExpenses.toFixed(2)}`} 
                  icon={<Receipt size={24} />} 
                  trend="Neste período"
                />
                <StatCard 
                  title="Giro de Caixa" 
                  value={`R$ ${(totalSales - paidExpenses).toFixed(2)}`} 
                  icon={<HandCoins size={24} />} 
                  trendUp={totalSales > paidExpenses}
                />
              </div>

              {/* Alert for bills due soon */}
              {billsDueSoon.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 text-rose-700">
                    <AlertTriangle size={20}/>
                    <div>
                      <p className="font-bold text-sm">Alerta de Pagamento</p>
                      <p className="text-xs">{billsDueSoon.length} despesa(s) vencem hoje ou amanhã.</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveView('expenses')} className="text-xs font-bold bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-colors">Resolver Agora</button>
                </div>
              )}

              {/* Sales History List */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 flex items-center">
                    <History size={18} className="mr-2 text-indigo-600" /> Histórico de Vendas Recentes
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{filteredSales.length} Registradas</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="pb-4">Data/Hora</th>
                        <th className="pb-4">Itens</th>
                        <th className="pb-4">Método</th>
                        <th className="pb-4 text-right">Total</th>
                        <th className="pb-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredSales.slice(0, 5).map(sale => (
                        <tr key={sale.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-xs font-medium text-slate-600">
                            {new Date(sale.date).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 text-xs text-slate-500 font-medium">
                            {sale.items.length} itens: {sale.items.map(i => i.name).join(', ').substring(0, 30)}...
                          </td>
                          <td className="py-3">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${sale.paymentMethod === PaymentMethod.FIADO ? 'border-rose-200 text-rose-600 bg-rose-50' : 'border-indigo-100 text-indigo-600 bg-indigo-50'}`}>
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 text-right font-black text-slate-800 text-sm">
                            R$ {sale.total.toFixed(2)}
                          </td>
                          <td className="py-3 text-center">
                            <button 
                              onClick={() => handleDeleteSale(sale.id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                              title="Excluir Venda (Estornar)"
                            >
                              <Undo2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSales.length === 0 && <p className="text-center py-6 text-slate-300 text-xs italic">Nenhuma venda encontrada no período.</p>}
                </div>
              </div>

              {/* Visualizations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Daily Trend Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold text-slate-800">Tendência Diária de Faturamento</h3>
                     <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{competency}</div>
                   </div>
                   <div className="h-64">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fill: '#94a3b8'}}
                              minTickGap={10}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                              formatter={(v: number) => `R$ ${v.toFixed(2)}`}
                            />
                            <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                          <TrendingUp size={40} className="opacity-10 mb-2"/>
                          <p className="text-sm font-medium">Sem dados para este período</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* Gemini Insights */}
                <div className="bg-indigo-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                   <div className="absolute top-[-20px] right-[-20px] p-10 opacity-10 rotate-12">
                     <TrendingUp size={160}/>
                   </div>
                   <div>
                     <div className="flex items-center space-x-2 mb-6">
                       <div className="bg-indigo-600 p-2 rounded-lg">
                         <Bell size={20} className="text-indigo-200" />
                       </div>
                       <h3 className="font-black text-xl tracking-tight">Análise Preditiva IA</h3>
                     </div>
                     <p className="italic text-indigo-100 text-sm leading-relaxed mb-6">
                       {isLoadingAI ? "Refinando sua estratégia financeira..." : (aiInsights || "Sincronizando com tendências do mercado local...")}
                     </p>
                   </div>
                   <button 
                    onClick={() => setActiveView('reports')}
                    className="flex items-center text-xs font-black uppercase tracking-widest text-indigo-300 hover:text-white transition-colors group"
                   >
                     Detalhamento Estratégico <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform"/>
                   </button>
                </div>
              </div>
            </div>
          )}

          {/* POS View */}
          {activeView === 'pos' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" placeholder="Procurar produto..." className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <button onClick={startPOSScanner} className="bg-indigo-600 text-white px-6 rounded-xl flex items-center space-x-2 font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"><Camera size={20} /><span>FOTO</span></button>
                </div>
                {isPOSScanning && (
                   <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative group border-4 border-slate-800">
                     <video ref={videoRef} className="w-full h-full object-cover" />
                     <canvas ref={canvasRef} className="hidden" />
                     <div className="absolute inset-0 border-2 border-indigo-400/30 m-12 rounded-2xl pointer-events-none"></div>
                     {posLoading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white"><RefreshCw className="animate-spin mr-3" />RECONHECENDO...</div>}
                     {!posLoading && !pendingProduct && <button onClick={capturePOSPhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-indigo-600 shadow-2xl active:scale-90 transition-all"><Camera className="text-indigo-600" size={32} /></button>}
                     {pendingProduct && (
                       <div className="absolute inset-x-0 bottom-0 bg-white p-6 rounded-t-3xl shadow-2xl z-20 animate-in slide-in-from-bottom duration-300">
                         <div className="flex justify-between items-center mb-6">
                           <div>
                             <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{pendingProduct.category}</span>
                             <h3 className="text-xl font-black text-slate-800 leading-tight">{pendingProduct.name}</h3>
                           </div>
                           <span className="text-3xl font-black text-indigo-600">R$ {pendingProduct.salePrice.toFixed(2)}</span>
                         </div>
                         <div className="flex space-x-3">
                           <button onClick={() => setPendingProduct(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200">CANCELAR</button>
                           <button onClick={confirmPOSInclusion} className="flex-2 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg">ADICIONAR À SACOLA</button>
                         </div>
                       </div>
                     )}
                     <button onClick={() => { stopCamera(); setIsPOSScanning(false); }} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white hover:bg-white/40"><X size={20}/></button>
                   </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                    <button key={product.id} onClick={() => addToCart(product)} className={`bg-white p-4 rounded-2xl border text-left hover:border-indigo-300 transition-all group ${product.stock <= 0 ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <h4 className="font-bold text-slate-800 truncate group-hover:text-indigo-600">{product.name}</h4>
                      <p className="text-xl font-black text-slate-900 mt-1">R$ {product.salePrice.toFixed(2)}</p>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Estoque: {product.stock}</span>
                        <div className="bg-indigo-50 text-indigo-600 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14}/></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
                <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-lg text-slate-800">Sacola Atual</h3>
                  <div className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-full">{cart.length} ITENS</div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                       <div className="bg-slate-50 p-6 rounded-full"><ShoppingCart size={48} className="opacity-10"/></div>
                       <p className="text-sm font-medium">Nenhum produto adicionado</p>
                    </div>
                  ) : cart.map(item => (
                    <div key={item.productId} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group animate-in slide-in-from-right duration-200">
                      <div className="flex-1">
                        <p className="font-bold text-sm leading-tight text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.quantity}un x R$ {item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-black text-indigo-700">R$ {(item.quantity * item.price).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(item.productId)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-8 border-t bg-slate-50">
                  <div className="flex justify-between text-3xl font-black mb-6">
                    <span className="text-slate-400 text-sm font-bold uppercase self-center">Total</span>
                    <span className="text-indigo-600">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => setIsCheckoutModalOpen(true)} 
                    disabled={cart.length === 0} 
                    className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-200 transition-all active:scale-95"
                  >
                    FECHAR VENDA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Expenses View - UPDATED WITH EDIT AND DELETE */}
          {activeView === 'expenses' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                   <div className="flex items-center justify-between">
                     <h3 className="font-black text-slate-800">{editingExpenseId ? 'Editar Despesa' : 'Novo Lançamento'}</h3>
                     {!editingExpenseId && (
                       <button onClick={startExpenseScanner} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Camera size={20}/></button>
                     )}
                   </div>
                   
                   {isExpenseScanning && (
                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                       <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
                         <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg">Escanear Conta / Fatura</h3><button onClick={() => { stopCamera(); setIsExpenseScanning(false); }} className="text-slate-400 hover:text-rose-500"><X/></button></div>
                         <div className="relative aspect-video bg-slate-900">
                           <video ref={videoRef} className="w-full h-full object-cover" />
                           <canvas ref={canvasRef} className="hidden" />
                           {expenseScanLoading && <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white space-y-4"><RefreshCw className="animate-spin" size={40}/> <span className="font-black tracking-widest text-[10px] uppercase">Lendo Dados Financeiros...</span></div>}
                           {!expenseScanLoading && <button onClick={captureExpensePhoto} className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-indigo-600 shadow-2xl animate-pulse"><Camera className="text-indigo-600"/></button>}
                         </div>
                       </div>
                     </div>
                   )}

                   <div className="space-y-4">
                     <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Descrição</label>
                       <input type="text" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="Ex: Energia de Maio" className="w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor R$</label>
                          <input type="number" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo</label>
                          <select value={newExpense.type} onChange={e => setNewExpense({...newExpense, type: e.target.value as ExpenseType})} className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold text-slate-700">
                            <option value={ExpenseType.FIXA}>Fixa</option>
                            <option value={ExpenseType.ESTOQUE}>Estoque</option>
                          </select>
                        </div>
                     </div>
                     <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Vencimento</label>
                       <input type="date" value={newExpense.dueDate} onChange={e => setNewExpense({...newExpense, dueDate: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                     </div>
                     <div className="flex space-x-2">
                        {editingExpenseId && (
                          <button onClick={() => {setEditingExpenseId(null); setNewExpense({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });}} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">CANCELAR</button>
                        )}
                        <button onClick={handleAddOrUpdateExpense} className="flex-2 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3">
                          <Plus size={20}/> 
                          <span>{editingExpenseId ? 'ATUALIZAR' : 'LANÇAR'}</span>
                        </button>
                     </div>
                   </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex space-x-2">
                       {['TODAS', ExpenseType.FIXA, ExpenseType.ESTOQUE].map(t => (
                         <button key={t} onClick={() => setExpenseTypeFilter(t as any)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all shadow-sm ${expenseTypeFilter === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-100 hover:border-indigo-200'}`}>{t}</button>
                       ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b">
                          <tr><th className="p-6">Vencimento</th><th className="p-6">Descrição</th><th className="p-6">Tipo</th><th className="p-6 text-right">Valor</th><th className="p-6 text-center">Status / Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredExpenses.map(expense => {
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const dueDate = new Date(expense.dueDate + 'T00:00:00');
                            const isLate = !expense.isPaid && dueDate < today;
                            const isDueToday = !expense.isPaid && dueDate.getTime() === today.getTime();
                            
                            return (
                              <tr key={expense.id} className={`hover:bg-slate-50/50 transition-colors ${isLate ? 'bg-rose-50/20' : isDueToday ? 'bg-amber-50/20' : ''} ${editingExpenseId === expense.id ? 'bg-indigo-50/30 ring-2 ring-indigo-200 ring-inset' : ''}`}>
                                <td className="p-6">
                                  <div className="flex items-center space-x-2">
                                    <Calendar size={14} className={isLate ? 'text-rose-500' : 'text-slate-300'}/>
                                    <span className={`text-sm font-black ${isLate ? 'text-rose-600' : 'text-slate-600'}`}>
                                      {new Date(expense.dueDate).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-6">
                                  <p className="font-black text-slate-800 text-sm">{expense.description}</p>
                                </td>
                                <td className="p-6">
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${expense.type === ExpenseType.FIXA ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                    {expense.type}
                                  </span>
                                </td>
                                <td className="p-6 text-right font-black text-slate-900">R$ {expense.amount.toFixed(2)}</td>
                                <td className="p-6">
                                  <div className="flex items-center justify-center space-x-3">
                                    <button 
                                      onClick={() => toggleExpensePaid(expense.id)} 
                                      className={`p-2.5 rounded-xl transition-all shadow-sm ${expense.isPaid ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-slate-300 hover:text-emerald-600 bg-white border border-slate-100'}`}
                                      title="Marcar como Paga"
                                    >
                                      <Check size={16} strokeWidth={3}/>
                                    </button>
                                    <button 
                                      onClick={() => handleEditExpense(expense)}
                                      className="p-2.5 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                      title="Editar"
                                    >
                                      <Edit2 size={16}/>
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteExpense(expense.id)}
                                      className="p-2.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                      title="Excluir"
                                    >
                                      <Trash2 size={16}/>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredExpenses.length === 0 && <p className="text-center py-10 text-slate-300 italic text-sm">Nenhuma despesa para o filtro selecionado.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checkout Modal (Customer Selection for Fiado) */}
          {isCheckoutModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in duration-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-slate-800">Pagamento</h3>
                  <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-400"><X/></button>
                </div>
                
                <div className="bg-indigo-50 p-6 rounded-2xl flex justify-between items-center border border-indigo-100">
                   <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">A Receber</span>
                   <span className="text-3xl font-black text-indigo-600">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                </div>
                
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione o Método</p>
                   <div className="grid grid-cols-2 gap-3">
                    {[PaymentMethod.DINHEIRO, PaymentMethod.PIX, PaymentMethod.CREDITO, PaymentMethod.DEBITO, PaymentMethod.FIADO].map(m => (
                      <button 
                        key={m} 
                        onClick={() => { setSelectedPayment(m); if(m !== PaymentMethod.FIADO) setSelectedCustomerId(""); }} 
                        className={`p-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center space-y-2 transition-all ${selectedPayment === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
                      >
                        {m === PaymentMethod.PIX && <Smartphone size={18} className="text-emerald-500"/>}
                        {m === PaymentMethod.DINHEIRO && <Banknote size={18} className="text-amber-500"/>}
                        {m === PaymentMethod.FIADO && <Users size={18} className="text-rose-500"/>}
                        {m.includes('Crédito') && <CreditCard size={18} className="text-indigo-500"/>}
                        {m.includes('Débito') && <CreditCard size={18} className="text-indigo-400"/>}
                        <span>{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPayment === PaymentMethod.FIADO && (
                  <div className="animate-in fade-in slide-in-from-top-4 space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                      <Users size={12} className="mr-2"/> Selecionar Cliente Fiado
                    </p>
                    <select 
                      value={selectedCustomerId} 
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm shadow-sm"
                    >
                      <option value="">-- Escolha um Cliente --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Débito: R$ {c.currentDebt.toFixed(2)})
                        </option>
                      ))}
                    </select>
                    {selectedCustomerId && (
                       <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                         <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Crédito Disponível</p>
                            <p className="text-sm font-black text-indigo-600">
                              R$ {(customers.find(c => c.id === selectedCustomerId)?.creditLimit || 0) - (customers.find(c => c.id === selectedCustomerId)?.currentDebt || 0)}
                            </p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Limite Total</p>
                            <p className="text-sm font-bold text-slate-600">R$ {customers.find(c => c.id === selectedCustomerId)?.creditLimit.toFixed(2)}</p>
                         </div>
                       </div>
                    )}
                  </div>
                )}

                <button 
                  onClick={finalizeSale} 
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <CheckCircle2 size={24} />
                  <span>CONCLUIR RECEBIMENTO</span>
                </button>
              </div>
            </div>
          )}

          {/* Remaining Views remain unchanged (Inventory, Reports, Customers) for consistency */}
          {activeView === 'inventory' && (
             <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Percent size={18} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Markup Automático</p>
                    <div className="flex items-center space-x-3">
                      <input type="range" min="10" max="150" value={defaultMargin} onChange={(e) => setDefaultMargin(Number(e.target.value))} className="w-24 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      <span className="font-black text-sm text-indigo-700">{defaultMargin}%</span>
                    </div>
                  </div>
                </div>
                <button onClick={startScanner} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-lg hover:bg-indigo-700 transition-all"><Camera className="mr-3"/> ESCANEAR NOTA FISCAL</button>
              </div>

              {isScanning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                  <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
                    <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black text-slate-800">Importação por Visão Computacional</h3><button onClick={() => { stopCamera(); setIsScanning(false); }} className="text-slate-400 hover:text-rose-500"><X/></button></div>
                    <div className="relative aspect-video bg-slate-900">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      {scanLoading && <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white space-y-4"><RefreshCw className="animate-spin" size={40}/> <span className="font-black tracking-widest text-xs uppercase">Processando Nota Fiscal...</span></div>}
                      {!scanLoading && !scannedResults.length && <button onClick={capturePhotoNF} className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-indigo-600 shadow-2xl animate-bounce"><Camera className="text-indigo-600"/></button>}
                    </div>
                    {scannedResults.length > 0 && (
                      <div className="p-6 space-y-4 overflow-y-auto max-h-96 bg-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Produtos Detectados</p>
                        {scannedResults.map((it, ix) => (
                          <div key={ix} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                            <div className="flex-1"><p className="font-bold text-slate-800">{it.name}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{it.quantity}un • R$ {it.costPrice.toFixed(2)} custo un.</p></div>
                            <div className="text-right">
                               <p className="font-black text-indigo-600">R$ {(it.costPrice * (1 + defaultMargin/100)).toFixed(2)}</p>
                               <span className="text-[9px] font-black text-slate-300 uppercase">Sugestão de Venda</span>
                            </div>
                          </div>
                        ))}
                        <button onClick={confirmImport} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center space-x-3"><Check size={24}/> <span>IMPORTAR PRODUTOS</span></button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                    <tr><th className="p-6">Produto / Categoria</th><th className="p-6 text-center">Nível Estoque</th><th className="p-6 text-center">Giro (30d)</th><th className="p-6 text-right">Preço Venda</th><th className="p-6 text-right">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6"><div className="font-black text-slate-800">{p.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{p.category}</div></td>
                        <td className="p-6 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${p.stock <= p.minStock ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-600'}`}>{p.stock} un</span></td>
                        <td className="p-6 text-center"><span className="text-sm font-black text-indigo-500">{calculateMonthlyRotation(p.id)}</span></td>
                        <td className="p-6 text-right font-black text-slate-900">R$ {p.salePrice.toFixed(2)}</td>
                        <td className="p-6 text-right"><button className="text-slate-300 hover:text-indigo-600 transition-all"><Plus size={20}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'customers' && (
             <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center"><Users className="mr-3 text-indigo-600"/> Gestão de Carteiras</h3>
                  <button onClick={() => setIsCustomerModalOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-lg hover:bg-indigo-700 transition-all"><UserPlus size={20} className="mr-2"/> NOVO CLIENTE</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {customers.map(customer => {
                   const debtRatio = (customer.currentDebt / customer.creditLimit) * 100;
                   return (
                     <div key={customer.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                           <div>
                             <h4 className="font-black text-lg text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{customer.name}</h4>
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{customer.phone}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Dívida Atual</p>
                             <p className={`text-2xl font-black ${customer.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>R$ {customer.currentDebt.toFixed(2)}</p>
                           </div>
                        </div>

                        <div className="space-y-2">
                           <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                             <span>Compromisso de Crédito</span>
                             <span>{debtRatio.toFixed(0)}%</span>
                           </div>
                           <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                              <div 
                                className={`h-full transition-all duration-700 ${debtRatio > 90 ? 'bg-rose-500' : debtRatio > 50 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                                style={{ width: `${Math.min(100, debtRatio)}%` }}
                              />
                           </div>
                           <div className="flex justify-between text-[10px] font-bold text-slate-400">
                             <span>Livre: R$ {(customer.creditLimit - customer.currentDebt).toFixed(2)}</span>
                             <span>Limite: R$ {customer.creditLimit.toFixed(2)}</span>
                           </div>
                        </div>

                        <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                           <div>
                             <p className="text-[9px] font-black text-slate-300 uppercase">Total já Pago</p>
                             <p className="text-sm font-black text-indigo-700">R$ {customer.totalPaid.toFixed(2)}</p>
                           </div>
                           <button 
                            onClick={() => {
                              const amount = prompt("Registrar recebimento de valor:", customer.currentDebt.toString());
                              if (amount && !isNaN(Number(amount))) handleRegisterPayment(customer.id, Number(amount));
                            }}
                            className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all flex items-center space-x-2 font-black text-xs shadow-sm"
                           >
                             <HandCoins size={18}/>
                             <span>ABATER DÍVIDA</span>
                           </button>
                        </div>
                     </div>
                   );
                 })}
               </div>
             </div>
          )}

          {activeView === 'reports' && (
             <div className="space-y-8">
                <div className="bg-slate-900 p-12 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12"><TrendingUp size={240}/></div>
                   <h3 className="text-3xl font-black mb-10 flex items-center"><CheckCircle2 className="mr-4 text-emerald-400" size={32}/> Saúde Financeira do Negócio</h3>
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
                      <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Giro Operacional</p><p className="text-4xl font-black">2.4x</p></div>
                      <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Inadimplência</p><p className="text-4xl font-black text-rose-400">{(totalOutstandingDebt / (totalSales || 1) * 100).toFixed(1)}%</p></div>
                      <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Ticket Médio</p><p className="text-4xl font-black">R$ {(totalSales / (filteredSales.length || 1)).toFixed(2)}</p></div>
                      <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Ponto de Equilíbrio</p><p className="text-4xl font-black text-emerald-400">ALCANÇADO</p></div>
                   </div>
                </div>
                <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                   <div className="flex items-center space-x-3 mb-4">
                      <div className="bg-indigo-600 p-2 rounded-xl text-white"><Percent size={20}/></div>
                      <h3 className="font-black text-slate-800 text-xl">Relatório Gemini de Precificação</h3>
                   </div>
                   <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      {aiInsights}
                   </div>
                </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
