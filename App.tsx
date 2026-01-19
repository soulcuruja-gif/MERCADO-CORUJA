
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
  CalendarDays,
  ShieldCheck,
  Settings,
  Download,
  Upload,
  Cloud,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Moon,
  Sun,
  LogOut,
  KeyRound,
  Fingerprint,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';

import { Product, Sale, Expense, View, Category, SaleItem, ScannedProduct, PaymentMethod, ExpenseType, Customer } from './types';
import { INITIAL_PRODUCTS, INITIAL_EXPENSES, INITIAL_SALES, INITIAL_CUSTOMERS } from './constants';
import { getBusinessInsights, extractProductsFromMedia, identifyProductFromImage, extractExpenseFromMedia } from './services/geminiService';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// --- Sub-components (Helpers) ---

const SidebarItem: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  collapsed: boolean,
  onClick: () => void 
}> = ({ icon, label, active, collapsed, onClick }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : ""}
    className={`w-full flex items-center transition-all duration-300 rounded-xl mb-1 ${
      collapsed ? 'justify-center px-0 py-3' : 'space-x-3 px-4 py-3'
    } ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
    }`}
  >
    <div className={`flex-shrink-0 ${active ? 'scale-110' : ''} transition-transform`}>
      {icon}
    </div>
    {!collapsed && (
      <span className="font-semibold text-sm whitespace-nowrap overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-left-2">
        {label}
      </span>
    )}
  </button>
);

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, trend?: string, trendUp?: boolean }> = ({ 
  title, value, icon, trend, trendUp 
}) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-start justify-between hover:shadow-md transition-all">
    <div>
      <p className="text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">{value}</h3>
      {trend && (
        <span className={`text-[10px] font-bold mt-2 inline-block px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'}`}>
          {trend}
        </span>
      )}
    </div>
    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
      {icon}
    </div>
  </div>
);

// --- Local Storage Keys ---
const STORAGE_KEYS = {
  PRODUCTS: 'coruja_products',
  SALES: 'coruja_sales',
  EXPENSES: 'coruja_expenses',
  CUSTOMERS: 'coruja_customers',
  DARK_MODE: 'coruja_dark_mode',
  API_KEY: 'coruja_google_api_key',
  CLIENT_ID: 'coruja_google_client_id',
};

