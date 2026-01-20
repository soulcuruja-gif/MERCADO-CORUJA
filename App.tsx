import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, Receipt, TrendingUp, Menu, X, Plus,
  Search, Trash2, AlertTriangle, Camera, RefreshCw, Check, Users, Calendar, 
  CheckCircle2, UserPlus, HandCoins, Edit2, History, Undo2, Settings, Download, 
  Upload, PanelLeftClose, PanelLeftOpen, Moon, Sun, Save, FileText, ChevronRight
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';

import { 
  Product, Sale, Expense, View, Category, SaleItem, ScannedProduct, 
  PaymentMethod, ExpenseType, Customer 
} from './types';
import { 
  INITIAL_PRODUCTS, INITIAL_EXPENSES, INITIAL_SALES, INITIAL_CUSTOMERS 
} from './constants';
import { 
  extractProductsFromMedia, identifyProductFromImage, extractExpenseFromMedia 
} from './services/geminiService';

// --- Sub-componentes ---

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, color: string }> = ({ 
  title, value, icon, color 
}) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
      <h3 className={`text-2xl font-black mt-1 ${color}`}>{value}</h3>
    </div>
    <div className={`p-4 rounded-2xl ${color.replace('text-', 'bg-').replace('-600', '-50')} dark:bg-slate-800 ${color}`}>
      {icon}
    </div>
  </div>
);

