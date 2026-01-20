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
  Camera,
  RefreshCw,
  Check,
  Users,
  Calendar,
  CheckCircle2,
  UserPlus,
  HandCoins,
  ChevronDown,
  Edit2,
  History,
  Undo2,
  CalendarDays,
  ShieldCheck,
  Settings,
  Download,
  Upload,
  Cloud,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Moon,
  Sun,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import { Product, Sale, Expense, View, Category, SaleItem, ScannedProduct, PaymentMethod, ExpenseType, Customer } from './types.ts';
import { INITIAL_PRODUCTS, INITIAL_EXPENSES, INITIAL_SALES, INITIAL_CUSTOMERS } from './constants.ts';
import { extractProductsFromMedia, identifyProductFromImage, extractExpenseFromMedia } from './services/geminiService.ts';

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
  CLIENT_ID: 'coruja_google_client_id',
  GEMINI_API_KEY: 'coruja_gemini_api_key',
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
  
  // --- API Keys State ---
  const [clientId, setClientId] = useState(() => localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '');

  // --- Google Drive State ---
  const [isDriveAuthenticated, setIsDriveAuthenticated] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveUser, setDriveUser] = useState<any>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [googleScriptsLoaded, setGoogleScriptsLoaded] = useState(false);
  const scriptsInitiated = useRef(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  
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
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId); }, [clientId]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, geminiApiKey); }, [geminiApiKey]);

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

  const capturePOSPhoto = async () => { if (canvasRef.current && videoRef.current) { setPosLoading(true); const ctx = canvasRef.current.getContext('2d'); canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight; ctx?.drawImage(videoRef.current, 0, 0); const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1]; try { const product = await identifyProductFromImage(base64, products, geminiApiKey); if (product) setPendingProduct(product); else alert("Produto não identificado."); } catch (e) { alert("Erro ao identificar. Verifique sua chave Gemini em Ajustes."); } finally { setPosLoading(false); } } };
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
            
            const results = await extractProductsFromMedia(base64Data, mimeType, geminiApiKey);
            if(results.length > 0) {
                setScannedResults(results);
                setIsScanResultsModalOpen(true);
            } else {
                alert("Nenhum produto encontrado no arquivo.");
            }
        } catch (err) {
            alert("Erro ao processar o arquivo da NF. Verifique sua chave Gemini em Ajustes.");
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

            const result = await extractExpenseFromMedia(base64Data, mimeType, geminiApiKey);
            setNewExpense({ description: result.description, amount: result.amount, dueDate: result.dueDate, type: result.type });
        } catch (err) {
            alert("Erro ao processar o arquivo da fatura. Verifique sua chave Gemini em Ajustes.");
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
        const results = await extractProductsFromMedia(base64, 'image/jpeg', geminiApiKey); 
        setScannedResults(results); 
        setIsScanResultsModalOpen(true);
      } catch (e) { 
        alert("Erro ao ler NF. Verifique sua chave Gemini em Ajustes."); 
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
        const result = await extractExpenseFromMedia(base64, 'image/jpeg', geminiApiKey); 
        setNewExpense({ description: result.description, amount: result.amount, dueDate: result.dueDate, type: result.type }); 
        stopCamera(); 
        setIsExpenseScanning(false); 
      } catch (e) { 
        alert("Erro ao ler fatura. Verifique sua chave Gemini em Ajustes."); 
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
  const dailySales = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sales
        .filter(s => s.date.startsWith(today))
        .reduce((acc, s) => acc + s.total, 0);
  }, [sales]);

  // --- Google Drive Integration ---
  const initializeGoogleClients = useCallback((currentClientId: string) => {
    if (scriptsInitiated.current || !currentClientId) return;
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
              
              window.gapi.client.load('drive', 'v3').then(() => {
                console.log("GAPI client for Drive loaded.");
              }).catch((err: any) => {
                console.error("Error loading GAPI Drive client:", err);
                alert("Falha ao carregar a API do Google Drive.");
              });

              fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
              })
              .then(res => res.json())
              .then(data => setDriveUser(data))
              .catch(err => console.error("Error fetching user info:", err));
            }
          },
        });
        setTokenClient(client);
        setGoogleScriptsLoaded(true);
      } catch (error) {
        console.error("Error initializing GIS client:", error);
      }
    };
  
    const handleGapiLoad = () => {
      window.gapi.load('client:picker', () => {
        gisScript.onload = handleGisLoad;
        document.body.appendChild(gisScript);
      });
    };
  
    gapiScript.onload = handleGapiLoad;
    document.body.appendChild(gapiScript);
  }, []);

  useEffect(() => {
    if (clientId) {
      initializeGoogleClients(clientId);
    }
  }, [clientId, initializeGoogleClients]);

  const handleSaveApiKeys = (keys: { clientId: string; geminiApiKey: string }) => {
    setClientId(keys.clientId);
    setGeminiApiKey(keys.geminiApiKey);
    setIsApiKeysModalOpen(false);
    
    if (keys.clientId !== clientId) {
      scriptsInitiated.current = false;
      setGoogleScriptsLoaded(false);
      initializeGoogleClients(keys.clientId);
    }
  };

  const handleDriveAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
       alert("O serviço de autenticação do Google ainda está carregando.");
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
      alert("Backup salvo no Google Drive!");
    } catch (error) {
      console.error("Error uploading to Drive:", error);
      alert("Erro ao salvar no Drive.");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const pickerCallback = useCallback(async (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const fileId = data.docs[0].id;
      setIsDriveLoading(true);
      try {
        if (!confirm("Restaurar backup do Drive?")) {
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
          alert("Backup restaurado!");
        }
      } catch (error) {
        console.error("Error downloading from Drive:", error);
        alert("Erro ao restaurar.");
      } finally {
        setIsDriveLoading(false);
      }
    }
  }, [setProducts, setSales, setExpenses, setCustomers]);

  const handleImportFromDrive = () => {
    if (!isDriveAuthenticated) return handleDriveAuth();
    
    const token = window.gapi.client.getToken();
    if (!token) return alert("Sessão expirada.");

    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    view.setMimeTypes("application/json");

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token.access_token)
      .setDeveloperKey(geminiApiKey)
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
              {activeView}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Saldo do Dia</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-500">R$ {dailySales.toFixed(2)}</span>
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
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm h-[400px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: isDarkMode ? '#64748b' : '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: isDarkMode ? '#64748b' : '#94a3b8'}} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                        <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* POS */}
          {activeView === 'pos' && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                   <button onClick={() => setActiveView('sales_history')} className="flex items-center justify-center px-6 py-4 rounded-2xl font-black border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><History size={20} className="mr-3"/>VER VENDAS</button>
                   <div className="flex flex-1 gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={20} />
                        <input type="text" placeholder="Nome do produto..." className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-transparent bg-white dark:bg-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-600 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <button onClick={() => { setIsPOSScanning(true); startCamera(); }} className="bg-indigo-600 text-white px-6 rounded-2xl flex items-center shadow-lg"><Camera size={24} /></button>
                   </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                        <button key={product.id} onClick={() => addToCart(product)} className={`bg-white dark:bg-slate-900 p-5 rounded-[28px] border-2 border-transparent shadow-sm text-left hover:border-indigo-600 transition-all group relative overflow-hidden ${product.stock <= 0 ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{product.name}</h4>
                          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-4">R$ {product.salePrice.toFixed(2)}</p>
                          <span className="text-[10px] text-slate-400 block mt-2">Estoque: {product.stock}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col h-[60vh] lg:h-[calc(100vh-14rem)] sticky top-24 overflow-hidden">
                    <div className="p-8 border-b dark:border-slate-800 flex justify-between items-center">
                       <h3 className="font-black text-slate-400 uppercase tracking-widest text-[11px]">Cesto</h3>
                       <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black">{cart.reduce((acc, i) => acc + i.quantity, 0)} ITENS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {cart.map(item => (
                          <div key={item.productId} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex-1 pr-4">
                                <p className="font-black text-slate-800 dark:text-slate-200 text-sm">{item.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => decreaseCartItemQuantity(item.productId)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-full font-black">-</button>
                                <span className="font-black">{item.quantity}</span>
                                <button onClick={() => increaseCartItem(item.productId)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-full font-black">+</button>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    <div className="p-8 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex justify-between items-end mb-6">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                         <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">R$ {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                      </div>
                      <button onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length === 0} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl disabled:bg-slate-200 active:scale-95 transition-all">FECHAR VENDA</button>
                    </div>
                  </div>
                </div>
             </div>
          )}

          {/* SETTINGS */}
          {activeView === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden relative">
                    <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-4">
                        <Settings className="text-indigo-600 dark:text-indigo-400" size={36}/>
                        Configurações & Chaves
                    </h3>
                    <div className="mt-10 bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800">
                        <button onClick={() => setIsApiKeysModalOpen(true)} className="bg-indigo-600 text-white font-black py-5 px-10 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-3">
                          <KeyRound size={20}/> CONFIGURAR CHAVES DE API
                        </button>
                    </div>
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button onClick={handleExportLocalBackup} className="bg-slate-100 dark:bg-slate-800 text-slate-600 p-5 rounded-2xl font-bold flex items-center gap-3">
                        <Download size={18}/> Exportar Backup Local
                      </button>
                      <label className="cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-600 p-5 rounded-2xl font-bold flex items-center gap-3">
                        <input type="file" className="hidden" accept=".json" onChange={handleImportLocalBackup} />
                        <Upload size={18}/> Importar Backup Local
                      </label>
                    </div>
                </div>
            </div>
          )}

          {/* Adicione outras views conforme necessário */}
        </div>
      </main>

      <ApiKeysModal 
        isOpen={isApiKeysModalOpen}
        onClose={() => setIsApiKeysModalOpen(false)}
        onSave={handleSaveApiKeys}
        currentClientId={clientId}
        currentGeminiApiKey={geminiApiKey}
      />
    </div>
  );
}

const ApiKeysModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: { clientId: string; geminiApiKey: string }) => void;
  currentClientId: string;
  currentGeminiApiKey: string;
}> = ({ isOpen, onClose, onSave, currentClientId, currentGeminiApiKey }) => {
  const [clientId, setClientId] = useState(currentClientId);
  const [geminiApiKey, setGeminiApiKey] = useState(currentGeminiApiKey);
  const [showGemini, setShowGemini] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[48px] p-10 shadow-2xl border dark:border-slate-800 relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-300 hover:bg-slate-100 rounded-xl transition-all"><X size={28}/></button>
        <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-8">Chaves de API</h3>
        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google Client ID (Drive)</label>
            <input 
              type="text"
              placeholder="Google Client ID" 
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none" 
              value={clientId} 
              onChange={e => setClientId(e.target.value)} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gemini API Key (IA)</label>
            <div className="relative">
              <input 
                type={showGemini ? 'text' : 'password'}
                placeholder="Gemini API Key" 
                className="w-full p-4 pl-6 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none" 
                value={geminiApiKey} 
                onChange={e => setGeminiApiKey(e.target.value)} 
              />
              <button onClick={() => setShowGemini(!showGemini)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                {showGemini ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>
          </div>
        </div>
        <button 
          onClick={() => onSave({ clientId, geminiApiKey })} 
          className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black mt-8 shadow-xl"
        >
          SALVAR CHAVES
        </button>
      </div>
    </div>
  );
};