// --- Main App Component ---

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true';
  });
  
  // --- Data States ---
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SALES);
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });
  
  // --- Google Drive State ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.API_KEY) || '');
  const [clientId, setClientId] = useState(() => localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '');
  const [isDriveAuthenticated, setIsDriveAuthenticated] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveUser, setDriveUser] = useState<any>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [googleScriptsLoaded, setGoogleScriptsLoaded] = useState(false);
  const scriptsInitiated = useRef(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);

  // --- DARK MODE EFFECT ---
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(isDarkMode));
  }, [isDarkMode]);

  // --- Persistence Sync ---
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers)); }, [customers]);

  // Filters & Global States
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [defaultMargin, setDefaultMargin] = useState(35);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expenseFileInputRef = useRef<HTMLInputElement>(null);

  // Modals & UI States
  const [isScanning, setIsScanning] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedProduct[]>([]);
  const [isScanResultsModalOpen, setIsScanResultsModalOpen] = useState(false);
  const [isExpenseScanning, setIsExpenseScanning] = useState(false);
  const [expenseScanLoading, setExpenseScanLoading] = useState(false);
  const [isPOSScanning, setIsPOSScanning] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(PaymentMethod.DINHEIRO);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', category: Category.ALIMENTOS, costPrice: 0, salePrice: 0, stock: 0, minStock: 5 });
  const [newExpense, setNewExpense] = useState({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', creditLimit: 0 });

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState<string>("Todas");

  // --- Handlers ---
  const handleExportLocalBackup = () => {
    const data = { products, sales, expenses, customers, version: "2.3", exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_coruja_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert("Backup local gerado com sucesso!");
  };

  const handleImportLocalBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !confirm("Importar backup? Todos os dados atuais serão substituídos.")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.products && data.sales) {
          setProducts(data.products);
          setSales(data.sales);
          setExpenses(data.expenses || []);
          setCustomers(data.customers || []);
          alert("Sincronização concluída!");
        }
      } catch (err) { alert("Erro ao ler o backup."); }
    };
    reader.readAsText(file);
  };

  const stopCamera = () => { if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); videoRef.current!.srcObject = null; };
  const startCamera = async () => { try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); } } catch (e) { alert("Câmera bloqueada."); } };
  
  // --- Cart Management ---
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
      if (currentQuantityInCart >= product.stock) {
        alert("Estoque máximo atingido!");
        return prevCart;
      }
      if (existingItem) {
        return prevCart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prevCart, { productId: product.id, name: product.name, quantity: 1, price: product.salePrice, cost: product.costPrice }];
      }
    });
  };

  const increaseCartItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      addToCart(product);
    }
  };
  
  const decreaseCartItemQuantity = (productId: string) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === productId);
      if (existingItem?.quantity === 1) {
        return prev.filter(item => item.productId !== productId);
      } else if (existingItem) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev;
    });
  };

  const finalizeSale = () => { if (cart.length === 0) return; const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0); if (selectedPayment === PaymentMethod.FIADO) { if (!selectedCustomerId) return alert("Selecione o cliente."); const c = customers.find(cu => cu.id === selectedCustomerId); if (c && c.currentDebt + total > c.creditLimit) return alert("Limite excedido!"); setCustomers(prev => prev.map(cu => cu.id === selectedCustomerId ? { ...cu, currentDebt: Number((cu.currentDebt + total).toFixed(2)) } : cu)); } const newSale = { id: `s${Date.now()}`, date: new Date().toISOString(), items: [...cart], total, totalCost: cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0), profit: total - cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0), paymentMethod: selectedPayment, customerId: selectedPayment === PaymentMethod.FIADO ? selectedCustomerId : undefined }; setProducts(prev => prev.map(p => { const si = cart.find(ci => ci.productId === p.id); return si ? { ...p, stock: p.stock - si.quantity } : p; })); setSales(prev => [newSale, ...prev]); setCart([]); setIsCheckoutModalOpen(false); };
  
  const handleDeleteSale = (id: string) => { if (!confirm("Estornar?")) return; const s = sales.find(sa => sa.id === id); if (s) { setProducts(prev => prev.map(p => { const it = s.items.find(si => si.productId === p.id); return it ? { ...p, stock: p.stock + it.quantity } : p; })); if (s.paymentMethod === PaymentMethod.FIADO && s.customerId) setCustomers(prev => prev.map(cu => cu.id === s.customerId ? { ...cu, currentDebt: Math.max(0, Number((cu.currentDebt - s.total).toFixed(2))) } : cu)); } setSales(prev => prev.filter(sa => sa.id !== id)); };

  const capturePOSPhoto = async () => { if (canvasRef.current && videoRef.current) { setPosLoading(true); const ctx = canvasRef.current.getContext('2d'); canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight; ctx?.drawImage(videoRef.current, 0, 0); const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1]; try { const product = await identifyProductFromImage(base64, products); if (product) setPendingProduct(product); else alert("Produto não identificado."); } catch (e) { alert("Erro ao identificar."); } finally { setPosLoading(false); } } };
  const deleteProduct = (id: string) => { if (confirm("Excluir produto?")) setProducts(prev => prev.filter(p => p.id !== id)); };
  const handleAddOrUpdateExpense = () => { if (!newExpense.description || !newExpense.amount) return alert("Preencha tudo."); const exp = { id: editingExpenseId || `e${Date.now()}`, date: new Date().toISOString(), dueDate: newExpense.dueDate || new Date().toISOString().split('T')[0], description: newExpense.description, amount: newExpense.amount, type: newExpense.type, isPaid: false }; if (editingExpenseId) setExpenses(prev => prev.map(e => e.id === editingExpenseId ? exp : e)); else setExpenses(prev => [...prev, exp]); setNewExpense({ description: '', amount: 0, dueDate: '', type: ExpenseType.FIXA }); setEditingExpenseId(null); };
  const handleRegisterPayment = () => { if (!selectedCustomerForPayment || !paymentAmount) return; const amount = Number(paymentAmount); setCustomers(prev => prev.map(c => c.id === selectedCustomerForPayment.id ? { ...c, currentDebt: Math.max(0, Number((c.currentDebt - amount).toFixed(2))), totalPaid: Number((c.totalPaid + amount).toFixed(2)) } : c)); setIsPaymentModalOpen(false); setPaymentAmount(""); setSelectedCustomerForPayment(null); };
  const handleSaveProduct = () => { if (!newProduct.name || !newProduct.salePrice) return alert("Preencha nome e preço."); const p = { id: editingProduct?.id || `p${Date.now()}`, ...newProduct, lastUpdated: new Date().toISOString() }; if (editingProduct) setProducts(prev => prev.map(item => item.id === editingProduct.id ? p : item)); else setProducts(prev => [...prev, p]); setIsProductModalOpen(false); setNewProduct({ name: '', category: Category.ALIMENTOS, costPrice: 0, salePrice: 0, stock: 0, minStock: 5 }); setEditingProduct(null); };
  
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScanLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dataUrl = e.target?.result as string;
            const [header, base64Data] = dataUrl.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
            
            const results = await extractProductsFromMedia(base64Data, mimeType);
            if(results.length > 0) {
                setScannedResults(results);
                setIsScanResultsModalOpen(true);
            } else {
                alert("Nenhum produto encontrado no arquivo.");
            }
        } catch (err) {
            alert("Erro ao processar o arquivo da NF.");
            console.error(err);
        } finally {
            setScanLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        }
    };
    reader.readAsDataURL(file);
  };

  const handleExpenseFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExpenseScanLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dataUrl = e.target?.result as string;
            const [header, base64Data] = dataUrl.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || file.type;

            const result = await extractExpenseFromMedia(base64Data, mimeType);
            setNewExpense({ description: result.description, amount: result.amount, dueDate: result.dueDate, type: result.type });
        } catch (err) {
            alert("Erro ao processar o arquivo da fatura.");
            console.error(err);
        } finally {
            setExpenseScanLoading(false);
            if (expenseFileInputRef.current) expenseFileInputRef.current.value = "";
        }
    };
    reader.readAsDataURL(file);
  };

  const capturePhotoNF = async () => { 
    if (canvasRef.current && videoRef.current) { 
      setScanLoading(true); 
      const ctx = canvasRef.current.getContext('2d'); 
      canvasRef.current.width = videoRef.current.videoWidth; 
      canvasRef.current.height = videoRef.current.videoHeight; 
      ctx?.drawImage(videoRef.current, 0, 0); 
      const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1]; 
      try { 
        const results = await extractProductsFromMedia(base64, 'image/jpeg'); 
        setScannedResults(results); 
        setIsScanResultsModalOpen(true);
      } catch (e) { 
        alert("Erro ao ler NF."); 
      } finally { 
        setScanLoading(false); 
        stopCamera();
        setIsScanning(false);
      } 
    } 
  };
  
  const captureExpensePhoto = async () => { 
    if (canvasRef.current && videoRef.current) { 
      setExpenseScanLoading(true); 
      const ctx = canvasRef.current.getContext('2d'); 
      canvasRef.current.width = videoRef.current.videoWidth; 
      canvasRef.current.height = videoRef.current.videoHeight; 
      ctx?.drawImage(videoRef.current, 0, 0); 
      const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1]; 
      try { 
        const result = await extractExpenseFromMedia(base64, 'image/jpeg'); 
        setNewExpense({ description: result.description, amount: result.amount, dueDate: result.dueDate, type: result.type }); 
        stopCamera(); 
        setIsExpenseScanning(false); 
      } catch (e) { 
        alert("Erro ao ler fatura."); 
      } finally { 
        setExpenseScanLoading(false); 
      } 
    } 
  };
  
  const confirmImport = () => { 
    setProducts(prev => { 
      const updated = [...prev]; 
      scannedResults.forEach(sp => { 
        const idx = updated.findIndex(p => p.name.toLowerCase() === sp.name.toLowerCase()); 
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], stock: updated[idx].stock + sp.quantity, costPrice: sp.costPrice, lastUpdated: new Date().toISOString() }; 
        } else {
          updated.push({ id: `p${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, name: sp.name, category: sp.category || Category.OUTROS, costPrice: sp.costPrice, salePrice: Number((sp.costPrice * (1 + (defaultMargin / 100))).toFixed(2)), stock: sp.quantity, minStock: 5, lastUpdated: new Date().toISOString() }); 
        }
      }); 
      return updated; 
    }); 
    setIsScanResultsModalOpen(false);
    setScannedResults([]); 
  };
  const handleAddCustomer = () => { if (!newCustomer.name) return alert("Nome obrigatório."); const c = { id: `c${Date.now()}`, ...newCustomer, currentDebt: 0, totalPaid: 0 }; setCustomers(prev => [...prev, c]); setIsCustomerModalOpen(false); setNewCustomer({ name: '', phone: '', creditLimit: 0 }); };

  // Statistics Calculation
  const filteredSales = useMemo(() => {
    const start = new Date(filterStartDate + 'T00:00:00');
    const end = new Date(filterEndDate + 'T23:59:59');
    return sales.filter(s => { const d = new Date(s.date); return d >= start && d <= end; });
  }, [sales, filterStartDate, filterEndDate]);

  const globalStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTotal = sales.filter(s => new Date(s.date) >= startOfMonth).reduce((acc, s) => acc + s.total, 0);
    const day = now.getDay();
    const diff = now.getDate() - day;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyTotal = sales.filter(s => new Date(s.date) >= startOfWeek).reduce((acc, s) => acc + s.total, 0);
    return { weeklyTotal, monthlyTotal };
  }, [sales]);

  const chartData = useMemo(() => {
    const dailyData: { [key: string]: number } = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyData[date] = (dailyData[date] || 0) + sale.total;
    });
    return Object.entries(dailyData).map(([date, amount]) => ({ date, amount })).sort((a,b) => a.date.localeCompare(b.date));
  }, [filteredSales]);

  const totalSales = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const pendingExpenses = expenses.filter(e => !e.isPaid).reduce((acc, e) => acc + e.amount, 0);
  const totalOutstandingDebt = customers.reduce((acc, c) => acc + c.currentDebt, 0);

  // AI Insights call
  const fetchAIInsights = useCallback(async () => {
    setIsLoadingAI(true);
    setAiInsights("");
    try {
      const insights = await getBusinessInsights(products, filteredSales, expenses);
      setAiInsights(insights || "Nenhum insight disponível.");
    } catch (error) {
      console.error(error);
      setAiInsights("Ocorreu um erro ao buscar insights. Verifique sua cota de API.");
    } finally {
      setIsLoadingAI(false);
    }
  }, [products, filteredSales, expenses]);

  useEffect(() => {
    fetchAIInsights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Google Drive Integration ---
  const initializeGoogleClients = useCallback((currentApiKey: string, currentClientId: string) => {
    if (scriptsInitiated.current) return;
    scriptsInitiated.current = true;
  
    const gapiScript = document.createElement('script');
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.defer = true;
  
    const gisScript = document.createElement('script');
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
  
    const handleGisLoad = () => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: currentClientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              window.gapi.client.setToken(tokenResponse);
              setIsDriveAuthenticated(true);
              fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
              })
              .then(res => res.json())
              .then(data => {
                setDriveUser({
                  getName: () => data.name,
                  getEmail: () => data.email,
                  getImageUrl: () => data.picture,
                });
              }).catch(err => console.error("Error fetching user info:", err));
            }
          },
        });
        setTokenClient(client);
        setGoogleScriptsLoaded(true);
      } catch (error) {
        console.error("Error initializing GIS client:", error);
        alert("Falha ao inicializar o serviço de autenticação do Google. Verifique se o ID do Cliente é válido.");
      }
    };
  
    const handleGapiLoad = () => {
      window.gapi.load('client:picker', async () => {
        try {
          await window.gapi.client.init({
            apiKey: currentApiKey,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          gisScript.onload = handleGisLoad;
          document.body.appendChild(gisScript);
        } catch (err: any) {
          console.error("Error initializing GAPI client:", err);
          alert(`Falha ao carregar a API do Google Drive: ${err.details || err.message || 'Erro desconhecido'}. Verifique se a 'Drive API' está ativada no seu projeto Google Cloud e se a Chave de API é válida.`);
        }
      });
    };
  
    gapiScript.onload = handleGapiLoad;
    document.body.appendChild(gapiScript);
  }, []);

  useEffect(() => {
    if (apiKey && clientId && !googleScriptsLoaded) {
      initializeGoogleClients(apiKey, clientId);
    }
  }, [apiKey, clientId, googleScriptsLoaded, initializeGoogleClients]);

  const handleSaveCredentials = (newApiKey: string, newClientId: string) => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, newApiKey);
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, newClientId);
    setApiKey(newApiKey);
    setClientId(newClientId);
    setIsCredentialsModalOpen(false);
    // Reset script loading flag to allow re-initialization with new keys
    scriptsInitiated.current = false; 
    setGoogleScriptsLoaded(false);
    // The useEffect will now pick up the new keys and initialize
  };

  const handleDriveAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else if (!googleScriptsLoaded) {
      alert("A integração com o Google Drive ainda está carregando ou não foi configurada. Por favor, configure suas credenciais na aba 'Ajustes'.");
    } else {
       alert("A configuração do Google Drive está incompleta. Verifique se o ID do Cliente foi fornecido corretamente.");
    }
  };
  
  const handleDriveSignOut = () => {
    const token = window.gapi.client.getToken();
    if (token && token.access_token) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken(null);
        setIsDriveAuthenticated(false);
        setDriveUser(null);
      });
    }
  };

  const handleExportToDrive = async () => {
    if (!isDriveAuthenticated) return alert("Por favor, conecte-se ao Google Drive primeiro.");
    setIsDriveLoading(true);
    const dataToBackup = { products, sales, expenses, customers, version: "2.4-drive", exportDate: new Date().toISOString() };
    const fileContent = JSON.stringify(dataToBackup, null, 2);
    const fileName = `backup_coruja_${new Date().toISOString().split('T')[0]}.json`;
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;
    const metadata = { name: fileName, mimeType: 'application/json' };
    const multipartRequestBody =
      delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
      delimiter + 'Content-Type: application/json\r\n\r\n' + fileContent + close_delim;

    try {
      await window.gapi.client.request({
        path: '/upload/drive/v3/files', method: 'POST', params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` }, body: multipartRequestBody,
      });
      alert("Backup salvo no Google Drive com sucesso!");
    } catch (error) {
      console.error("Error uploading to Drive:", error);
      alert("Erro ao salvar o backup no Google Drive.");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const pickerCallback = useCallback(async (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const fileId = data.docs[0].id;
      setIsDriveLoading(true);
      try {
        if (!confirm("Importar backup do Drive? Todos os dados atuais serão substituídos.")) {
          setIsDriveLoading(false);
          return;
        }
        const response = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
        const fileData = JSON.parse(response.body);
        
        if (fileData.products && fileData.sales) {
          setProducts(fileData.products);
          setSales(fileData.sales);
          setExpenses(fileData.expenses || []);
          setCustomers(fileData.customers || []);
          alert("Backup restaurado do Google Drive com sucesso!");
        } else {
          throw new Error("Formato de backup inválido.");
        }
      } catch (error) {
        console.error("Error downloading from Drive:", error);
        alert("Erro ao carregar o backup do Google Drive.");
      } finally {
        setIsDriveLoading(false);
      }
    }
  }, [setProducts, setSales, setExpenses, setCustomers]);

  const handleImportFromDrive = () => {
    if (!isDriveAuthenticated) {
      alert("Por favor, conecte-se ao Google Drive primeiro.");
      handleDriveAuth();
      return;
    }
    
    const token = window.gapi.client.getToken();
    if (!token || !token.access_token) {
        alert("Sessão expirada. Por favor, conecte-se novamente.");
        handleDriveAuth();
        return;
    }

    if (!window.google || !window.google.picker) {
        alert("O seletor de arquivos do Google não pôde ser carregado. Tente recarregar a página.");
        return;
    }

    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token.access_token)
      .setDeveloperKey(apiKey)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-all duration-500 overflow-x-hidden text-slate-900 dark:text-slate-100">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transform transition-all duration-300 ease-in-out shadow-xl lg:shadow-none flex flex-col ${
          isSidebarOpen ? 'translate-x-0 w-64' : 'lg:translate-x-0 -translate-x-full'
        } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className={`p-6 flex items-center transition-all ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-xl text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 shrink-0 flex items-center justify-center">
              <img src="https://cdn-icons-png.flaticon.com/512/952/952763.png" alt="Coruja Logo" className="w-6 h-6" />
            </div>
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap overflow-hidden animate-in fade-in">
                Coruja <span className="text-indigo-600 dark:text-indigo-400">POS</span>
              </h1>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 p-2"><X size={24} /></button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeView === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('dashboard'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<ShoppingCart size={20} />} label="Vender (PDV)" active={activeView === 'pos'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('pos'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<History size={20} />} label="Vendas Feitas" active={activeView === 'sales_history'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('sales_history'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Package size={20} />} label="Estoque" active={activeView === 'inventory'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('inventory'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Receipt size={20} />} label="Despesas" active={activeView === 'expenses'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('expenses'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Users size={20} />} label="Clientes/Fiado" active={activeView === 'customers'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('customers'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<TrendingUp size={20} />} label="Relatórios" active={activeView === 'reports'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('reports'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={<Settings size={20} />} label="Ajustes" active={activeView === 'settings'} collapsed={isSidebarCollapsed} onClick={() => { setActiveView('settings'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 space-y-2">
           <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-full flex items-center transition-all duration-300 rounded-xl p-3 ${
                isSidebarCollapsed ? 'justify-center' : 'space-x-3'
              } text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800`}
              title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Noturno"}
           >
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-400" />}
              {!isSidebarCollapsed && <span className="text-sm font-bold">{isDarkMode ? 'Modo Claro' : 'Modo Noturno'}</span>}
           </button>

           <button 
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className={`hidden lg:flex items-center transition-all duration-300 rounded-xl p-3 w-full ${
               isSidebarCollapsed ? 'justify-center' : 'space-x-3'
             } text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400`}
           >
             {isSidebarCollapsed ? <PanelLeftOpen size={24}/> : <><PanelLeftClose size={20}/> <span className="text-sm font-bold">Recolher</span></>}
           </button>
           
           {!isSidebarCollapsed && (
             <div className="flex items-center space-x-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-xl mt-2 transition-all">
                <ShieldCheck size={14} className="shrink-0"/>
                <span className="whitespace-nowrap overflow-hidden">Banco Local Ativo</span>
             </div>
           )}
        </div>
      </aside>

      <main 
        className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${
          isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 transition-colors">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400"><Menu size={20}/></button>
            <h2 className="text-sm md:text-lg font-black text-slate-700 dark:text-slate-200 capitalize tracking-tight">
              {activeView === 'sales_history' ? 'Histórico de Vendas' : activeView}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Saldo em Fiado</span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-500">R$ {totalOutstandingDebt.toFixed(2)}</span>
            </div>
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center">
               <img src="https://cdn-icons-png.flaticon.com/512/952/952763.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 pb-32 lg:pb-8 max-w-[1600px] mx-auto transition-all">
          
          {/* DASHBOARD */}
          {activeView === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard title="Vendas do Mês" value={`R$ ${totalSales.toFixed(2)}`} icon={<TrendingUp size={24} />} trend={`${filteredSales.length} transações`} trendUp={true} />
                <StatCard title="Fiados Ativos" value={`R$ ${totalOutstandingDebt.toFixed(2)}`} icon={<Users size={24} />} trend="Pendente" />
                <StatCard title="Contas a Pagar" value={`R$ ${pendingExpenses.toFixed(2)}`} icon={<Receipt size={24} />} trend="Vencendo" />
                <StatCard title="Ticket Médio" value={`R$ ${(totalSales / (filteredSales.length || 1)).toFixed(2)}`} icon={<HandCoins size={24} />} trendUp={true} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm h-[400px]">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg uppercase tracking-tight">Fluxo Diário</h3>
                      <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                         <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                         <span>Vendas</span>
                      </div>
                   </div>
                   <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: isDarkMode ? '#64748b' : '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: isDarkMode ? '#64748b' : '#94a3b8'}} />
                        <Tooltip 
                          contentStyle={{ 
                             borderRadius: '16px', 
                             border: 'none', 
                             boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                             backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                             color: isDarkMode ? '#f8fafc' : '#0f172a'
                          }}
                          formatter={(v: number) => `R$ ${v.toFixed(2)}`} 
                        />
                        <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
                <div className="bg-indigo-900 dark:bg-indigo-950 p-8 rounded-[40px] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Bell size={120}/></div>
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center space-x-3">
                            <div className="bg-indigo-600/50 p-2 rounded-xl"><Bell size={20} className="text-indigo-200" /></div>
                            <h3 className="font-black text-xl tracking-tight">IA Coruja Insight</h3>
                         </div>
                         <button onClick={fetchAIInsights} disabled={isLoadingAI} className="p-2 bg-white/10 rounded-full hover:bg-white/20 disabled:opacity-50 transition-all">
                            <RefreshCw size={16} className={isLoadingAI ? "animate-spin" : ""} />
                         </button>
                      </div>
                      <p className="italic text-indigo-100 dark:text-indigo-200/80 text-sm leading-relaxed whitespace-pre-wrap min-h-[60px]">
                        {isLoadingAI ? "Analisando padrões..." : (aiInsights || "Clique em atualizar para obter novos insights.")}
                      </p>
                   </div>
                   <button onClick={() => setActiveView('reports')} className="relative z-10 mt-8 flex items-center justify-between bg-white/10 hover:bg-white/20 transition-all p-4 rounded-2xl text-xs font-black uppercase text-indigo-300 group/btn">
                     <span>Relatório Completo</span>
                     <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform"/>
                 </button>
                </div>
              </div>
            </div>
          )}

          {/* POS */}
          {activeView === 'pos' && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                   <button onClick={() => setActiveView('sales_history')} className="flex items-center justify-center px-6 py-4 rounded-2xl font-black border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-indigo-100 dark:hover:border-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"><History size={20} className="mr-3"/>VER VENDAS</button>
                   <div className="flex flex-1 gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={20} />
                        <input type="text" placeholder="Nome do produto..." className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-transparent bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-600 dark:focus:border-indigo-500 transition-all font-semibold outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <button onClick={() => { setIsPOSScanning(true); startCamera(); }} className="bg-indigo-600 text-white px-6 rounded-2xl flex items-center shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 transition-all"><Camera size={24} /></button>
                   </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    {isPOSScanning && (
                      <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-video relative shadow-2xl border-4 border-indigo-600/20">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                        <canvas ref={canvasRef} className="hidden" />
                        {posLoading && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white"><RefreshCw className="animate-spin mb-4" size={32}/><span className="text-xs font-black uppercase tracking-widest">Identificando...</span></div>}
                        {!posLoading && !pendingProduct && <button onClick={capturePOSPhoto} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white w-16 h-16 rounded-full border-[6px] border-indigo-600 shadow-2xl active:scale-90 transition-all flex items-center justify-center"><Camera size={24} className="text-indigo-600"/></button>}
                        {pendingProduct && (
                            <div className="absolute inset-x-4 bottom-4 bg-white dark:bg-slate-800 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom-8">
                              <div className="flex justify-between items-center mb-6"><div><p className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest">Detectado</p><h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{pendingProduct.name}</h3></div><span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {pendingProduct.salePrice.toFixed(2)}</span></div>
                              <div className="flex gap-4"><button onClick={() => setPendingProduct(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-slate-400 dark:text-slate-300">FECHAR</button><button onClick={() => { addToCart(pendingProduct); setPendingProduct(null); }} className="flex-2 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg">ADICIONAR</button></div>
                            </div>
                        )}
                        <button onClick={() => { stopCamera(); setIsPOSScanning(false); }} className="absolute top-6 right-6 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-all"><X size={20}/></button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                        <button key={product.id} onClick={() => addToCart(product)} className={`bg-white dark:bg-slate-900 p-5 rounded-[28px] border-2 border-transparent shadow-sm text-left hover:border-indigo-600 dark:hover:border-indigo-500 hover:shadow-xl transition-all group relative overflow-hidden ${product.stock <= 0 ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                          <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="text-indigo-600 dark:text-indigo-400" size={16}/></div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm leading-tight">{product.name}</h4>
                          <div className="mt-4">
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none">R$ {product.salePrice.toFixed(2)}</p>
                            <div className="flex items-center justify-between mt-2">
                               <span className={`text-[10px] font-black uppercase tracking-wider ${product.stock <= product.minStock ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'}`}>Estoque: {product.stock}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col h-[70vh] lg:h-[calc(100vh-14rem)] sticky top-24 overflow-hidden">
                    <div className="p-8 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
                       <h3 className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[11px]">Cesto de Vendas</h3>
                       <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black">{cart.reduce((acc, i) => acc + i.quantity, 0)} ITENS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center opacity-10 dark:opacity-5"><ShoppingCart size={64}/><p className="font-black mt-4 uppercase tracking-widest text-xs">Vazio</p></div> : 
                        cart.map(item => (
                          <div key={item.productId} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-right-2">
                            <div className="flex-1 pr-4">
                                <p className="font-black text-slate-800 dark:text-slate-200 text-sm leading-tight line-clamp-2">{item.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">R$ {item.price.toFixed(2)} / un.</p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                                <button onClick={() => decreaseCartItemQuantity(item.productId)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700/50 rounded-full font-black text-xl text-slate-500 dark:text-slate-300 active:scale-90 transition-transform">-</button>
                                <span className="font-black text-base w-8 text-center tabular-nums">{item.quantity}</span>
                                <button onClick={() => increaseCartItem(item.productId)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700/50 rounded-full font-black text-xl text-slate-500 dark:text-slate-300 active:scale-90 transition-transform">+</button>
                            </div>
                            <div className="text-right w-24 ml-4">
                                <span className="font-black text-slate-800 dark:text-slate-200 text-lg tabular-nums">R$ {(item.quantity * item.price).toFixed(2)}</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    <div className="p-8 border-t dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 backdrop-blur-sm">
                      <div className="flex justify-between items-end mb-6">
                         <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total</span>
                         <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter leading-none">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                      </div>
                      <button onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none disabled:bg-slate-200 dark:disabled:bg-slate-800 active:scale-[0.98] transition-all text-lg tracking-tight">FECHAR VENDA</button>
                    </div>
                  </div>
                </div>
             </div>
          )}

          {/* SETTINGS */}
          {activeView === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
              <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative group">
                 <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform"><Cloud size={160} className="dark:text-slate-400" /></div>
                 <div className="relative z-10">
                    <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-4">
                       <Cloud className="text-indigo-600 dark:text-indigo-400" size={36}/>
                       Backups & Sincronização
                    </h3>
                    <p className="text-slate-400 dark:text-slate-500 mt-4 text-base leading-relaxed max-w-xl font-medium">Mantenha seus dados seguros na nuvem e acesse de qualquer lugar.</p>
                    
                    <div className="mt-10 bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800">
                      {!(apiKey && clientId) ? (
                        <div className="flex flex-col items-center text-center">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png" alt="Google Drive" className="w-16 h-16 mb-4"/>
                          <h4 className="font-black text-slate-800 dark:text-slate-100 text-xl mb-2">Conecte seu Google Drive</h4>
                          <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 max-w-sm">Para começar, configure suas credenciais da API do Google. Você só precisa fazer isso uma vez.</p>
                          <button onClick={() => setIsCredentialsModalOpen(true)} className="bg-indigo-600 text-white font-black py-5 px-10 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3">
                            <Settings size={20}/> CONFIGURAR CREDENCIAIS
                          </button>
                        </div>
                      ) : !isDriveAuthenticated ? (
                        <div className="flex flex-col items-center text-center">
                           <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png" alt="Google Drive" className="w-16 h-16 mb-4"/>
                           <h4 className="font-black text-slate-800 dark:text-slate-100 text-xl mb-2">Conectar ao Google Drive</h4>
                           <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 max-w-sm">Suas credenciais estão salvas. Autorize o acesso para começar a usar o backup na nuvem.</p>
                           <div className="flex flex-col items-center gap-4">
                            <button onClick={handleDriveAuth} className="bg-white text-slate-700 font-black py-5 px-10 rounded-2xl shadow-lg hover:bg-slate-200 transition-all active:scale-95 flex items-center gap-3">
                              CONECTAR AO GOOGLE
                            </button>
                            <button onClick={() => setIsCredentialsModalOpen(true)} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors">Editar credenciais</button>
                           </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                            <div className="flex items-center gap-3">
                              <img src={driveUser?.getImageUrl()} alt="User" className="w-10 h-10 rounded-full"/>
                              <div>
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{driveUser?.getName()}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{driveUser?.getEmail()}</p>
                              </div>
                            </div>
                            <button onClick={handleDriveSignOut} className="mt-3 sm:mt-0 flex items-center gap-2 text-xs font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors">
                              <LogOut size={14} /> DESCONECTAR
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button onClick={handleExportToDrive} disabled={isDriveLoading} className="bg-indigo-600 dark:bg-indigo-500 text-white font-black py-6 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
                              {isDriveLoading ? <RefreshCw size={24} className="animate-spin"/> : <Upload size={24}/>}
                              SALVAR NO DRIVE
                            </button>
                            <button onClick={handleImportFromDrive} disabled={isDriveLoading} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black py-6 rounded-2xl hover:bg-slate-50/50 transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-50">
                              {isDriveLoading ? <RefreshCw size={24} className="animate-spin"/> : <Download size={24}/>}
                              CARREGAR DO DRIVE
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-center font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-xs mb-6">Backup Local</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={handleExportLocalBackup} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold py-5 rounded-2xl text-sm flex items-center justify-center gap-3 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                          <Download size={18}/> Exportar para Dispositivo
                        </button>
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept=".json" onChange={handleImportLocalBackup} />
                          <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold py-5 rounded-2xl text-sm flex items-center justify-center gap-3 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <Upload size={18}/> Importar do Dispositivo
                          </div>
                        </label>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {activeView === 'inventory' && (
             <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                   <div className="flex flex-1 flex-col sm:flex-row gap-3">
                      <div className="relative flex-[2]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={20}/>
                        <input 
                           type="text" 
                           placeholder="Buscar produto..." 
                           className="w-full pl-14 pr-6 py-4 rounded-[20px] border-2 border-transparent bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-600 dark:focus:border-indigo-500 transition-all outline-none font-semibold" 
                           value={inventorySearch} 
                           onChange={e => setInventorySearch(e.target.value)} 
                        />
                      </div>
                      <div className="relative flex-1 group">
                         <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-indigo-600 transition-colors" size={18}/>
                         <select 
                            value={inventoryCategory} 
                            onChange={(e) => setInventoryCategory(e.target.value)}
                            className="w-full pl-11 pr-8 py-4 rounded-[20px] border-2 border-transparent bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-600 transition-all outline-none font-bold text-sm appearance-none cursor-pointer"
                         >
                            <option value="Todas">TODAS</option>
                            {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                         </select>
                         <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" size={16}/>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".pdf,.xml,.jpeg,.jpg,.png" style={{ display: 'none' }} />
                      <button onClick={() => { setEditingProduct(null); setNewProduct({ name: '', category: Category.ALIMENTOS, costPrice: 0, salePrice: 0, stock: 0, minStock: 5 }); setIsProductModalOpen(true); }} className="flex-1 lg:flex-none bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 px-6 py-4 rounded-[20px] font-black text-slate-600 dark:text-slate-400 flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"><Plus size={20}/> NOVO</button>
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 lg:flex-none bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 px-6 py-4 rounded-[20px] font-black text-slate-600 dark:text-slate-400 flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"><Upload size={20}/> IMPORTAR NF</button>
                      <button onClick={() => { setIsScanning(true); startCamera(); }} className="flex-1 lg:flex-none bg-indigo-600 text-white px-6 py-4 rounded-[20px] font-black flex items-center justify-center gap-3 shadow-lg dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"><Camera size={20}/> LER NF</button>
                   </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase border-b dark:border-slate-800">
                            <tr><th className="p-6">Nome / Categoria</th><th className="p-6 text-center">Estoque</th><th className="p-6 text-right">Venda</th><th className="p-6 text-center">Ações</th></tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                           {products.filter(p => 
                              p.name.toLowerCase().includes(inventorySearch.toLowerCase()) && 
                              (inventoryCategory === 'Todas' || p.category === inventoryCategory)
                           ).length === 0 ? (
                             <tr><td colSpan={4} className="p-20 text-center text-slate-300 dark:text-slate-600 italic font-black">Nenhum item encontrado.</td></tr>
                           ) : (
                             products.filter(p => 
                                p.name.toLowerCase().includes(inventorySearch.toLowerCase()) && 
                                (inventoryCategory === 'Todas' || p.category === inventoryCategory)
                             ).map(p => (
                               <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group transition-colors">
                                  <td className="p-6">
                                     <div className="font-black text-slate-800 dark:text-slate-200 text-base">{p.name}</div>
                                     <div className="text-[10px] text-indigo-400 dark:text-indigo-500 font-bold uppercase tracking-widest mt-1">{p.category}</div>
                                  </td>
                                  <td className="p-6 text-center">
                                     <span className={`inline-block px-4 py-2 rounded-2xl text-[11px] font-black tracking-widest ${p.stock <= p.minStock ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-100 dark:border-rose-900/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                        {p.stock} UN
                                     </span>
                                  </td>
                                  <td className="p-6 text-right font-black text-slate-800 dark:text-slate-200 text-lg">R$ {p.salePrice.toFixed(2)}</td>
                                  <td className="p-6">
                                     <div className="flex items-center justify-center gap-3">
                                        <button onClick={() => { setEditingProduct(p); setNewProduct({...p}); setIsProductModalOpen(true); }} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Edit2 size={18}/></button>
                                        <button onClick={() => deleteProduct(p.id)} className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                                     </div>
                                  </td>
                               </tr>
                             ))
                           )}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}

          {/* OUTRAS VIEWS (Manter lógica de filtragem/estilo) */}
          {activeView === 'sales_history' && (
             <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-indigo-600 dark:bg-indigo-700 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform"><TrendingUp size={140} /></div>
                      <p className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-2">Média Semanal</p>
                      <h3 className="text-5xl font-black tracking-tighter">R$ {(globalStats.weeklyTotal / 7).toFixed(2)}</h3>
                   </div>
                   <div className="bg-slate-900 dark:bg-slate-800 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden group border border-slate-700">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform"><Calendar size={140} /></div>
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Total Mês</p>
                      <h3 className="text-5xl font-black tracking-tighter text-indigo-400">R$ {globalStats.monthlyTotal.toFixed(2)}</h3>
                   </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                   <div className="p-8 border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex flex-col md:flex-row items-center justify-between gap-6">
                      <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl tracking-tight flex items-center"><CalendarDays size={28} className="mr-4 text-indigo-600" />Registros</h3>
                      <div className="flex items-center space-x-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                         <input type="date" className="outline-none font-black text-slate-700 dark:text-slate-200 bg-transparent px-2" value={selectedHistoryDate} onChange={(e) => setSelectedHistoryDate(e.target.value)} />
                      </div>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase border-b dark:border-slate-800">
                            <tr><th className="p-8">Horário</th><th className="p-8">Itens</th><th className="p-8">Pgto</th><th className="p-8 text-right">Total</th><th className="p-8 text-center">Ações</th></tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {sales.filter(s => s.date.startsWith(selectedHistoryDate)).length === 0 ? <tr><td colSpan={5} className="p-32 text-center text-slate-300 dark:text-slate-600 font-black italic">Sem vendas nesta data.</td></tr> : 
                              sales.filter(s => s.date.startsWith(selectedHistoryDate)).map(sale => (
                                <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                  <td className="p-8 font-black text-slate-700 dark:text-slate-200 text-lg">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td className="p-8">
                                     <div className="flex flex-col gap-2">
                                        {sale.items.map((it, idx) => (<span key={idx} className="text-xs font-semibold text-slate-500 dark:text-slate-400"><span className="text-indigo-600 dark:text-indigo-400 font-black">{it.quantity}x</span> {it.name}</span>))}
                                     </div>
                                  </td>
                                  <td className="p-8"><span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">{sale.paymentMethod}</span></td>
                                  <td className="p-8 text-right font-black text-slate-800 dark:text-slate-200 text-lg">R$ {sale.total.toFixed(2)}</td>
                                  <td className="p-8 text-center"><button onClick={() => handleDeleteSale(sale.id)} className="p-3 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-500 rounded-2xl transition-all"><Undo2 size={24}/></button></td>
                                </tr>
                              ))
                            }
                         </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            )}

            {activeView === 'customers' && (
               <div className="space-y-8 animate-in fade-in duration-500">
                 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
                        <Users className="mr-4 text-indigo-600 dark:text-indigo-400" size={36}/> Fiados Ativos
                      </h3>
                      <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 font-medium">Controle de créditos e confiança</p>
                    </div>
                    <button onClick={() => setIsCustomerModalOpen(true)} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-5 rounded-[24px] font-black flex items-center justify-center shadow-xl dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"><UserPlus size={20} className="mr-3"/> NOVO CLIENTE</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                   {customers.map(c => (
                     <div key={c.id} className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 hover:shadow-2xl transition-all group relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                          <div className="flex-1 pr-4">
                            <h4 className="font-black text-slate-800 dark:text-slate-100 text-xl leading-tight">{c.name}</h4>
                            <p className="text-xs text-slate-300 dark:text-slate-500 font-black uppercase mt-2 tracking-widest">{c.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Dívida</p>
                            <p className={`text-3xl font-black tracking-tighter ${c.currentDebt > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-500'}`}>R$ {c.currentDebt.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="space-y-2 relative z-10">
                          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                             <div className={`h-full transition-all duration-1000 ${c.currentDebt >= c.creditLimit ? 'bg-rose-500' : 'bg-indigo-600 dark:bg-indigo-500'}`} style={{ width: `${Math.min(100, (c.currentDebt / c.creditLimit) * 100)}%` }} />
                          </div>
                        </div>
                        <div className="pt-6 border-t dark:border-slate-800 flex justify-between items-center relative z-10">
                          <div>
                            <p className="text-[10px] text-slate-300 dark:text-slate-500 font-black uppercase tracking-widest">Já Pago</p>
                            <p className="text-lg font-black text-indigo-700 dark:text-indigo-400">R$ {c.totalPaid.toFixed(2)}</p>
                          </div>
                          <button onClick={() => { setSelectedCustomerForPayment(c); setPaymentAmount(c.currentDebt.toString()); setIsPaymentModalOpen(true); }} className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:text-white transition-all active:scale-95"><HandCoins size={18}/> RECEBER</button>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {activeView === 'expenses' && (
               <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 animate-in fade-in duration-500">
                  <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 sticky top-24 h-fit transition-colors">
                     <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-xl tracking-tight">Nova Despesa</h3>
                        <div className="flex items-center gap-2">
                          <input type="file" ref={expenseFileInputRef} onChange={handleExpenseFileImport} accept=".pdf,.xml,.jpeg,.jpg,.png" style={{ display: 'none' }} />
                          <button onClick={() => expenseFileInputRef.current?.click()} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:scale-110 transition-transform"><Upload size={24}/></button>
                          <button onClick={() => { setIsExpenseScanning(true); startCamera(); }} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:scale-110 transition-transform"><Camera size={24}/></button>
                        </div>
                     </div>
                     <div className="space-y-5">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                          <input type="text" placeholder="Ex: Energia..." className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl transition-all outline-none font-semibold" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Valor R$</label>
                             <input type="number" placeholder="0.00" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none font-black" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
                             <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none font-bold text-sm" value={newExpense.type} onChange={e => setNewExpense({...newExpense, type: e.target.value as ExpenseType})}>
                                <option value={ExpenseType.FIXA}>FIXA</option>
                                <option value={ExpenseType.ESTOQUE}>ESTOQUE</option>
                             </select>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Vencimento</label>
                          <input type="date" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none font-bold" value={newExpense.dueDate} onChange={e => setNewExpense({...newExpense, dueDate: e.target.value})} />
                       </div>
                       <button onClick={handleAddOrUpdateExpense} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-[0.98] transition-all text-lg mt-4">SALVAR</button>
                     </div>
                  </div>
                  <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                     <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[11px]">Pagamentos</h3>
                        <span className="text-rose-600 dark:text-rose-500 font-black text-xs uppercase tracking-tighter">Pendente: R$ {pendingExpenses.toFixed(2)}</span>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase border-b dark:border-slate-800">
                             <tr><th className="p-6">Vencimento</th><th className="p-6">Descrição</th><th className="p-6 text-right">Valor</th><th className="p-6 text-center">Status</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {expenses.length === 0 ? <tr><td colSpan={4} className="p-20 text-center text-slate-300 dark:text-slate-600 italic">Sem registros.</td></tr> : 
                               expenses.map(exp => (
                                 <tr key={exp.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                                   <td className="p-6 text-sm font-black text-slate-500 dark:text-slate-400">{new Date(exp.dueDate).toLocaleDateString('pt-BR')}</td>
                                   <td className="p-6">
                                      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{exp.description}</div>
                                      <div className="text-[9px] text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest">{exp.type}</div>
                                   </td>
                                   <td className="p-6 text-right font-black text-slate-900 dark:text-slate-100 text-lg">R$ {exp.amount.toFixed(2)}</td>
                                   <td className="p-6">
                                      <div className="flex items-center justify-center gap-3">
                                         <button onClick={() => setExpenses(prev => prev.map(e => e.id === exp.id ? {...e, isPaid: !e.isPaid} : e))} className={`p-3 rounded-2xl border-2 transition-all ${exp.isPaid ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40' : 'text-slate-200 dark:text-slate-700 border-slate-100 dark:border-slate-800 hover:border-indigo-100 hover:text-indigo-400'}`}>
                                            <Check size={20} strokeWidth={3}/>
                                         </button>
                                         <button onClick={() => setExpenses(prev => prev.filter(e => e.id !== exp.id))} className="p-3 text-slate-200 dark:text-slate-700 hover:text-rose-500 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-2xl transition-all"><Trash2 size={20}/></button>
                                      </div>
                                   </td>
                                 </tr>
                               ))
                             }
                          </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            )}

            {activeView === 'reports' && (
               <div className="space-y-10 animate-in fade-in duration-700">
                  <div className="bg-slate-900 dark:bg-slate-950 p-12 rounded-[56px] text-white shadow-2xl relative overflow-hidden border dark:border-slate-800">
                     <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12"><TrendingUp size={240}/></div>
                     <h3 className="text-2xl font-black mb-12 tracking-tight flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 dark:bg-indigo-700 rounded-2xl flex items-center justify-center"><CheckCircle2 size={24}/></div>
                        Performance Coruja
                     </h3>
                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
                        <div className="space-y-2">
                           <p className="text-slate-500 dark:text-slate-400 text-[11px] uppercase font-black tracking-widest">Receita Bruta</p>
                           <p className="text-4xl font-black tracking-tighter">R$ {totalSales.toFixed(2)}</p>
                        </div>
                        <div className="space-y-2">
                           <p className="text-slate-500 dark:text-slate-400 text-[11px] uppercase font-black tracking-widest">Média Venda</p>
                           <p className="text-4xl font-black tracking-tighter">R$ {(totalSales / (sales.length || 1)).toFixed(2)}</p>
                        </div>
                        <div className="space-y-2">
                           <p className="text-slate-500 dark:text-slate-400 text-[11px] uppercase font-black tracking-widest">Transações</p>
                           <p className="text-4xl font-black tracking-tighter text-indigo-400 dark:text-indigo-500">{sales.length}</p>
                        </div>
                        <div className="space-y-2">
                           <p className="text-slate-500 dark:text-slate-400 text-[11px] uppercase font-black tracking-widest">Saldo Fiado</p>
                           <p className="text-4xl font-black tracking-tighter text-rose-400 dark:text-rose-500">R$ {totalOutstandingDebt.toFixed(2)}</p>
                        </div>
                     </div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm relative group overflow-hidden transition-colors">
                     <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
                      <div className='flex justify-between items-center mb-8'>
                         <h3 className="font-black text-slate-800 dark:text-slate-100 text-2xl tracking-tight flex items-center">
                            <TrendingUp size={28} className="mr-4 text-indigo-600 dark:text-indigo-400"/> 
                            Análise Gemini Business
                         </h3>
                         <button onClick={fetchAIInsights} disabled={isLoadingAI} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-800 disabled:opacity-50 transition-all">
                            <RefreshCw size={20} className={isLoadingAI ? "animate-spin" : ""} />
                         </button>
                      </div>
                     <div className="text-slate-600 dark:text-slate-300 text-base leading-relaxed whitespace-pre-wrap bg-slate-50/50 dark:bg-slate-800/40 p-10 rounded-[32px] italic border border-slate-100 dark:border-slate-800 shadow-inner min-h-[200px] flex items-center justify-center">
                        {isLoadingAI ? (
                           <div className="flex flex-col items-center gap-4 text-slate-300 dark:text-slate-700">
                              <RefreshCw className="animate-spin" size={32}/>
                              <span className="font-black uppercase tracking-widest text-xs">A Coruja está pensando...</span>
                           </div>
                        ) : (
                           <div className="w-full font-medium">
                              {aiInsights || "Clique no botão de atualizar para gerar a análise de negócios."}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}

          </div>
        </main>

        {/* --- MODAIS (Com suporte a Dark Mode) --- */}
        <CredentialsModal 
          isOpen={isCredentialsModalOpen}
          onClose={() => setIsCredentialsModalOpen(false)}
          onSave={handleSaveCredentials}
          currentApiKey={apiKey}
          currentClientId={clientId}
        />

        {(scanLoading || expenseScanLoading) && (
            <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-4 text-white animate-in fade-in duration-300">
                <RefreshCw className="animate-spin mb-4" size={32}/>
                <span className="text-sm font-black uppercase tracking-widest">{scanLoading ? "Processando NF..." : "Processando Fatura..."}</span>
            </div>
        )}

        {isScanResultsModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-2xl w-full max-w-2xl animate-in slide-in-from-bottom-8">
                    <h3 className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[11px] mb-4">Itens Encontrados na NF</h3>
                    <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2">
                        {scannedResults.length > 0 ? scannedResults.map((r, i) => (
                            <div key={i} className="grid grid-cols-4 gap-4 items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-sm">
                                <span className="col-span-2 font-bold text-slate-700 dark:text-slate-200">{r.name}</span>
                                <span className="font-semibold text-slate-500 dark:text-slate-400">{r.quantity} un</span>
                                <span className="font-black text-indigo-600 dark:text-indigo-400 text-right">R$ {r.costPrice.toFixed(2)}</span>
                            </div>
                        )) : <p className="text-center p-8 text-slate-400">Nenhum item encontrado.</p>}
                    </div>
                    <div className="flex gap-4 mt-6">
                        <button onClick={() => setIsScanResultsModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-slate-400 dark:text-slate-300">FECHAR</button>
                        <button onClick={confirmImport} className="flex-2 bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-lg" disabled={scannedResults.length === 0}>IMPORTAR TUDO</button>
                    </div>
                </div>
            </div>
        )}

        {isPaymentModalOpen && selectedCustomerForPayment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-in zoom-in duration-300 border dark:border-slate-800">
              <h3 className="text-2xl font-black mb-2 text-slate-800 dark:text-slate-100 tracking-tight">Abater Fiado</h3>
              <p className="text-sm mb-8 text-slate-400 font-medium">Receber de: <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedCustomerForPayment.name}</span></p>
              <div className="relative mb-8">
                 <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 dark:text-slate-600 text-xl">R$</span>
                 <input autoFocus type="number" className="w-full pl-16 pr-8 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 rounded-3xl text-3xl font-black text-indigo-600 dark:text-indigo-400 outline-none transition-all" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase tracking-widest text-[11px]">CANCELAR</button>
                 <button onClick={handleRegisterPayment} className="flex-2 bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-95">CONFIRMAR</button>
              </div>
            </div>
          </div>
        )}

        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[48px] p-10 shadow-2xl space-y-8 animate-in zoom-in duration-300 border dark:border-slate-800">
              <div className="flex justify-between items-center">
                 <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Checkout</h3>
                 <button onClick={() => setIsCheckoutModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={28}/></button>
              </div>
              <div className="bg-indigo-600 dark:bg-indigo-700 p-8 rounded-[32px] flex flex-col items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                 <span className="text-xs font-black uppercase text-indigo-300 tracking-[0.2em] mb-2">Total à Receber</span>
                 <span className="text-5xl font-black tracking-tighter">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
              </div>
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-4">Método de Pagamento</p>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[PaymentMethod.DINHEIRO, PaymentMethod.PIX, PaymentMethod.CREDITO, PaymentMethod.DEBITO, PaymentMethod.FIADO].map(m => (
                      <button key={m} onClick={() => setSelectedPayment(m)} className={`p-4 rounded-[24px] border-2 font-black text-xs flex flex-col items-center gap-3 transition-all ${selectedPayment === m ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200' : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                         <span className="uppercase tracking-widest">{m}</span>
                      </button>
                    ))}
                 </div>
              </div>
              {selectedPayment === PaymentMethod.FIADO && (
                <div className="space-y-2 animate-in slide-in-from-top-4">
                   <p className="text-[10px] font-black text-rose-400 dark:text-rose-500 uppercase tracking-widest ml-4">Nome do Devedor:</p>
                   <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full p-5 border-2 border-rose-100 dark:border-rose-900/40 rounded-2xl font-black text-slate-700 dark:text-slate-200 bg-rose-50/30 dark:bg-rose-950/20 outline-none appearance-none cursor-pointer">
                      <option value="">-- SELECIONAR --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
              )}
              <button onClick={finalizeSale} className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-6 rounded-3xl font-black shadow-2xl dark:shadow-none hover:bg-indigo-700 transition-all text-xl uppercase">CONCLUIR</button>
            </div>
          </div>
        )}

        {isProductModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[48px] p-10 shadow-2xl animate-in zoom-in duration-300 border dark:border-slate-800">
                <h3 className="text-2xl font-black mb-8 text-slate-800 dark:text-slate-100 tracking-tight">{editingProduct ? 'Editar' : 'Novo'} Produto</h3>
                <div className="space-y-5">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                      <input type="text" placeholder="Nome..." className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-bold outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                      <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-black text-sm appearance-none outline-none cursor-pointer" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})}>
                         {Object.values(Category).map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Custo</label>
                         <input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none" value={newProduct.costPrice || ''} onChange={e => setNewProduct({...newProduct, costPrice: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Venda</label>
                         <input type="number" className="w-full p-4 bg-indigo-50/30 dark:bg-indigo-900/20 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-black outline-none" value={newProduct.salePrice || ''} onChange={e => setNewProduct({...newProduct, salePrice: Number(e.target.value)})} />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Estoque</label>
                         <input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Estoque Mín.</label>
                         <input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none" value={newProduct.minStock || ''} onChange={e => setNewProduct({...newProduct, minStock: Number(e.target.value)})} />
                      </div>
                   </div>
                   <div className="flex gap-4 mt-8">
                      <button onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-400 dark:text-slate-300 uppercase text-sm tracking-widest">Cancelar</button>
                      <button onClick={handleSaveProduct} className="flex-[2] bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95">SALVAR PRODUTO</button>
                   </div>
                </div>
             </div>
          </div>
        )}
        
        {isCustomerModalOpen && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[48px] p-10 shadow-2xl animate-in zoom-in duration-300 border dark:border-slate-800">
                <h3 className="text-2xl font-black mb-8 text-slate-800 dark:text-slate-100 tracking-tight">Novo Cliente (Fiado)</h3>
                <div className="space-y-5">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                      <input type="text" placeholder="Nome do cliente..." className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-bold outline-none" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Telefone</label>
                         <input type="tel" placeholder="(00) 00000-0000" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl outline-none" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Limite R$</label>
                         <input type="number" placeholder="0.00" className="w-full p-4 bg-indigo-50/30 dark:bg-indigo-900/20 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-black outline-none" value={newCustomer.creditLimit || ''} onChange={e => setNewCustomer({...newCustomer, creditLimit: Number(e.target.value)})} />
                      </div>
                   </div>
                   <div className="flex gap-4 mt-8">
                      <button onClick={() => setIsCustomerModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-400 dark:text-slate-300 uppercase text-sm tracking-widest">Cancelar</button>
                      <button onClick={handleAddCustomer} className="flex-[2] bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95">SALVAR CLIENTE</button>
                   </div>
                </div>
             </div>
           </div>
        )}

        {isScanning && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
             <div className="w-full max-w-3xl aspect-video bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl border-4 border-indigo-600/20">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                <canvas ref={canvasRef} className="hidden" />
             </div>
             <div className="mt-8 flex items-center justify-center gap-6">
                <button onClick={() => { stopCamera(); setIsScanning(false); }} className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full text-white flex items-center justify-center active:scale-90 transition-all"><X size={24}/></button>
                <button onClick={capturePhotoNF} className="w-20 h-20 bg-white rounded-full border-[6px] border-indigo-600 shadow-2xl active:scale-90 transition-all"></button>
                <div className="w-16 h-16"></div>
             </div>
          </div>
        )}

        {isExpenseScanning && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
             <div className="w-full max-w-3xl aspect-video bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl border-4 border-indigo-600/20">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                <canvas ref={canvasRef} className="hidden" />
             </div>
             <div className="mt-8 flex items-center justify-center gap-6">
                <button onClick={() => { stopCamera(); setIsExpenseScanning(false); }} className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full text-white flex items-center justify-center active:scale-90 transition-all"><X size={24}/></button>
                <button onClick={captureExpensePhoto} className="w-20 h-20 bg-white rounded-full border-[6px] border-indigo-600 shadow-2xl active:scale-90 transition-all"></button>
                <div className="w-16 h-16"></div>
             </div>
          </div>
        )}

    </div>
  );
}

// Separate component for credentials modal to keep main component cleaner
const CredentialsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, clientId: string) => void;
  currentApiKey: string;
  currentClientId: string;
}> = ({ isOpen, onClose, onSave, currentApiKey, currentClientId }) => {
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [clientId, setClientId] = useState(currentClientId);
  const [showApi, setShowApi] = useState(false);
  const [showClient, setShowClient] = useState(false);

  useEffect(() => {
    setApiKey(currentApiKey);
    setClientId(currentClientId);
  }, [isOpen, currentApiKey, currentClientId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[48px] p-10 shadow-2xl animate-in zoom-in duration-300 border dark:border-slate-800 relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={28}/></button>
        <div className="flex items-center gap-4 mb-8">
           <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl"><KeyRound size={32}/></div>
           <div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Credenciais Google</h3>
              <p className="text-slate-400 dark:text-slate-500 font-medium mt-1">Insira suas chaves do Google Cloud Platform.</p>
           </div>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Chave de API</label>
            <div className="relative">
              <input 
                type={showApi ? 'text' : 'password'}
                placeholder="Cole sua Chave de API aqui" 
                className="w-full p-4 pl-6 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-mono text-sm tracking-wider outline-none" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
              />
              <button onClick={() => setShowApi(!showApi)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                {showApi ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">ID do Cliente OAuth 2.0</label>
            <div className="relative">
              <input 
                type={showClient ? 'text' : 'password'}
                placeholder="Cole seu ID do Cliente aqui" 
                className="w-full p-4 pl-6 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 dark:focus:border-indigo-500 dark:text-slate-100 rounded-2xl font-mono text-sm tracking-wider outline-none" 
                value={clientId} 
                onChange={e => setClientId(e.target.value)} 
              />
              <button onClick={() => setShowClient(!showClient)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                {showClient ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t dark:border-slate-800 text-center">
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 mb-6 hover:underline">
               Não sabe onde encontrar? Visite o Google Cloud Console <ExternalLink size={14}/>
            </a>
            <button 
              onClick={() => onSave(apiKey, clientId)} 
              className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black shadow-2xl dark:shadow-none hover:bg-indigo-700 transition-all text-lg uppercase disabled:opacity-50"
              disabled={!apiKey || !clientId}
            >
              SALVAR E CONECTAR
            </button>
        </div>
      </div>
    </div>
  );
};