export default function App() {
  // --- Estados Globais ---
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('dark_mode') === 'true');

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('sales');
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  // --- Estados de Interface ---
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PaymentMethod.DINHEIRO);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  
  // Modais de Criação/Edição
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Gemini & OCR
  const [isScanLoading, setIsScanLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Efeitos ---
  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('sales', JSON.stringify(sales));
    localStorage.setItem('expenses', JSON.stringify(expenses));
    localStorage.setItem('customers', JSON.stringify(customers));
    localStorage.setItem('dark_mode', String(isDarkMode));
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [products, sales, expenses, customers, isDarkMode]);

  // --- Lógica de Negócio ---

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert("Produto sem estoque!");
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.salePrice, cost: product.costPrice }];
    });
  };

  const finalizeSale = () => {
    if (cart.length === 0) return;
    const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const totalCost = cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0);
    
    if (selectedPayment === PaymentMethod.FIADO) {
      if (!selectedCustomerId) return alert("Selecione um cliente para fiado.");
      setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, currentDebt: c.currentDebt + total } : c));
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
      const item = cart.find(ci => ci.productId === p.id);
      return item ? { ...p, stock: p.stock - item.quantity } : p;
    }));

    setSales(prev => [newSale, ...prev]);
    setCart([]);
    setIsCheckoutModalOpen(false);
    setSelectedCustomerId("");
  };

  const refundSale = (saleId: string) => {
    if (!confirm("Deseja realmente estornar esta venda? O estoque será devolvido.")) return;
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    setProducts(prev => prev.map(p => {
      const item = sale.items.find(si => si.productId === p.id);
      return item ? { ...p, stock: p.stock + item.quantity } : p;
    }));

    if (sale.paymentMethod === PaymentMethod.FIADO && sale.customerId) {
      setCustomers(prev => prev.map(c => c.id === sale.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - sale.total) } : c));
    }

    setSales(prev => prev.filter(s => s.id !== saleId));
  };

  const handleScanNF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const results = await extractProductsFromMedia(base64, file.type);
        
        setProducts(prev => {
          const updated = [...prev];
          results.forEach(sp => {
            const index = updated.findIndex(p => p.name.toLowerCase() === sp.name.toLowerCase());
            if (index >= 0) {
              updated[index] = { ...updated[index], stock: updated[index].stock + sp.quantity, costPrice: sp.costPrice };
            } else {
              updated.push({
                id: `p${Date.now()}${Math.random()}`,
                name: sp.name,
                category: sp.category || Category.OUTROS,
                costPrice: sp.costPrice,
                salePrice: Number((sp.costPrice * 1.35).toFixed(2)),
                stock: sp.quantity,
                minStock: 5
              });
            }
          });
          return updated;
        });
        alert(`${results.length} produtos processados com sucesso!`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Erro ao ler Nota Fiscal.");
    } finally {
      setIsScanLoading(false);
    }
  };

  // --- Cálculos Dashboard ---
  const stats = useMemo(() => {
    const totalVendido = sales.reduce((acc, s) => acc + s.total, 0);
    const lucro = sales.reduce((acc, s) => acc + s.profit, 0);
    const pendenteFiado = customers.reduce((acc, c) => acc + c.currentDebt, 0);
    const estoqueBaixo = products.filter(p => p.stock <= p.minStock).length;
    return { totalVendido, lucro, pendenteFiado, estoqueBaixo };
  }, [sales, customers, products]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    return last7Days.map(date => ({
      date,
      amount: sales.filter(s => new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) === date).reduce((acc, s) => acc + s.total, 0)
    }));
  }, [sales]);

  // --- Renderização de Views ---

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'} ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><LayoutDashboard size={20}/></div>
             {!isSidebarCollapsed && <h1 className="text-xl font-black">Coruja POS</h1>}
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden lg:block text-slate-400 hover:text-indigo-600"><PanelLeftClose size={20}/></button>
        </div>
        
        <nav className="px-3 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'pos', icon: ShoppingCart, label: 'PDV / Vender' },
            { id: 'sales_history', icon: History, label: 'Vendas Feitas' },
            { id: 'inventory', icon: Package, label: 'Estoque' },
            { id: 'expenses', icon: Receipt, label: 'Despesas' },
            { id: 'customers', icon: Users, label: 'Fiado' },
            { id: 'settings', icon: Settings, label: 'Ajustes' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { setActiveView(item.id as View); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20' : 'text-slate-500 hover:bg-indigo-50 dark:hover:bg-slate-800'}`}
            >
              <item.icon size={20} />
              {!isSidebarCollapsed && <span className="font-bold text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t dark:border-slate-800 space-y-2">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              {isDarkMode ? <Sun size={20} className="text-amber-500"/> : <Moon size={20}/>}
              {!isSidebarCollapsed && <span className="font-bold text-sm">{isDarkMode ? 'Claro' : 'Escuro'}</span>}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><Menu size={20}/></button>
             <h2 className="text-lg font-black capitalize tracking-tight">{activeView.replace('_', ' ')}</h2>
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lucro Total</span>
                <span className="text-sm font-black text-emerald-600">R$ {stats.lucro.toFixed(2)}</span>
             </div>
             <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 font-black">C</div>
          </div>
        </header>

        <div className="p-8">
          {/* Dashboard */}
          {activeView === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="Vendas Totais" value={`R$ ${stats.totalVendido.toFixed(2)}`} icon={<TrendingUp size={24}/>} color="text-indigo-600" />
                  <StatCard title="Fiados Pendentes" value={`R$ ${stats.pendenteFiado.toFixed(2)}`} icon={<Users size={24}/>} color="text-amber-600" />
                  <StatCard title="Lucro Bruto" value={`R$ ${stats.lucro.toFixed(2)}`} icon={<TrendingUp size={24}/>} color="text-emerald-600" />
                  <StatCard title="Estoque Crítico" value={`${stats.estoqueBaixo} itens`} icon={<Package size={24}/>} color="text-rose-600" />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 h-[400px]">
                     <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-widest mb-8">Vendas dos Últimos 7 Dias</h3>
                     <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                           <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                           <Tooltip contentStyle={{borderRadius: '16px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff'}} />
                           <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={4} dot={{r: 6, fill: '#4f46e5'}} />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="bg-indigo-600 p-8 rounded-[32px] text-white flex flex-col justify-between">
                     <div>
                        <h4 className="text-2xl font-black mb-2">Meta de Vendas</h4>
                        <p className="text-indigo-200 text-sm">Você atingiu 65% da sua meta mensal!</p>
                     </div>
                     <div className="space-y-4">
                        <div className="h-4 bg-indigo-500 rounded-full overflow-hidden">
                           <div className="h-full bg-white w-[65%]"></div>
                        </div>
                        <p className="text-right font-black">R$ 32.500 / R$ 50.000</p>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* POS (Vender) */}
          {activeView === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4 duration-500">
               <div className="lg:col-span-2 space-y-6">
                  <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={24}/>
                    <input 
                      type="text" 
                      placeholder="Pesquisar produto pelo nome..." 
                      className="w-full pl-14 pr-6 py-5 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none shadow-sm font-bold transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                      <button 
                        key={product.id} 
                        onClick={() => addToCart(product)} 
                        className={`bg-white dark:bg-slate-900 p-5 rounded-[28px] border-2 border-transparent hover:border-indigo-600 transition-all text-left shadow-sm group relative overflow-hidden ${product.stock <= 0 ? 'opacity-50 grayscale' : ''}`}
                      >
                         <h4 className="font-bold text-sm truncate">{product.name}</h4>
                         <p className="text-2xl font-black mt-3 text-indigo-600">R$ {product.salePrice.toFixed(2)}</p>
                         <span className={`text-[10px] font-black uppercase tracking-widest mt-2 block ${product.stock <= product.minStock ? 'text-rose-500' : 'text-slate-400'}`}>Estoque: {product.stock}</span>
                         <div className="absolute -right-2 -bottom-2 bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-tl-[24px] opacity-0 group-hover:opacity-100 transition-all text-indigo-600"><Plus size={20}/></div>
                      </button>
                    ))}
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col h-[70vh] lg:h-[calc(100vh-12rem)] sticky top-24">
                  <div className="p-8 border-b dark:border-slate-800 flex justify-between items-center">
                     <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-widest">Carrinho</h3>
                     <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase">Limpar</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.length === 0 && <div className="text-center py-20 text-slate-300 font-black opacity-50"><ShoppingCart size={60} className="mx-auto mb-4"/> Vazio</div>}
                    {cart.map(item => (
                      <div key={item.productId} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                         <div className="flex-1 min-w-0 pr-3">
                            <p className="font-black text-sm truncate">{item.name}</p>
                            <p className="text-xs text-slate-400 font-bold">R$ {item.price.toFixed(2)} x {item.quantity}</p>
                         </div>
                         <p className="font-black text-indigo-600">R$ {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-8 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                     <div className="flex justify-between items-end mb-6">
                        <span className="text-[11px] font-black text-slate-400 uppercase">Total Geral</span>
                        <span className="text-4xl font-black text-indigo-600">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                     </div>
                     <button 
                        onClick={() => setIsCheckoutModalOpen(true)} 
                        disabled={cart.length === 0}
                        className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                      >
                        CONCLUIR VENDA
                      </button>
                  </div>
               </div>
            </div>
          )}

          {/* Vendas Feitas */}
          {activeView === 'sales_history' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <h3 className="text-3xl font-black tracking-tight">Histórico de Transações</h3>
               <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                       <tr>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Data / Hora</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Itens</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Pagamento</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Total</th>
                          <th className="px-6 py-5"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {sales.map(s => (
                         <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                           <td className="px-6 py-5">
                             <p className="font-bold text-sm">{new Date(s.date).toLocaleDateString('pt-BR')}</p>
                             <p className="text-xs text-slate-400">{new Date(s.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                           </td>
                           <td className="px-6 py-5 text-sm text-slate-500">
                             {s.items.length} itens (venda {s.id.slice(-4)})
                           </td>
                           <td className="px-6 py-5">
                             <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.paymentMethod === PaymentMethod.FIADO ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {s.paymentMethod}
                             </span>
                           </td>
                           <td className="px-6 py-5 font-black text-indigo-600">R$ {s.total.toFixed(2)}</td>
                           <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => refundSale(s.id)} className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"><Undo2 size={18}/></button>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* Estoque */}
          {activeView === 'inventory' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <h3 className="text-3xl font-black tracking-tight">Gerenciamento de Estoque</h3>
                  <div className="flex gap-3">
                    <label className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer hover:border-indigo-600 transition-all">
                       <Camera size={20} className="text-indigo-600"/>
                       <span>{isScanLoading ? 'LENDO NF...' : 'IMPORTAR NF'}</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleScanNF} disabled={isScanLoading} />
                    </label>
                    <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:scale-105 transition-all"><Plus size={20}/></button>
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-6 border-b dark:border-slate-800">
                     <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                        <input 
                           type="text" 
                           placeholder="Buscar no estoque..." 
                           className="w-full pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none font-bold text-sm"
                           value={inventorySearch}
                           onChange={e => setInventorySearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                       <tr>
                          <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest">Produto</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest">Categoria</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest">Custo</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest">Venda</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest">Qtd</th>
                          <th className="px-6 py-4"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {products.filter(p => p.name.toLowerCase().includes(inventorySearch.toLowerCase())).map(p => (
                         <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                           <td className="px-6 py-4">
                             <p className="font-black text-sm">{p.name}</p>
                           </td>
                           <td className="px-6 py-4">
                             <span className="text-xs font-bold text-slate-400">{p.category}</span>
                           </td>
                           <td className="px-6 py-4 text-sm text-slate-500">R$ {p.costPrice.toFixed(2)}</td>
                           <td className="px-6 py-4 font-black text-indigo-600">R$ {p.salePrice.toFixed(2)}</td>
                           <td className="px-6 py-4">
                              <div className={`px-3 py-1 rounded-lg inline-block font-black text-xs ${p.stock <= p.minStock ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                 {p.stock}
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={16}/></button>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* Despesas */}
          {activeView === 'expenses' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black tracking-tight">Fluxo de Despesas</h3>
                  <button onClick={() => { setEditingExpense(null); setIsExpenseModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg"><Plus size={20}/></button>
               </div>

               <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                       <tr>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Descrição</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Tipo</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Vencimento</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Valor</th>
                          <th className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                          <th className="px-6 py-5"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {expenses.map(e => (
                         <tr key={e.id}>
                           <td className="px-6 py-5 font-black text-sm">{e.description}</td>
                           <td className="px-6 py-5 text-xs text-slate-400 font-bold uppercase">{e.type}</td>
                           <td className="px-6 py-5 text-sm text-slate-500">{new Date(e.dueDate).toLocaleDateString('pt-BR')}</td>
                           <td className="px-6 py-5 font-black text-rose-500">R$ {e.amount.toFixed(2)}</td>
                           <td className="px-6 py-5">
                             <button 
                                onClick={() => setExpenses(prev => prev.map(item => item.id === e.id ? { ...item, isPaid: !item.isPaid } : item))}
                                className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${e.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                             >
                                {e.isPaid ? 'PAGO' : 'PENDENTE'}
                             </button>
                           </td>
                           <td className="px-6 py-5 text-right">
                              <button onClick={() => setExpenses(prev => prev.filter(item => item.id !== e.id))} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {/* Ajustes */}
          {activeView === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
               <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-xl">
                  <h3 className="text-3xl font-black mb-8">Preferências do Sistema</h3>
                  
                  <div className="space-y-10">
                    <section>
                      <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-4">Segurança de Dados</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <button className="flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all border-2 border-transparent hover:border-indigo-100">
                           <Download size={20} className="text-indigo-600"/> Exportar JSON
                        </button>
                        <button className="flex items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all border-2 border-transparent hover:border-indigo-100">
                           <Upload size={20} className="text-indigo-600"/> Importar JSON
                        </button>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-4">Unidade de Negócio</h4>
                      <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome do Estabelecimento</label>
                            <input type="text" defaultValue="Minimercado Coruja" className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600 transition-all" />
                         </div>
                         <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Margem de Lucro Sugerida (%)</label>
                            <input type="number" defaultValue="35" className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600 transition-all" />
                         </div>
                      </div>
                    </section>

                    <button className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all">SALVAR ALTERAÇÕES</button>
                  </div>
               </div>
            </div>
          )}

          {/* Fiado (Clientes) */}
          {activeView === 'customers' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black tracking-tight">Gestão de Fiados</h3>
                  <button onClick={() => { setEditingCustomer(null); setIsCustomerModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg"><UserPlus size={20}/></button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {customers.map(c => (
                   <div key={c.id} className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm relative group">
                      <button 
                        onClick={() => { setEditingCustomer(c); setIsCustomerModalOpen(true); }} 
                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 size={18}/>
                      </button>
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 text-xl font-black">{c.name[0]}</div>
                        <div>
                           <h4 className="font-black text-xl leading-tight">{c.name}</h4>
                           <p className="text-xs text-slate-400 font-bold mt-1">CPF: {c.cpf || 'Não informado'}</p>
                        </div>
                      </div>
                      <div className="space-y-4 pt-6 border-t dark:border-slate-800">
                         <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dívida Pendente</span>
                            <span className={`text-3xl font-black tracking-tighter ${c.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>R$ {c.currentDebt.toFixed(2)}</span>
                         </div>
                         <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 transition-all duration-1000" style={{width: `${Math.min(100, (c.currentDebt / c.creditLimit) * 100)}%`}}></div>
                         </div>
                         <p className="text-[10px] font-black text-slate-400 text-right uppercase">Limite: R$ {c.creditLimit.toFixed(2)}</p>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Modais --- */}

      {/* Modal Pagamento (PDV) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[48px] p-10 shadow-2xl relative">
              <button onClick={() => setIsCheckoutModalOpen(false)} className="absolute top-8 right-8 text-slate-400"><X/></button>
              <h3 className="text-3xl font-black mb-10 text-center tracking-tight">Finalizar Venda</h3>
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-4">
                    {[PaymentMethod.DINHEIRO, PaymentMethod.PIX, PaymentMethod.DEBITO, PaymentMethod.CREDITO, PaymentMethod.FIADO].map(m => (
                       <button 
                         key={m} 
                         onClick={() => setSelectedPayment(m)} 
                         className={`p-5 rounded-2xl font-black text-sm border-2 transition-all ${selectedPayment === m ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                       >
                         {m}
                       </button>
                    ))}
                 </div>

                 {selectedPayment === PaymentMethod.FIADO && (
                    <div className="space-y-2 animate-in slide-in-from-top-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Vincular Cliente</label>
                       <select 
                         className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600"
                         value={selectedCustomerId}
                         onChange={e => setSelectedCustomerId(e.target.value)}
                       >
                         <option value="">Escolha um cliente...</option>
                         {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                 )}

                 <div className="p-8 bg-indigo-600 text-white rounded-[32px] text-center shadow-lg shadow-indigo-200 dark:shadow-none">
                    <p className="text-[11px] font-black uppercase opacity-60 tracking-widest mb-1">Total a Receber</p>
                    <h4 className="text-5xl font-black tracking-tighter">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</h4>
                 </div>

                 <button onClick={finalizeSale} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all">FINALIZAR AGORA</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Produto (Novo/Edição) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[48px] p-10 shadow-2xl">
              <h3 className="text-2xl font-black mb-8">{editingProduct ? 'Editar' : 'Novo'} Produto</h3>
              <div className="space-y-4">
                 <input type="text" placeholder="Nome do Produto" defaultValue={editingProduct?.name} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Custo" defaultValue={editingProduct?.costPrice} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                    <input type="number" placeholder="Venda" defaultValue={editingProduct?.salePrice} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Estoque Inicial" defaultValue={editingProduct?.stock} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                    <input type="number" placeholder="Mínimo" defaultValue={editingProduct?.minStock} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 </div>
                 <div className="flex gap-4 mt-6">
                    <button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-400">FECHAR</button>
                    <button className="flex-[2] bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg">SALVAR PRODUTO</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal Cliente (Novo/Edição) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[48px] p-10 shadow-2xl">
              <h3 className="text-2xl font-black mb-8">{editingCustomer ? 'Editar' : 'Novo'} Cliente</h3>
              <div className="space-y-4">
                 <input type="text" placeholder="Nome do Cliente" defaultValue={editingCustomer?.name} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 <input type="text" placeholder="CPF (000.000.000-00)" defaultValue={editingCustomer?.cpf} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 <input type="text" placeholder="WhatsApp / Telefone" defaultValue={editingCustomer?.phone} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 <input type="number" placeholder="Limite de Crédito R$" defaultValue={editingCustomer?.creditLimit} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                 <div className="flex gap-4 mt-6">
                    <button onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-400">FECHAR</button>
                    <button className="flex-[2] bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg">SALVAR CLIENTE</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
