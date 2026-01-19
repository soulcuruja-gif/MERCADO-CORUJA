
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
  Undo2,
  ChevronLeft,
  CalendarDays
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

  // State for Sales History View
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Settings
  const [defaultMargin, setDefaultMargin] = useState(35);

  // AI State
  const [aiInsights, setAiInsights] = useState<string>("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Modais Control
  const [isScanning, setIsScanning] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedProduct[]>([]);
  
  const [isExpenseScanning, setIsExpenseScanning] = useState(false);
  const [expenseScanLoading, setExpenseScanLoading] = useState(false);

  const [isPOSScanning, setIsPOSScanning] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  // Auxiliary Modal State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PaymentMethod.DINHEIRO);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showPOSHistory, setShowPOSHistory] = useState(false);

  // Form States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: Category.ALIMENTOS,
    costPrice: 0,
    salePrice: 0,
    stock: 0,
    minStock: 5
  });

  const [newExpense, setNewExpense] = useState({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', creditLimit: 0 });

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");

  // Memoized Filters
  const filteredSales = useMemo(() => {
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');
    return sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
  }, [sales, filterStartDate, filterEndDate]);

  const filteredExpenses = useMemo(() => {
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');
    return expenses.filter(e => {
      const d = new Date(e.dueDate);
      return d >= start && d <= end;
    });
  }, [expenses, filterStartDate, filterEndDate]);

  // Global Sales Stats for "Sales History" View (Week/Month)
  const globalStats = useMemo(() => {
    const now = new Date();
    
    // Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTotal = sales
      .filter(s => new Date(s.date) >= startOfMonth)
      .reduce((acc, s) => acc + s.total, 0);

    // Week (Starting Sunday)
    const day = now.getDay();
    const diff = now.getDate() - day;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyTotal = sales
      .filter(s => new Date(s.date) >= startOfWeek)
      .reduce((acc, s) => acc + s.total, 0);

    return { weeklyTotal, monthlyTotal };
  }, [sales]);

  // Filter sales for the specific day in Sales History view
  const historySalesForDay = useMemo(() => {
    return sales.filter(s => s.date.startsWith(selectedHistoryDate));
  }, [sales, selectedHistoryDate]);

  // FIX: Added chartData calculation to support the LineChart in the Dashboard
  const chartData = useMemo(() => {
    const dailyData: { [key: string]: number } = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyData[date] = (dailyData[date] || 0) + sale.total;
    });

    const sortedData = Object.entries(dailyData)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number);
        const [dayB, monthB] = b.date.split('/').map(Number);
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      });

    return sortedData.length > 0 ? sortedData : [{ date: '-', amount: 0 }];
  }, [filteredSales]);

  // Dash Stats
  const totalSales = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const pendingExpenses = filteredExpenses.filter(e => !e.isPaid).reduce((acc, e) => acc + e.amount, 0);
  const totalOutstandingDebt = customers.reduce((acc, c) => acc + c.currentDebt, 0);

  // Gemini Business Insights
  const fetchAIInsights = useCallback(async () => {
    setIsLoadingAI(true);
    const insights = await getBusinessInsights(products, filteredSales, filteredExpenses);
    setAiInsights(insights || "Nenhum insight disponível.");
    setIsLoadingAI(false);
  }, [products, filteredSales, filteredExpenses]);

  useEffect(() => {
    if (activeView === 'dashboard' || activeView === 'reports') {
      fetchAIInsights();
    }
  }, [activeView, fetchAIInsights]);

  // Camera logic
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Câmera bloqueada ou indisponível.");
    }
  };

  // --- Handlers: Inventory ---
  const handleSaveProduct = () => {
    if (!newProduct.name || newProduct.costPrice < 0) return alert("Dados inválidos.");
    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...newProduct } : p));
    } else {
      setProducts(prev => [{ id: `p${Date.now()}`, ...newProduct }, ...prev]);
    }
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setNewProduct({ name: '', category: Category.ALIMENTOS, costPrice: 0, salePrice: 0, stock: 0, minStock: 5 });
  };

  const deleteProduct = (id: string) => {
    if (confirm("Excluir produto definitivamente?")) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  // --- Handlers: Sales & POS ---
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert("Produto esgotado!");
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.salePrice, cost: product.costPrice }];
    });
  };

  const finalizeSale = () => {
    if (cart.length === 0) return;
    const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const totalCost = cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0);
    
    if (selectedPayment === PaymentMethod.FIADO) {
      if (!selectedCustomerId) return alert("Selecione um cliente.");
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer && (customer.currentDebt + total > customer.creditLimit)) {
        return alert("Limite de crédito excedido!");
      }
      setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, currentDebt: Number((c.currentDebt + total).toFixed(2)) } : c));
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

    setProducts(prev => prev.map(p => {
      const soldItem = cart.find(ci => ci.productId === p.id);
      return soldItem ? { ...p, stock: p.stock - soldItem.quantity } : p;
    }));

    setSales(prev => [newSale, ...prev]);
    setCart([]);
    setIsCheckoutModalOpen(false);
    alert("Venda realizada!");
  };

  const handleDeleteSale = (id: string) => {
    if (!confirm("Estornar esta venda e devolver itens ao estoque?")) return;
    const sale = sales.find(s => s.id === id);
    if (sale) {
      setProducts(prev => prev.map(p => {
        const item = sale.items.find(si => si.productId === p.id);
        return item ? { ...p, stock: p.stock + item.quantity } : p;
      }));
      if (sale.paymentMethod === PaymentMethod.FIADO && sale.customerId) {
        setCustomers(prev => prev.map(c => c.id === sale.customerId ? { ...c, currentDebt: Math.max(0, Number((c.currentDebt - sale.total).toFixed(2))) } : c));
      }
    }
    setSales(prev => prev.filter(s => s.id !== id));
  };

  // --- Handlers: Fiados (Customers) ---
  const handleRegisterPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!selectedCustomerForPayment || isNaN(amount) || amount <= 0) return alert("Informe um valor válido.");
    
    setCustomers(prev => prev.map(c => {
      if (c.id === selectedCustomerForPayment.id) {
        const reduction = Math.min(c.currentDebt, amount);
        return {
          ...c,
          currentDebt: Number((c.currentDebt - reduction).toFixed(2)),
          totalPaid: Number((c.totalPaid + reduction).toFixed(2))
        };
      }
      return c;
    }));
    
    setIsPaymentModalOpen(false);
    setPaymentAmount("");
    setSelectedCustomerForPayment(null);
    alert("Recebimento registrado!");
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name) return alert("Nome obrigatório.");
    setCustomers(prev => [{ id: `c${Date.now()}`, ...newCustomer, currentDebt: 0, totalPaid: 0 }, ...prev]);
    setIsCustomerModalOpen(false);
    setNewCustomer({ name: '', phone: '', creditLimit: 0 });
  };

  // --- Handlers: Expenses ---
  const handleAddOrUpdateExpense = () => {
    if (!newExpense.description || newExpense.amount <= 0 || !newExpense.dueDate) return alert("Preencha os campos.");
    if (editingExpenseId) {
      setExpenses(prev => prev.map(e => e.id === editingExpenseId ? { ...e, ...newExpense } : e));
      setEditingExpenseId(null);
    } else {
      setExpenses(prev => [{ id: `e${Date.now()}`, date: new Date().toISOString(), isPaid: false, ...newExpense }, ...prev]);
    }
    setNewExpense({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });
  };

  // --- Gemini Scanners ---
  const capturePhotoNF = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    stopCamera();
    try {
      const results = await extractProductsFromInvoice(base64);
      setScannedResults(results);
    } catch (e) { alert("Erro ao ler nota fiscal."); }
    finally { setScanLoading(false); }
  };

  const captureExpensePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setExpenseScanLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    stopCamera();
    try {
      const result = await extractExpenseFromInvoice(base64);
      setNewExpense({ description: result.description, amount: result.amount, dueDate: result.dueDate, type: result.type });
      setIsExpenseScanning(false);
    } catch (e) { alert("Erro ao ler fatura."); }
    finally { setExpenseScanLoading(false); }
  };

  const capturePOSPhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setPosLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    try {
      const p = await identifyProductFromImage(base64, products);
      if (p) setPendingProduct(p); else alert("Produto não reconhecido.");
    } catch (e) { console.error(e); }
    finally { setPosLoading(false); }
  };

  const confirmImport = () => {
    setProducts(prev => {
      const updated = [...prev];
      scannedResults.forEach(item => {
        const idx = updated.findIndex(p => p.name.toLowerCase() === item.name.toLowerCase());
        const salePrice = item.costPrice * (1 + defaultMargin / 100);
        if (idx > -1) {
          updated[idx] = { ...updated[idx], stock: updated[idx].stock + item.quantity, costPrice: item.costPrice, salePrice };
        } else {
          updated.push({ id: `p${Date.now()}-${Math.random()}`, name: item.name, category: (item.category as Category) || Category.OUTROS, costPrice: item.costPrice, salePrice, stock: item.quantity, minStock: 5 });
        }
      });
      return updated;
    });
    setIsScanning(false);
    setScannedResults([]);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-100 transform transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><ShoppingCart size={20} /></div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Mercado Coruja</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400"><X size={20} /></button>
        </div>
        <nav className="px-4 mt-6 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
          <SidebarItem icon={<ShoppingCart size={20} />} label="PDV Inteligente" active={activeView === 'pos'} onClick={() => setActiveView('pos')} />
          <SidebarItem icon={<History size={20} />} label="Gestão de Vendas" active={activeView === 'sales_history'} onClick={() => setActiveView('sales_history')} />
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
              {activeView === 'sales_history' ? 'Gestão de Vendas' : activeView}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Fiado</span>
              <span className="text-sm font-black text-rose-600">R$ {totalOutstandingDebt.toFixed(2)}</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8">
          
          {/* DASHBOARD */}
          {activeView === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Vendas Brutas" value={`R$ ${totalSales.toFixed(2)}`} icon={<TrendingUp size={24} />} trend={`${filteredSales.length} vendas`} trendUp={true} />
                <StatCard title="Total Fiado" value={`R$ ${totalOutstandingDebt.toFixed(2)}`} icon={<Users size={24} />} trend="Em aberto" />
                <StatCard title="A Pagar" value={`R$ ${pendingExpenses.toFixed(2)}`} icon={<Receipt size={24} />} trend="Contas pendentes" />
                <StatCard title="Ticket Médio" value={`R$ ${(totalSales / (filteredSales.length || 1)).toFixed(2)}`} icon={<HandCoins size={24} />} trendUp={true} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-[320px]">
                   <h3 className="font-bold text-slate-800 mb-6">Tendência de Vendas Diárias</h3>
                   <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                        <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', stroke: '#fff' }} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
                <div className="bg-indigo-900 p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between">
                   <div>
                     <div className="flex items-center space-x-2 mb-4">
                       <Bell size={20} className="text-indigo-200" />
                       <h3 className="font-black text-xl tracking-tight">Estratégia IA Coruja</h3>
                     </div>
                     <p className="italic text-indigo-100 text-sm leading-relaxed">{aiInsights || "Gerando insights para seu negócio..."}</p>
                   </div>
                   <button onClick={() => setActiveView('reports')} className="mt-4 flex items-center text-xs font-black uppercase text-indigo-300 hover:text-white transition-colors">Detalhes do Relatório <ArrowRight size={14} className="ml-2"/></button>
                </div>
              </div>
            </div>
          )}

          {/* POS / PDV */}
          {activeView === 'pos' && (
             <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                   <button onClick={() => setActiveView('sales_history')} className={`flex items-center px-4 py-2 rounded-xl font-bold transition-all border bg-white text-slate-600`}>
                      <History size={18} className="mr-2"/>
                      Ver Vendas
                   </button>
                   <div className="flex flex-1 gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar produto..." className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <button onClick={() => { setIsPOSScanning(true); startCamera(); }} className="bg-indigo-600 text-white px-5 rounded-xl flex items-center shadow-lg"><Camera size={18} /></button>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    {isPOSScanning && (
                      <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                        <canvas ref={canvasRef} className="hidden" />
                        {posLoading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">Identificando...</div>}
                        {!posLoading && !pendingProduct && <button onClick={capturePOSPhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white w-14 h-14 rounded-full flex items-center justify-center border-4 border-indigo-600"><Camera/></button>}
                        {pendingProduct && (
                            <div className="absolute inset-x-0 bottom-0 bg-white p-6 rounded-t-3xl animate-in slide-in-from-bottom">
                              <div className="flex justify-between items-center mb-6">
                                <div><h3 className="text-lg font-black">{pendingProduct.name}</h3></div>
                                <span className="text-2xl font-black text-indigo-600">R$ {pendingProduct.salePrice.toFixed(2)}</span>
                              </div>
                              <div className="flex gap-3">
                                <button onClick={() => setPendingProduct(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">CANCELAR</button>
                                <button onClick={() => { addToCart(pendingProduct); setPendingProduct(null); }} className="flex-2 py-3 bg-emerald-600 text-white rounded-xl font-bold">ADICIONAR</button>
                              </div>
                            </div>
                          )}
                          <button onClick={() => { stopCamera(); setIsPOSScanning(false); }} className="absolute top-4 right-4 text-white"><X/></button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                        <button key={product.id} onClick={() => addToCart(product)} className={`bg-white p-4 rounded-2xl border text-left hover:border-indigo-300 transition-all ${product.stock <= 0 ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                          <h4 className="font-bold text-slate-800 truncate">{product.name}</h4>
                          <p className="text-xl font-black text-slate-900 mt-1">R$ {product.salePrice.toFixed(2)}</p>
                          <span className="text-[10px] font-bold text-slate-400">Estoque: {product.stock}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col h-[calc(100vh-14rem)]">
                    <div className="p-6 border-b bg-slate-50 font-bold">Sacola</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center opacity-20"><ShoppingCart size={40}/><p>Vazia</p></div> : 
                        cart.map(item => (
                          <div key={item.productId} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <div className="flex-1"><p className="font-bold text-sm">{item.name}</p><p className="text-[10px] text-slate-400">{item.quantity}x R$ {item.price.toFixed(2)}</p></div>
                            <span className="font-bold text-indigo-700">R$ {(item.quantity * item.price).toFixed(2)}</span>
                            <button onClick={() => setCart(prev => prev.filter(i => i.productId !== item.productId))} className="ml-2 text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button>
                          </div>
                        ))
                      }
                    </div>
                    <div className="p-6 border-t bg-slate-50">
                      <div className="flex justify-between text-2xl font-black mb-4"><span>Total</span><span className="text-indigo-600">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span></div>
                      <button onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg disabled:bg-slate-200 transition-transform active:scale-95">FINALIZAR VENDA</button>
                    </div>
                  </div>
                </div>
             </div>
          )}

          {/* SALES HISTORY (GESTÃO DE VENDAS) */}
          {activeView === 'sales_history' && (
             <div className="space-y-8 animate-in fade-in duration-500">
                {/* Global Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={120} /></div>
                      <p className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-2">Faturamento na Semana</p>
                      <h3 className="text-4xl font-black">R$ {globalStats.weeklyTotal.toFixed(2)}</h3>
                      <p className="text-indigo-200 text-[10px] mt-4 font-bold flex items-center italic"><CheckCircle2 size={12} className="mr-1"/> Atualizado em tempo real</p>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Calendar size={120} /></div>
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Faturamento no Mês</p>
                      <h3 className="text-4xl font-black">R$ {globalStats.monthlyTotal.toFixed(2)}</h3>
                      <p className="text-slate-500 text-[10px] mt-4 font-bold flex items-center italic"><CheckCircle2 size={12} className="mr-1"/> Meta de lucro sugerida: 25%</p>
                   </div>
                </div>

                {/* Daily Filter & Detailed List */}
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                   <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                         <h3 className="font-black text-slate-800 text-xl flex items-center">
                            <CalendarDays size={24} className="mr-3 text-indigo-600" />
                            Relatório Diário
                         </h3>
                         <p className="text-xs text-slate-400 mt-1">Veja os detalhes de cada transação realizada</p>
                      </div>
                      <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                         <span className="text-[10px] font-black text-slate-400 uppercase ml-2">Escolher Dia:</span>
                         <input 
                           type="date" 
                           className="outline-none text-sm font-bold text-slate-700 p-1" 
                           value={selectedHistoryDate}
                           onChange={(e) => setSelectedHistoryDate(e.target.value)}
                         />
                      </div>
                   </div>

                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                           <tr>
                              <th className="p-6">Data/Hora</th>
                              <th className="p-6">Itens Vendidos</th>
                              <th className="p-6">Pagamento</th>
                              <th className="p-6 text-right">Total</th>
                              <th className="p-6 text-center">Ações</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {historySalesForDay.length === 0 ? (
                             <tr>
                               <td colSpan={5} className="p-20 text-center">
                                 <div className="flex flex-col items-center justify-center opacity-30">
                                    <History size={48} />
                                    <p className="mt-4 font-bold">Nenhuma venda encontrada para este dia.</p>
                                 </div>
                               </td>
                             </tr>
                           ) : (
                             historySalesForDay.map(sale => (
                               <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                                 <td className="p-6">
                                    <div className="text-sm font-black text-slate-700">{new Date(sale.date).toLocaleTimeString('pt-BR')}</div>
                                    <div className="text-[10px] text-slate-400">{new Date(sale.date).toLocaleDateString('pt-BR')}</div>
                                 </td>
                                 <td className="p-6">
                                    <div className="flex flex-col gap-1">
                                       {sale.items.map((item, idx) => (
                                          <span key={idx} className="text-xs font-medium text-slate-600">
                                             <span className="font-black text-indigo-600">{item.quantity}x</span> {item.name}
                                          </span>
                                       ))}
                                    </div>
                                 </td>
                                 <td className="p-6">
                                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                       sale.paymentMethod === PaymentMethod.PIX ? 'bg-indigo-50 text-indigo-600' :
                                       sale.paymentMethod === PaymentMethod.DINHEIRO ? 'bg-emerald-50 text-emerald-600' :
                                       sale.paymentMethod === PaymentMethod.FIADO ? 'bg-rose-50 text-rose-600' :
                                       'bg-slate-100 text-slate-600'
                                    }`}>
                                       {sale.paymentMethod}
                                    </span>
                                 </td>
                                 <td className="p-6 text-right">
                                    <div className="text-sm font-black text-slate-800">R$ {sale.total.toFixed(2)}</div>
                                    <div className="text-[10px] text-emerald-500 font-bold">Lucro: R$ {sale.profit.toFixed(2)}</div>
                                 </td>
                                 <td className="p-6 text-center">
                                    <button 
                                      onClick={() => handleDeleteSale(sale.id)} 
                                      className="p-2 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Estornar Venda"
                                    >
                                       <Undo2 size={18}/>
                                    </button>
                                 </td>
                               </tr>
                             ))
                           )}
                        </tbody>
                     </table>
                   </div>
                   
                   {/* Day Total Footer */}
                   {historySalesForDay.length > 0 && (
                      <div className="p-8 bg-slate-50 flex justify-end">
                         <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fechamento do Dia Selecionado</p>
                            <h4 className="text-2xl font-black text-slate-800">
                               R$ {historySalesForDay.reduce((acc, s) => acc + s.total, 0).toFixed(2)}
                            </h4>
                         </div>
                      </div>
                   )}
                </div>
             </div>
          )}

          {/* ESTOQUE */}
          {activeView === 'inventory' && (
             <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                   <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                      <input type="text" placeholder="Buscar no estoque..." className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="bg-white border border-slate-200 px-5 py-2.5 rounded-xl font-black flex items-center gap-2"><Plus size={18}/> NOVO</button>
                      <button onClick={() => { setIsScanning(true); startCamera(); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg"><Camera size={18}/> ESCANEAR NF</button>
                   </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                         <tr><th className="p-5">Produto</th><th className="p-5 text-center">Estoque</th><th className="p-5 text-right">Preço Venda</th><th className="p-5 text-center">Ações</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {products.filter(p => p.name.toLowerCase().includes(inventorySearch.toLowerCase())).map(p => (
                           <tr key={p.id} className="hover:bg-slate-50/50">
                             <td className="p-5"><div className="font-black text-slate-800">{p.name}</div><div className="text-[10px] text-slate-400 uppercase">{p.category}</div></td>
                             <td className="p-5 text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${p.stock <= p.minStock ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-600'}`}>{p.stock} un</span>
                             </td>
                             <td className="p-5 text-right font-black">R$ {p.salePrice.toFixed(2)}</td>
                             <td className="p-5">
                                <div className="flex items-center justify-center gap-2">
                                   <button onClick={() => { setEditingProduct(p); setNewProduct({...p}); setIsProductModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button>
                                   <button onClick={() => deleteProduct(p.id)} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16}/></button>
                                </div>
                             </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {/* FIADOS (CLIENTES) */}
          {activeView === 'customers' && (
             <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800 flex items-center"><Users className="mr-3 text-indigo-600"/> Carteira de Fiados</h3>
                  <button onClick={() => setIsCustomerModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black flex items-center shadow-lg"><UserPlus size={18} className="mr-2"/> NOVO CLIENTE</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {customers.map(c => {
                   const debtRatio = (c.currentDebt / c.creditLimit) * 100;
                   return (
                     <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                           <div><h4 className="font-black text-slate-800">{c.name}</h4><p className="text-[10px] text-slate-400 font-bold">{c.phone}</p></div>
                           <div className="text-right"><p className="text-[9px] font-black text-slate-300 uppercase">Dívida</p><p className={`text-xl font-black ${c.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>R$ {c.currentDebt.toFixed(2)}</p></div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all ${debtRatio > 90 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(100, debtRatio)}%` }} /></div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase"><span>Limite: R$ {c.creditLimit.toFixed(2)}</span><span>Disp: R$ {(c.creditLimit - c.currentDebt).toFixed(2)}</span></div>
                        <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                           <div><p className="text-[9px] font-black text-slate-300 uppercase">Pago</p><p className="text-sm font-black text-indigo-700">R$ {c.totalPaid.toFixed(2)}</p></div>
                           <button onClick={() => { setSelectedCustomerForPayment(c); setPaymentAmount(c.currentDebt.toString()); setIsPaymentModalOpen(true); }} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white font-black text-xs flex items-center gap-2"><HandCoins size={16}/> RECEBER</button>
                        </div>
                     </div>
                   );
                 })}
               </div>
             </div>
          )}

          {/* DESPESAS */}
          {activeView === 'expenses' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                   <div className="flex items-center justify-between">
                     <h3 className="font-black text-slate-800">{editingExpenseId ? 'Editar Despesa' : 'Novo Lançamento'}</h3>
                     {!editingExpenseId && <button onClick={() => { setIsExpenseScanning(true); startCamera(); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm"><Camera size={18}/></button>}
                   </div>
                   <div className="space-y-4">
                     <input type="text" placeholder="Descrição" className="w-full p-2.5 bg-slate-50 border rounded-xl" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                     <div className="grid grid-cols-2 gap-4">
                        <input type="number" placeholder="Valor R$" className="w-full p-2.5 bg-slate-50 border rounded-xl" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
                        <select className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" value={newExpense.type} onChange={e => setNewExpense({...newExpense, type: e.target.value as ExpenseType})}>
                           <option value={ExpenseType.FIXA}>Fixa</option>
                           <option value={ExpenseType.ESTOQUE}>Estoque</option>
                        </select>
                     </div>
                     <input type="date" className="w-full p-2.5 bg-slate-50 border rounded-xl" value={newExpense.dueDate} onChange={e => setNewExpense({...newExpense, dueDate: e.target.value})} />
                     <button onClick={handleAddOrUpdateExpense} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg hover:bg-indigo-700">SALVAR</button>
                   </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                        <tr><th className="p-5">Vencimento</th><th className="p-5">Descrição</th><th className="p-5 text-right">Valor</th><th className="p-5 text-center">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expenses.map(exp => (
                          <tr key={exp.id} className="hover:bg-slate-50/50">
                            <td className="p-5 text-xs font-bold">{new Date(exp.dueDate).toLocaleDateString('pt-BR')}</td>
                            <td className="p-5 text-xs">{exp.description}</td>
                            <td className="p-5 text-right font-black">R$ {exp.amount.toFixed(2)}</td>
                            <td className="p-5">
                               <div className="flex items-center justify-center gap-2">
                                 <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? {...e, isPaid: !e.isPaid} : e))} className={`p-2 rounded-xl border ${exp.isPaid ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 border-slate-100'}`}><Check size={16}/></button>
                                 <button onClick={() => { setEditingExpenseId(exp.id); setNewExpense({...exp}); }} className="p-2 text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button>
                                 <button onClick={() => setExpenses(prev => prev.filter(e => e.id !== exp.id))} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16}/></button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {/* RELATÓRIOS */}
          {activeView === 'reports' && (
             <div className="space-y-8">
                <div className="bg-slate-900 p-10 rounded-[32px] text-white shadow-xl">
                   <h3 className="text-2xl font-black mb-8 flex items-center">Indicadores Estratégicos</h3>
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                      <div><p className="text-slate-400 text-[10px] uppercase mb-1">Faturamento Bruto</p><p className="text-2xl font-black">R$ {totalSales.toFixed(2)}</p></div>
                      <div><p className="text-slate-400 text-[10px] uppercase mb-1">Ticket Médio</p><p className="text-2xl font-black">R$ {(totalSales / (filteredSales.length || 1)).toFixed(2)}</p></div>
                      <div><p className="text-slate-400 text-[10px] uppercase mb-1">Margem Líquida Est.</p><p className="text-2xl font-black text-emerald-400">32.4%</p></div>
                      <div><p className="text-slate-400 text-[10px] uppercase mb-1">Saldo de Clientes</p><p className="text-2xl font-black text-rose-400">R$ {totalOutstandingDebt.toFixed(2)}</p></div>
                   </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                   <h3 className="font-black text-slate-800 text-lg flex items-center"><TrendingUp size={20} className="mr-2 text-indigo-600"/> Recomendações Gemini AI</h3>
                   <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl italic border border-slate-100">{aiInsights || "Coletando dados para análise profunda..."}</div>
                </div>
             </div>
          )}

        </div>
      </main>

      {/* --- MODAIS COMPARTILHADOS --- */}

      {/* Receber Fiado Modal */}
      {isPaymentModalOpen && selectedCustomerForPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black text-slate-800 mb-2">Abater Dívida</h3>
            <p className="text-sm text-slate-500 mb-6">Recebendo de: <span className="font-bold">{selectedCustomerForPayment.name}</span></p>
            <div className="space-y-4">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Valor do Pagamento R$</label>
                 <input autoFocus type="number" className="w-full p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl text-2xl font-black text-indigo-600" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
               </div>
               <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] font-bold text-amber-600">Dívida Atual: R$ {selectedCustomerForPayment.currentDebt.toFixed(2)}</div>
            </div>
            <div className="flex gap-4 mt-8">
               <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 font-bold text-slate-400">Cancelar</button>
               <button onClick={handleRegisterPayment} className="flex-2 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg">CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout PDV Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in">
            <div className="flex justify-between items-center"><h3 className="text-2xl font-black">Pagamento</h3><button onClick={() => setIsCheckoutModalOpen(false)}><X/></button></div>
            <div className="bg-indigo-50 p-5 rounded-2xl flex justify-between items-center"><span className="text-xs font-black text-indigo-400 uppercase">Total</span><span className="text-3xl font-black text-indigo-600">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span></div>
            <div className="grid grid-cols-2 gap-3">
               {[PaymentMethod.DINHEIRO, PaymentMethod.PIX, PaymentMethod.CREDITO, PaymentMethod.DEBITO, PaymentMethod.FIADO].map(m => (
                 <button key={m} onClick={() => setSelectedPayment(m)} className={`p-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-2 ${selectedPayment === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100'}`}>
                    <span>{m}</span>
                 </button>
               ))}
            </div>
            {selectedPayment === PaymentMethod.FIADO && (
              <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold">
                <option value="">Selecione o Cliente</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} (Saldo: R$ {c.currentDebt.toFixed(2)})</option>)}
              </select>
            )}
            <button onClick={finalizeSale} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg">FINALIZAR VENDA</button>
          </div>
        </div>
      )}

      {/* Product Manual Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-800">{editingProduct ? 'Editar' : 'Novo'} Produto</h3><button onClick={() => setIsProductModalOpen(false)}><X/></button></div>
              <div className="space-y-4">
                 <input type="text" placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                 <select className="w-full p-3 bg-slate-50 border rounded-xl" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})}>
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Custo R$" className="w-full p-3 bg-slate-50 border rounded-xl" value={newProduct.costPrice || ''} onChange={e => setNewProduct({...newProduct, costPrice: Number(e.target.value)})} />
                    <input type="number" placeholder="Venda R$" className="w-full p-3 bg-slate-50 border rounded-xl" value={newProduct.salePrice || ''} onChange={e => setNewProduct({...newProduct, salePrice: Number(e.target.value)})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Qtd Inicial" className="w-full p-3 bg-slate-50 border rounded-xl" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
                    <input type="number" placeholder="Estoque Mín" className="w-full p-3 bg-slate-50 border rounded-xl" value={newProduct.minStock || ''} onChange={e => setNewProduct({...newProduct, minStock: Number(e.target.value)})} />
                 </div>
              </div>
              <button onClick={handleSaveProduct} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black mt-8 shadow-lg">SALVAR PRODUTO</button>
           </div>
        </div>
      )}

      {/* Scanner Modal (NF/Fatura/POS) */}
      {(isScanning || isExpenseScanning) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in">
            <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black">Scanner de Nota Fiscal / Fatura</h3><button onClick={() => { stopCamera(); setIsScanning(false); setIsExpenseScanning(false); }}><X/></button></div>
            <div className="relative aspect-video bg-slate-900">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
              <canvas ref={canvasRef} className="hidden" />
              {(scanLoading || expenseScanLoading) && <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white space-y-4"><RefreshCw className="animate-spin" size={40}/> <span className="font-black text-xs uppercase tracking-widest">Processando com Gemini AI...</span></div>}
              {!(scanLoading || expenseScanLoading) && scannedResults.length === 0 && <button onClick={isScanning ? capturePhotoNF : captureExpensePhoto} className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white w-16 h-16 rounded-full flex items-center justify-center border-4 border-indigo-600"><Camera/></button>}
            </div>
            {scannedResults.length > 0 && (
              <div className="p-6 space-y-4 overflow-y-auto max-h-96 bg-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase">Produtos Detectados:</p>
                {scannedResults.map((it, ix) => (
                  <div key={ix} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                    <div className="flex-1"><p className="font-bold">{it.name}</p><p className="text-[10px] text-slate-500">{it.quantity}un x R$ {it.costPrice.toFixed(2)}</p></div>
                    <div className="text-right"><p className="font-black text-indigo-600">R$ {(it.costPrice * (1 + defaultMargin/100)).toFixed(2)}</p><span className="text-[9px] font-black text-slate-300 uppercase">Sugestão</span></div>
                  </div>
                ))}
                <button onClick={confirmImport} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl">CONFIRMAR IMPORTAÇÃO</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Novo Cliente Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 space-y-4 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black">Novo Cliente</h3>
            <input type="text" placeholder="Nome" className="w-full p-3 bg-slate-50 border rounded-xl" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
            <input type="text" placeholder="Fone" className="w-full p-3 bg-slate-50 border rounded-xl" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
            <input type="number" placeholder="Limite de Crédito R$" className="w-full p-3 bg-slate-50 border rounded-xl" value={newCustomer.creditLimit || ''} onChange={e => setNewCustomer({...newCustomer, creditLimit: Number(e.target.value)})} />
            <button onClick={handleAddCustomer} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold mt-4">Salvar</button>
          </div>
        </div>
      )}

    </div>
  );
}
