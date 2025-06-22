
import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Transaction, Account, Category, TransactionType, GeminiParsedTransaction } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, PlusIcon, EditIcon, TrashIcon, CheckIcon, CogIcon, ChartPieIcon, ListBulletIcon, CreditCardIcon, BuildingLibraryIcon, APP_NAME, XIcon, MenuIcon } from './constants';
import Modal from './components/Modal';
import { parseTransactionWithGemini } from './services/geminiService';

// localStorage keys
const LS_TRANSACTIONS = 'GASTOZEN_TRANSACTIONS_V2';
const LS_ACCOUNTS = 'GASTOZEN_ACCOUNTS_V2';
const LS_CATEGORIES = 'GASTOZEN_CATEGORIES_V2';
const LS_THEME = 'GASTOZEN_THEME_V1';

// Theme Context
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(LS_THEME) as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};


// Helper for localStorage
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
};

// GastoZen Context
interface GastoZenContextType {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (transactionId: string) => void;
  addAccount: (account: Omit<Account, 'id' | 'balance'> & { initialBalance: number }) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (accountId: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (categoryId: string) => void;
  getCategoryById: (id: string) => Category | undefined;
  getAccountById: (id: string) => Account | undefined;
}

const GastoZenContext = createContext<GastoZenContextType | undefined>(undefined);

export const useGastoZen = (): GastoZenContextType => {
  const context = useContext(GastoZenContext);
  if (!context) {
    throw new Error('useGastoZen must be used within a GastoZenProvider');
  }
  return context;
};

// Provider Component
const GastoZenProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(LS_TRANSACTIONS, []);
  const [accounts, setAccounts] = useLocalStorage<Account[]>(LS_ACCOUNTS, DEFAULT_ACCOUNTS);
  const [categories, setCategories] = useLocalStorage<Category[]>(LS_CATEGORIES, DEFAULT_CATEGORIES);

  const updateAccountBalance = useCallback((accountId: string, amount: number, transactionType: 'add' | 'subtract' | 'set') => {
    setAccounts(prevAccounts =>
      prevAccounts.map(acc => {
        if (acc.id === accountId) {
          let newBalance = acc.balance;
          if (transactionType === 'add') newBalance += amount;
          else if (transactionType === 'subtract') newBalance -= amount;
          else if (transactionType === 'set') newBalance = amount;
          return { ...acc, balance: newBalance };
        }
        return acc;
      })
    );
  }, [setAccounts]);

  const addTransaction = useCallback((transactionData: Omit<Transaction, 'id'>) => {
    if (transactionData.type === 'expense') {
      const account = accounts.find(a => a.id === transactionData.accountId);
      if (account && transactionData.amount > account.balance) {
        alert(`Fondos insuficientes en la cuenta '${account.name}' para cubrir este gasto de ₲${transactionData.amount.toLocaleString()}. Saldo actual: ₲${account.balance.toLocaleString()}.`);
        return;
      }
    }

    const newTransaction: Transaction = { ...transactionData, id: `trans-${Date.now()}` };
    setTransactions(prev => [newTransaction, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() ));
    if (newTransaction.type === 'income') {
      updateAccountBalance(newTransaction.accountId, newTransaction.amount, 'add');
    } else {
      updateAccountBalance(newTransaction.accountId, newTransaction.amount, 'subtract');
    }
  }, [setTransactions, updateAccountBalance, accounts]);

  const updateTransaction = useCallback((updatedTransaction: Transaction) => {
    const originalTransaction = transactions.find(t => t.id === updatedTransaction.id);

    if (!originalTransaction) {
      console.error("Transacción original no encontrada para actualizar.");
      return;
    }

    if (updatedTransaction.type === 'expense') {
      const targetAccount = accounts.find(a => a.id === updatedTransaction.accountId);
      if (targetAccount) {
        let effectiveBalance = targetAccount.balance;
        if (originalTransaction.accountId === updatedTransaction.accountId) {
          if (originalTransaction.type === 'income') {
            effectiveBalance -= originalTransaction.amount; 
          } else { 
            effectiveBalance += originalTransaction.amount; 
          }
        }
        if (updatedTransaction.amount > effectiveBalance) {
          alert(`Fondos insuficientes en la cuenta '${targetAccount.name}' para actualizar este gasto a ₲${updatedTransaction.amount.toLocaleString()}. Saldo efectivo después de revertir la transacción original: ₲${effectiveBalance.toLocaleString()}.`);
          return;
        }
      } else {
        console.error("Cuenta de destino no encontrada para la transacción actualizada.");
        return; 
      }
    }
    
    setTransactions(prev => {
      return prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t)
                 .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    if (originalTransaction.type === 'income') {
      updateAccountBalance(originalTransaction.accountId, originalTransaction.amount, 'subtract');
    } else {
      updateAccountBalance(originalTransaction.accountId, originalTransaction.amount, 'add');
    }

    if (updatedTransaction.type === 'income') {
      updateAccountBalance(updatedTransaction.accountId, updatedTransaction.amount, 'add');
    } else {
      updateAccountBalance(updatedTransaction.accountId, updatedTransaction.amount, 'subtract');
    }
  }, [setTransactions, updateAccountBalance, transactions, accounts]);

  const deleteTransaction = useCallback((transactionId: string) => {
    const transactionToDelete = transactions.find(t => t.id === transactionId);
    if (transactionToDelete) {
      if (transactionToDelete.type === 'income') {
        const account = accounts.find(a => a.id === transactionToDelete.accountId);
        if (account && (account.balance - transactionToDelete.amount < 0)) {
            alert(`Eliminar este ingreso de ₲${transactionToDelete.amount.toLocaleString()} dejaría la cuenta '${account.name}' con saldo negativo (nuevo saldo: ₲${(account.balance - transactionToDelete.amount).toLocaleString()}). Por favor, ajusta otros gastos o agrega fondos primero.`);
            return; 
        }
      }

      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      if (transactionToDelete.type === 'income') {
        updateAccountBalance(transactionToDelete.accountId, transactionToDelete.amount, 'subtract');
      } else {
        updateAccountBalance(transactionToDelete.accountId, transactionToDelete.amount, 'add');
      }
    }
  }, [transactions, setTransactions, updateAccountBalance, accounts]);

  const addAccount = useCallback((accountData: Omit<Account, 'id' | 'balance'> & { initialBalance: number }) => {
    // Validation for negative initialBalance is now handled in AccountForm
    const newAccount: Account = { ...accountData, id: `acc-${Date.now()}`, balance: accountData.initialBalance };
    setAccounts(prev => [...prev, newAccount]);
  }, [setAccounts]);

  const updateAccount = useCallback((updatedAccount: Account) => {
    // Validation for negative balance is now handled in AccountForm
    setAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
  }, [setAccounts]);

  const deleteAccount = useCallback((accountId: string) => {
    if (transactions.some(t => t.accountId === accountId)) {
        alert("No se puede eliminar una cuenta con transacciones. Por favor, reasigna o elimina las transacciones primero.");
        return;
    }
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
  }, [setAccounts, transactions]);

  const addCategory = useCallback((categoryData: Omit<Category, 'id'>) => {
    const newCategory: Category = { ...categoryData, id: `cat-${Date.now()}` };
    setCategories(prev => [...prev, newCategory]);
  }, [setCategories]);

  const updateCategory = useCallback((updatedCategory: Category) => {
    setCategories(prev => prev.map(cat => cat.id === updatedCategory.id ? updatedCategory : cat));
  }, [setCategories]);

  const deleteCategory = useCallback((categoryId: string) => {
     if (transactions.some(t => t.categoryId === categoryId)) {
        alert("No se puede eliminar una categoría con transacciones. Por favor, reasigna o elimina las transacciones primero.");
        return;
    }
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
  }, [setCategories, transactions]);

  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);
  const getAccountById = useCallback((id: string) => accounts.find(a => a.id === id), [accounts]);

  const contextValue: GastoZenContextType = {
    transactions, accounts, categories,
    addTransaction, updateTransaction, deleteTransaction,
    addAccount, updateAccount, deleteAccount,
    addCategory, updateCategory, deleteCategory,
    getCategoryById, getAccountById
  };

  return <GastoZenContext.Provider value={contextValue}>{children}</GastoZenContext.Provider>;
};


// UI Components
const NavItem: React.FC<{ to: string; icon: ReactNode; label: string; onClick?: () => void }> = ({ to, icon, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out hover:bg-primary-dark hover:text-white ${
        isActive ? 'bg-primary-dark text-white shadow-md' : 'text-gray-200 hover:text-white'
      }`
    }
  >
    {icon}
    <span className="font-medium">{label}</span>
  </NavLink>
);

const Sidebar: React.FC<{ isOpen: boolean; toggleSidebar: () => void; closeSidebar: () => void; }> = ({ isOpen, toggleSidebar, closeSidebar }) => {
  const handleNavItemClick = () => {
    if (window.innerWidth < 768) { // md breakpoint
      closeSidebar();
    }
  };

  return (
    <div 
      className={`fixed inset-y-0 left-0 w-64 bg-primary text-white h-screen p-5 flex flex-col shadow-lg z-40 transform transition-transform duration-300 ease-in-out dark:bg-teal-700 
                 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      aria-hidden={!isOpen && window.innerWidth < 768}
    >
      <div className="flex justify-between items-center mb-10">
        <Link to="/" onClick={handleNavItemClick} className="text-3xl font-bold flex items-center justify-center space-x-2 text-white hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <span>{APP_NAME}</span>
        </Link>
        <button 
          onClick={toggleSidebar} 
          className="md:hidden text-gray-200 hover:text-white p-1"
          aria-label="Cerrar menú"
        >
          <XIcon className="w-7 h-7" />
        </button>
      </div>
      <nav className="flex-grow space-y-3">
        <NavItem to="/" icon={<ChartPieIcon className="w-6 h-6" />} label="Panel" onClick={handleNavItemClick} />
        <NavItem to="/transactions" icon={<ListBulletIcon className="w-6 h-6" />} label="Transacciones" onClick={handleNavItemClick} />
        <NavItem to="/accounts" icon={<CreditCardIcon className="w-6 h-6" />} label="Cuentas" onClick={handleNavItemClick} />
        <NavItem to="/categories" icon={<BuildingLibraryIcon className="w-6 h-6" />} label="Categorías" onClick={handleNavItemClick} />
      </nav>
      <div className="mt-auto">
          <NavItem to="/settings" icon={<CogIcon className="w-6 h-6" />} label="Configuración" onClick={handleNavItemClick} />
      </div>
    </div>
  );
};

const getPageTitle = (pathname: string): string => {
  switch (pathname) {
    case '/': return 'Panel';
    case '/transactions': return 'Transacciones';
    case '/accounts': return 'Cuentas';
    case '/categories': return 'Categorías';
    case '/settings': return 'Configuración';
    default: return APP_NAME;
  }
};

const Layout: React.FC<{children: ReactNode, isSidebarOpen: boolean, toggleSidebar: () => void, closeSidebar: () => void}> = ({ children, isSidebarOpen, toggleSidebar, closeSidebar }) => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) {
      closeSidebar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); 

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} closeSidebar={closeSidebar} />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
      
      <main className="flex-1 flex flex-col md:ml-64 transition-all duration-300 ease-in-out min-w-0">
        <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-800 shadow-md flex items-center justify-between px-4 py-3">
            <button
                aria-label="Abrir menú"
                onClick={toggleSidebar}
                className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
            >
                <MenuIcon className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                {pageTitle}
            </h1>
            <div className="w-8"></div> 
        </div>
        
        <div className="flex-1 p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
};

// Pages (Components rendered by Router)

const DashboardPage: React.FC = () => {
  const { transactions, accounts, categories, getCategoryById, getAccountById } = useGastoZen();

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthlyTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const monthlyIncome = monthlyTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseByCategory = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const category = getCategoryById(t.categoryId);
      const categoryName = category ? category.name : 'Sin Categoría';
      acc[categoryName] = (acc[categoryName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const sortedExpenseCategories = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-8 hidden md:block">Panel</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-1">Saldo Total</h2>
          <p className={`text-4xl font-bold ${totalBalance >= 0 ? 'text-primary dark:text-primary-light' : 'text-expense dark:text-red-400'}`}>
            ₲{totalBalance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-1">Ingresos del Mes (Actual)</h2>
          <p className="text-3xl font-bold text-income dark:text-emerald-400">
            + ₲{monthlyIncome.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-1">Gastos del Mes (Actual)</h2>
          <p className="text-3xl font-bold text-expense dark:text-red-400">
            - ₲{monthlyExpenses.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Transacciones Recientes</h2>
          {transactions.slice(0, 5).map(t => {
            const category = getCategoryById(t.categoryId);
            const account = getAccountById(t.accountId);
            return (
              <div key={t.id} className="flex justify-between items-center py-3 border-b last:border-b-0 border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-200">{t.description}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{category?.name} &bull; {account?.name}</p>
                </div>
                <p className={`font-semibold ${t.type === 'income' ? 'text-income dark:text-emerald-400' : 'text-expense dark:text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'} ₲{t.amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </p>
              </div>
            );
          })}
           {transactions.length === 0 && <p className="text-gray-500 dark:text-gray-400">Aún no hay transacciones.</p>}
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Principales Categorías de Gasto (Mes Actual)</h2>
          {sortedExpenseCategories.length > 0 ? sortedExpenseCategories.map(([name, amount]) => (
            <div key={name} className="flex justify-between items-center py-2">
              <p className="text-gray-600 dark:text-gray-300">{name}</p>
              <p className="font-medium text-expense dark:text-red-400">₲{amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
            </div>
          )) : <p className="text-gray-500 dark:text-gray-400">No hay gastos este mes.</p>}
        </div>
      </div>
    </div>
  );
};


const TransactionForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialTransaction?: Transaction | null;
}> = ({ isOpen, onClose, initialTransaction }) => {
  const { categories, accounts, addTransaction, updateTransaction } = useGastoZen();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [geminiInput, setGeminiInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTransaction) {
      setDate(initialTransaction.date);
      setDescription(initialTransaction.description);
      setAmount(String(initialTransaction.amount));
      setType(initialTransaction.type);
      setCategoryId(initialTransaction.categoryId);
      setAccountId(initialTransaction.accountId);
      setNotes(initialTransaction.notes || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setAmount('');
      setType('expense');
      setCategoryId(categories.find(c => c.type === 'expense')?.id || '');
      setAccountId(accounts[0]?.id || '');
      setNotes('');
    }
    setGeminiInput('');
    setParseError(null);
  }, [initialTransaction, isOpen, categories, accounts]); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !accountId) {
      alert("Por favor, completa todos los campos requeridos.");
      return;
    }
    const transactionData = {
      date,
      description,
      amount: parseFloat(amount),
      type,
      categoryId,
      accountId,
      notes,
    };
    if (initialTransaction) {
      updateTransaction({ ...transactionData, id: initialTransaction.id });
    } else {
      addTransaction(transactionData);
    }
    onClose();
  };

  const handleGeminiParse = async () => {
    if (!geminiInput.trim()) {
      setParseError("Por favor, ingresa texto para analizar.");
      return;
    }
    setIsParsing(true);
    setParseError(null);
    try {
      const parsedData = await parseTransactionWithGemini(geminiInput, categories, accounts);
      if (parsedData) {
        setDescription(parsedData.description);
        setAmount(String(parsedData.amount));
        setType(parsedData.type);
        setDate(parsedData.date);

        const foundCategory = categories.find(c => c.name.toLowerCase() === parsedData.categoryName?.toLowerCase() && c.type === parsedData.type);
        setCategoryId(foundCategory ? foundCategory.id : (categories.find(c=> c.type === parsedData.type)?.id || ''));

        const foundAccount = accounts.find(a => a.name.toLowerCase() === parsedData.accountName?.toLowerCase());
        setAccountId(foundAccount ? foundAccount.id : (accounts[0]?.id || ''));

        setGeminiInput(''); 
      }
    } catch (error) {
      console.error(error);
      setParseError(error instanceof Error ? error.message : "Ocurrió un error desconocido durante el análisis con IA.");
    } finally {
      setIsParsing(false);
    }
  };

  const availableCategories = categories.filter(c => c.type === type);
  useEffect(() => { 
    if (!availableCategories.find(c => c.id === categoryId)) {
      setCategoryId(availableCategories[0]?.id || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories]);


  const inputBaseClass = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm";
  const inputBgTextClass = "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialTransaction ? "Editar Transacción" : "Agregar Nueva Transacción"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 dark:bg-sky-900 p-4 rounded-lg border border-blue-200 dark:border-sky-700">
            <label htmlFor="geminiInput" className={`${labelClass} mb-1`}>Analizar con IA (ej: "Almuerzo en lo de Pepe ₲25000 categoría comida ayer")</label>
            <div className="flex space-x-2">
                <input
                    id="geminiInput"
                    type="text"
                    value={geminiInput}
                    onChange={(e) => setGeminiInput(e.target.value)}
                    className={`${inputBaseClass} ${inputBgTextClass}`}
                    placeholder="Escribe detalles de la transacción..."
                />
                <button
                    type="button"
                    onClick={handleGeminiParse}
                    disabled={isParsing}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-secondary hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 dark:disabled:bg-gray-500"
                >
                    {isParsing ? "Analizando..." : "Analizar"}
                </button>
            </div>
            {parseError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{parseError}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="description" className={labelClass}>Descripción</label>
            <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} required className={`${inputBaseClass} ${inputBgTextClass}`} />
          </div>
          <div>
            <label htmlFor="amount" className={labelClass}>Monto</label>
            <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} step="1" required className={`${inputBaseClass} ${inputBgTextClass}`} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className={labelClass}>Tipo</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as TransactionType)} className={`${inputBaseClass} ${inputBgTextClass}`}>
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
          </div>
          <div>
            <label htmlFor="date" className={labelClass}>Fecha</label>
            <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} required 
                   className={`${inputBaseClass} ${inputBgTextClass} dark:[color-scheme:dark]`} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className={labelClass}>Categoría</label>
            <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className={`${inputBaseClass} ${inputBgTextClass}`}>
              <option value="" disabled>Seleccionar Categoría</option>
              {availableCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="account" className={labelClass}>Cuenta</label>
            <select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required className={`${inputBaseClass} ${inputBgTextClass}`}>
              <option value="" disabled>Seleccionar Cuenta</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₲{acc.balance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})})</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>Notas (Opcional)</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputBaseClass} ${inputBgTextClass}`}></textarea>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6"> 
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400">Cancelar</button>
          <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-primary-light">
            <CheckIcon className="w-5 h-5 mr-2"/>
            {initialTransaction ? "Guardar Cambios" : "Agregar Transacción"}
          </button>
        </div>
      </form>
    </Modal>
  );
};


const TransactionsPage: React.FC = () => {
  const { transactions, deleteTransaction, getCategoryById, getAccountById } = useGastoZen();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const openAddModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString + 'T00:00:00'); 
        if (isNaN(date.getTime())) return "Fecha inválida";
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); 
    } catch(e) {
        return "Fecha inválida";
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 hidden md:block">Transacciones</h1>
        <div className="hidden md:block">
            <button onClick={openAddModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
            <PlusIcon className="w-5 h-5 mr-2"/> Agregar Transacción
            </button>
        </div>
         <div className="md:hidden fixed bottom-6 right-6 z-30"> 
            <button onClick={openAddModal} title="Agregar Transacción" className="p-4 rounded-full text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary shadow-lg">
                <PlusIcon className="w-6 h-6"/>
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden w-full">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cuenta</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Monto</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Aún no hay transacciones. ¡Haz clic en "+" para comenzar!</td></tr>
                    )}
                    {transactions.map(t => {
                    const category = getCategoryById(t.categoryId);
                    const account = getAccountById(t.accountId);
                    return (
                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(t.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.description}</div>
                            {t.notes && <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{t.notes}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span style={{ backgroundColor: category?.color || '#ccc' }} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isLight(category?.color || '#ccc') ? 'text-gray-800' : 'text-white'} opacity-90`}>
                            {category?.name || 'N/A'}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{account?.name || 'N/A'}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${t.type === 'income' ? 'text-income dark:text-emerald-400' : 'text-expense dark:text-red-400'}`}>
                            {t.type === 'income' ? '+' : '-'} ₲{t.amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button onClick={() => openEditModal(t)} className="text-primary-light hover:text-primary dark:text-teal-400 dark:hover:text-teal-300 transition-colors p-1"><EditIcon /></button>
                            <button onClick={() => {if(window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) deleteTransaction(t.id)}} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 transition-colors p-1"><TrashIcon /></button>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
            </table>
        </div>
      </div>

      <TransactionForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialTransaction={editingTransaction}
      />
    </div>
  );
};


const ManageItemCard: React.FC<{
    item: { id: string; name: string; color: string; icon?: string; details?: string };
    onEdit: () => void;
    onDelete: () => void;
  }> = ({ item, onEdit, onDelete }) => (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 flex flex-col justify-between hover:shadow-xl transition-shadow duration-300">
      <div>
        <div className="flex items-center mb-3">
          {item.icon && <span className="text-3xl mr-3">{item.icon}</span>}
          <div style={{width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color, marginRight: '8px', display: item.icon ? 'none' : 'block' }}></div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 truncate" title={item.name}>{item.name}</h3>
        </div>
        {item.details && <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{item.details}</p>}
      </div>
      <div className="flex justify-end space-x-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
        <button onClick={onEdit} className="text-primary-light hover:text-primary dark:text-teal-400 dark:hover:text-teal-300 p-2 rounded-full hover:bg-primary-light hover:bg-opacity-10 dark:hover:bg-teal-500 dark:hover:bg-opacity-20 transition-colors"><EditIcon className="w-5 h-5"/></button>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-500 hover:bg-opacity-10 dark:hover:bg-red-500 dark:hover:bg-opacity-20 transition-colors"><TrashIcon className="w-5 h-5"/></button>
      </div>
    </div>
);

const isLight = (color: string): boolean => {
  if (!color.startsWith('#')) return true; 
  const hex = color.replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return true; 
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp > 127.5; 
};


const AccountForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialAccount?: Account | null;
}> = ({ isOpen, onClose, initialAccount }) => {
  const { addAccount, updateAccount } = useGastoZen();
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('checking');
  const [initialBalance, setInitialBalance] = useState('0'); // Stores current balance when editing
  const [color, setColor] = useState('#3B82F6'); 
  const [icon, setIcon] = useState('🏛️');

  const inputBaseClass = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm";
  const inputBgTextClass = "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

  useEffect(() => {
    if (initialAccount) {
      setName(initialAccount.name);
      setType(initialAccount.type);
      setInitialBalance(String(initialAccount.balance)); 
      setColor(initialAccount.color);
      setIcon(initialAccount.icon || '🏛️');
    } else {
      setName('');
      setType('checking');
      setInitialBalance('0');
      setColor('#3B82F6');
      setIcon('🏛️');
    }
  }, [initialAccount, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let balanceValue = parseFloat(initialBalance);

    if (isNaN(balanceValue)) {
        alert("El saldo debe ser un número válido.");
        return;
    }

    const accountData = { name, type, color, icon };

    if (initialAccount) { // Editing existing account
        if (balanceValue < 0) {
            alert(`El saldo de la cuenta '${name}' no puede ser negativo (₲${balanceValue.toLocaleString()}). Por favor, ingresa un valor de ₲0 o mayor.`);
            return; 
        }
        updateAccount({ ...accountData, id: initialAccount.id, balance: balanceValue });
    } else { // Adding new account
        if (balanceValue < 0) {
            alert(`El saldo inicial de la nueva cuenta '${name}' no puede ser negativo (₲${balanceValue.toLocaleString()}). Se establecerá a ₲0.`);
            balanceValue = 0; 
        }
        addAccount({ ...accountData, initialBalance: balanceValue });
    }
    onClose();
  };

  const commonIcons = ['🏛️', '🐷', '💳', '💵', '📈', '💼', '🏦', '🪙'];
  const accountTypeTranslations: Record<Account['type'], string> = {
    checking: 'Corriente',
    savings: 'Ahorros',
    credit_card: 'Tarjeta de Crédito',
    cash: 'Efectivo',
    investment: 'Inversión',
    other: 'Otro'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialAccount ? "Editar Cuenta" : "Agregar Nueva Cuenta"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="accName" className={labelClass}>Nombre de la Cuenta</label>
          <input type="text" id="accName" value={name} onChange={e => setName(e.target.value)} required className={`${inputBaseClass} ${inputBgTextClass}`} />
        </div>
        <div>
          <label htmlFor="accType" className={labelClass}>Tipo de Cuenta</label>
          <select id="accType" value={type} onChange={e => setType(e.target.value as Account['type'])} className={`${inputBaseClass} ${inputBgTextClass}`}>
            {Object.entries(accountTypeTranslations).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="accBalance" className={labelClass}>
            {initialAccount ? "Saldo Actual" : "Saldo Inicial"}
          </label>
          <input type="number" id="accBalance" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} step="1" required className={`${inputBaseClass} ${inputBgTextClass}`} />
        </div>
         <div className="flex space-x-4 items-end">
            <div className="flex-grow">
                <label htmlFor="accColor" className={labelClass}>Color</label>
                <input type="color" id="accColor" value={color} onChange={e => setColor(e.target.value)} className={`mt-1 block w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${inputBgTextClass}`} />
            </div>
            <div className="flex-grow">
                <label htmlFor="accIcon" className={labelClass}>Ícono (Emoji)</label>
                <input type="text" id="accIcon" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} placeholder="🏦" className={`${inputBaseClass} ${inputBgTextClass}`} />
            </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Íconos comunes: {commonIcons.join(' ')}</p>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm">Cancelar</button>
          <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark">
            <CheckIcon className="w-5 h-5 mr-2"/> {initialAccount ? "Guardar Cambios" : "Agregar Cuenta"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AccountsPage: React.FC = () => {
  const { accounts, deleteAccount } = useGastoZen();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const openAddModal = () => { setEditingAccount(null); setIsModalOpen(true); };
  const openEditModal = (account: Account) => { setEditingAccount(account); setIsModalOpen(true); };
  
  const accountTypeTranslations: Record<Account['type'], string> = {
    checking: 'Corriente',
    savings: 'Ahorros',
    credit_card: 'Tarjeta de Crédito',
    cash: 'Efectivo',
    investment: 'Inversión',
    other: 'Otro'
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 hidden md:block">Cuentas</h1>
         <div className="hidden md:block">
            <button onClick={openAddModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark">
            <PlusIcon className="w-5 h-5 mr-2"/> Agregar Cuenta
            </button>
        </div>
        <div className="md:hidden fixed bottom-6 right-6 z-30">  
            <button onClick={openAddModal} title="Agregar Cuenta" className="p-4 rounded-full text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary shadow-lg">
                <PlusIcon className="w-6 h-6"/>
            </button>
        </div>
      </div>
      {accounts.length === 0 && (
          <div className="text-center py-12">
            <CreditCardIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"/>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Aún no hay cuentas.</p>
            <p className="text-gray-400 dark:text-gray-500">Agrega una cuenta para comenzar a gestionar tus finanzas.</p>
          </div>
        )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(acc => (
          <ManageItemCard
            key={acc.id}
            item={{
              id: acc.id,
              name: acc.name,
              color: acc.color,
              icon: acc.icon,
              details: `${accountTypeTranslations[acc.type] || acc.type.replace('_', ' ')} - Saldo: ₲${acc.balance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
            }}
            onEdit={() => openEditModal(acc)}
            onDelete={() => { if(window.confirm(`¿Estás seguro de que quieres eliminar la cuenta "${acc.name}"? Esta acción no se puede deshacer.`)) deleteAccount(acc.id);}}
          />
        ))}
      </div>
      <AccountForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialAccount={editingAccount} />
    </div>
  );
};


const CategoryForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: Category | null;
}> = ({ isOpen, onClose, initialCategory }) => {
  const { addCategory, updateCategory } = useGastoZen();
  const [name, setName] = useState('');
  const [type, setType] = useState<Category['type']>('expense');
  const [color, setColor] = useState('#EF4444'); 
  const [icon, setIcon] = useState('🍔');

  const inputBaseClass = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm";
  const inputBgTextClass = "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

  useEffect(() => {
    if (initialCategory) {
      setName(initialCategory.name);
      setType(initialCategory.type);
      setColor(initialCategory.color);
      setIcon(initialCategory.icon || (initialCategory.type === 'expense' ? '🍔' : '💰'));
    } else {
      setName('');
      setType('expense');
      setColor(type === 'expense' ? '#EF4444' : '#16A34A');
      setIcon(type === 'expense' ? '🍔' : '💰');
    }
  }, [initialCategory, isOpen, type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categoryData = { name, type, color, icon };
    if (initialCategory) {
      updateCategory({ ...categoryData, id: initialCategory.id });
    } else {
      addCategory(categoryData);
    }
    onClose();
  };

  useEffect(() => {
    if (!initialCategory) { 
        setColor(type === 'expense' ? '#EF4444' : '#16A34A');
        setIcon(type === 'expense' ? '🍔' : '💰');
    }
  }, [type, initialCategory]);

  const commonIconsExpense = ['🍔', '🛒', '🚗', '💡', '🏠', '🏥', '🎬', '🛍️', '🧴', '📚', '🎁', '✈️', '📎'];
  const commonIconsIncome = ['💰', '💼', '📈', '🪙'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialCategory ? "Editar Categoría" : "Agregar Nueva Categoría"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="catName" className={labelClass}>Nombre de la Categoría</label>
          <input type="text" id="catName" value={name} onChange={e => setName(e.target.value)} required className={`${inputBaseClass} ${inputBgTextClass}`} />
        </div>
        <div>
          <label htmlFor="catType" className={labelClass}>Tipo de Categoría</label>
          <select id="catType" value={type} onChange={e => setType(e.target.value as Category['type'])} className={`${inputBaseClass} ${inputBgTextClass}`}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>
        <div className="flex space-x-4 items-end">
            <div className="flex-grow">
                <label htmlFor="catColor" className={labelClass}>Color</label>
                <input type="color" id="catColor" value={color} onChange={e => setColor(e.target.value)} className={`mt-1 block w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${inputBgTextClass}`} />
            </div>
            <div className="flex-grow">
                <label htmlFor="catIcon" className={labelClass}>Ícono (Emoji)</label>
                <input type="text" id="catIcon" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} placeholder={type === 'expense' ? '🍔' : '💰'} className={`${inputBaseClass} ${inputBgTextClass}`} />
            </div>
        </div>
         <p className="text-xs text-gray-500 dark:text-gray-400">Íconos comunes: {type === 'expense' ? commonIconsExpense.join(' ') : commonIconsIncome.join(' ')}</p>


        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm">Cancelar</button>
          <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark">
            <CheckIcon className="w-5 h-5 mr-2"/> {initialCategory ? "Guardar Cambios" : "Agregar Categoría"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const CategoriesPage: React.FC = () => {
  const { categories, deleteCategory } = useGastoZen();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const openAddModal = () => { setEditingCategory(null); setIsModalOpen(true); };
  const openEditModal = (category: Category) => { setEditingCategory(category); setIsModalOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 hidden md:block">Categorías</h1>
        <div className="hidden md:block">
            <button onClick={openAddModal} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark">
            <PlusIcon className="w-5 h-5 mr-2"/> Agregar Categoría
            </button>
        </div>
        <div className="md:hidden fixed bottom-6 right-6 z-30">  
            <button onClick={openAddModal} title="Agregar Categoría" className="p-4 rounded-full text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary shadow-lg">
                <PlusIcon className="w-6 h-6"/>
            </button>
        </div>
      </div>
      {categories.length === 0 && (
        <div className="text-center py-12">
            <BuildingLibraryIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"/>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Aún no hay categorías.</p>
            <p className="text-gray-400 dark:text-gray-500">Agrega categorías para organizar tus transacciones.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map(cat => (
          <ManageItemCard
            key={cat.id}
            item={{
              id: cat.id,
              name: cat.name,
              color: cat.color,
              icon: cat.icon,
              details: cat.type === 'income' ? 'Ingreso' : 'Gasto'
            }}
            onEdit={() => openEditModal(cat)}
            onDelete={() => { if(window.confirm(`¿Estás seguro de que quieres eliminar la categoría "${cat.name}"? Esta acción no se puede deshacer.`)) deleteCategory(cat.id);}}
          />
        ))}
      </div>
      <CategoryForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialCategory={editingCategory} />
    </div>
  );
};

const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">Claro</span>
      <button
        onClick={toggleTheme}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 ${
          theme === 'dark' ? 'bg-primary' : 'bg-gray-300'
        }`}
        aria-pressed={theme === 'dark'}
        aria-label='Cambiar tema'
      >
        <span className="sr-only">Cambiar tema</span>
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
            theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-400">Oscuro</span>
    </div>
  );
};


const SettingsPage: React.FC = () => {
    const { transactions, accounts, categories } = useGastoZen(); 

    const handleExport = () => {
        // Directamente usa los saldos del contexto 'accounts'
        // 'accounts' ya debería tener los saldos actualizados por GastoZenProvider
        
        const transactionsToExport = transactions.map(t => ({
            ID_Transaccion: t.id,
            Fecha: t.date,
            Descripcion: t.description,
            Monto: t.amount,
            Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
            ID_Categoria: t.categoryId,
            Nombre_Categoria: categories.find(c=>c.id === t.categoryId)?.name || 'N/A',
            ID_Cuenta: t.accountId,
            Nombre_Cuenta: accounts.find(a=>a.id === t.accountId)?.name || 'N/A',
            Notas: t.notes || '',
        }));
        
        const accountsToExport = accounts.map(a => ({
            ID_Cuenta: a.id,
            Nombre: a.name,
            Tipo_Cuenta: a.type,
            Saldo: Math.max(0, a.balance), // Usar directamente a.balance y aplicar Math.max
            Color: a.color,
            Icono: a.icon
        }));

        const categoriesToExport = categories.map(c => ({
            ID_Categoria: c.id,
            Nombre: c.name,
            Color: c.color,
            Tipo_Categoria: c.type === 'income' ? 'Ingreso' : 'Gasto',
            Icono: c.icon
        }));

        const wb = XLSX.utils.book_new();
        const wsTransactions = XLSX.utils.json_to_sheet(transactionsToExport);
        const wsAccounts = XLSX.utils.json_to_sheet(accountsToExport);
        const wsCategories = XLSX.utils.json_to_sheet(categoriesToExport);

        XLSX.utils.book_append_sheet(wb, wsTransactions, "Transacciones");
        XLSX.utils.book_append_sheet(wb, wsAccounts, "Cuentas");
        XLSX.utils.book_append_sheet(wb, wsCategories, "Categorías");

        XLSX.writeFile(wb, `gastozen_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
        alert("¡Datos exportados exitosamente como archivo Excel (.xlsx)!");
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    
                    const accountsSheet = workbook.Sheets["Cuentas"];
                    const categoriesSheet = workbook.Sheets["Categorías"];
                    const transactionsSheet = workbook.Sheets["Transacciones"];

                    if (!accountsSheet || !categoriesSheet || !transactionsSheet) {
                        alert("El archivo Excel no contiene las hojas esperadas (Cuentas, Categorías, Transacciones).");
                        return;
                    }

                    let importedAccountsRaw = XLSX.utils.sheet_to_json<any>(accountsSheet);
                    let importedCategoriesRaw = XLSX.utils.sheet_to_json<any>(categoriesSheet);
                    let importedTransactionsRaw = XLSX.utils.sheet_to_json<any>(transactionsSheet);
                    
                    if (!Array.isArray(importedAccountsRaw) || !Array.isArray(importedCategoriesRaw) || !Array.isArray(importedTransactionsRaw)) {
                         alert("Error al leer los datos de las hojas del Excel. Deben ser arrays.");
                         return;
                    }

                    const validatedCategories: Category[] = importedCategoriesRaw.map((cat: any) => ({
                        id: String(cat.ID_Categoria || cat.id || `importedCat-${Date.now()}-${Math.random()}`),
                        name: String(cat.Nombre || cat.name || 'Categoría Importada'),
                        color: String(cat.Color || cat.color || '#CCCCCC'),
                        type: (cat.Tipo_Categoria === 'Ingreso' || cat.type === 'income') ? 'income' : 'expense',
                        icon: String(cat.Icono || cat.icon || ( (cat.Tipo_Categoria === 'Ingreso' || cat.type === 'income') ? '💰' : '📎') ),
                    }));
                    
                    const defaultExpenseCat = validatedCategories.find(c => c.name === "Gasto Diverso" && c.type === "expense") || validatedCategories.find(c => c.type === "expense");
                    const defaultIncomeCat = validatedCategories.find(c => c.name === "Otro Ingreso" && c.type === "income") || validatedCategories.find(c => c.type === "income");
                    
                    const accountDefinitionsFromExcel: Account[] = importedAccountsRaw.map((acc: any) => ({
                        id: String(acc.ID_Cuenta || acc.id || `importedAcc-${Date.now()}-${Math.random()}`),
                        name: String(acc.Nombre || acc.name || 'Cuenta Importada'),
                        type: (['checking', 'savings', 'credit_card', 'cash', 'investment', 'other'].includes(acc.Tipo_Cuenta || acc.type) ? (acc.Tipo_Cuenta || acc.type) : 'other') as Account['type'],
                        balance: Number(acc.Saldo || 0), // Este es el saldo base del Excel
                        color: String(acc.Color || acc.color || '#CCCCCC'),
                        icon: String(acc.Icono || acc.icon || '🏦'),
                    }));


                    let validatedTransactions: Transaction[] = importedTransactionsRaw.map((rawTx: any) => {
                        let dateStr = rawTx.Fecha || rawTx.date;
                        if (dateStr instanceof Date) {
                            dateStr = dateStr.toISOString().split('T')[0];
                        } else if (typeof dateStr === 'number') { 
                             const excelEpoch = new Date(Date.UTC(1899, 11, 30)); 
                             const jsDate = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
                             dateStr = jsDate.toISOString().split('T')[0];
                        } else if (typeof dateStr === 'string') {
                             if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { 
                                const parsed = new Date(dateStr); 
                                if (!isNaN(parsed.getTime())) {
                                    dateStr = parsed.toISOString().split('T')[0];
                                } else {
                                    dateStr = new Date().toISOString().split('T')[0]; 
                                }
                             }
                        } else {
                            dateStr = new Date().toISOString().split('T')[0]; 
                        }

                        const txType: TransactionType = (rawTx.Tipo === 'Ingreso' || rawTx.type === 'income') ? 'income' : 'expense';
                        
                        let categoryId = rawTx.ID_Categoria || rawTx.categoryId;
                        if (!categoryId && (rawTx.Nombre_Categoria || rawTx.categoryName)) {
                            const catName = rawTx.Nombre_Categoria || rawTx.categoryName;
                            const foundCat = validatedCategories.find(c => c.name === catName && c.type === txType);
                            if (foundCat) categoryId = foundCat.id;
                        }
                         if (!categoryId || !validatedCategories.find(c => c.id === categoryId)) { 
                            categoryId = txType === 'income' ? defaultIncomeCat?.id : defaultExpenseCat?.id;
                        }

                        let accountId = rawTx.ID_Cuenta || rawTx.accountId;
                        if (!accountId && (rawTx.Nombre_Cuenta || rawTx.accountName)) {
                            const accName = rawTx.Nombre_Cuenta || rawTx.accountName;
                            const foundAcc = accountDefinitionsFromExcel.find(a => a.name === accName);
                            if (foundAcc) accountId = foundAcc.id;
                        }
                        if (!accountId || !accountDefinitionsFromExcel.find(a => a.id === accountId)) { 
                            accountId = accountDefinitionsFromExcel[0]?.id; 
                        }

                        if (!categoryId || !accountId) return null;

                        return {
                            id: String(rawTx.ID_Transaccion || rawTx.id || `importedTx-${Date.now()}-${Math.random()}`),
                            date: dateStr,
                            description: String(rawTx.Descripcion || rawTx.description || 'N/A'),
                            amount: Number(rawTx.Monto || rawTx.amount) || 0,
                            type: txType,
                            categoryId: categoryId,
                            accountId: accountId,
                            notes: String(rawTx.Notas || rawTx.notes || ''),
                        } as Transaction;
                    }).filter(t => t !== null) as Transaction[]; 

                    // Aplicar deltas de transacciones a los saldos base del Excel
                    const finalAccounts: Account[] = accountDefinitionsFromExcel.map(accDef => {
                        let currentBalance = accDef.balance; // Saldo base del Excel
                        validatedTransactions.forEach(tx => {
                            if (tx.accountId === accDef.id) {
                                if (tx.type === 'income') {
                                    currentBalance += tx.amount;
                                } else {
                                    currentBalance -= tx.amount;
                                }
                            }
                        });
                        return { ...accDef, balance: Math.max(0, currentBalance) }; // Aplicar Math.max(0) al final
                    });


                    if (window.confirm("Importar datos desde Excel sobrescribirá los datos existentes. ¿Estás seguro?")) {
                        localStorage.setItem(LS_ACCOUNTS, JSON.stringify(finalAccounts));
                        localStorage.setItem(LS_CATEGORIES, JSON.stringify(validatedCategories));
                        localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(validatedTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
                        alert("¡Datos importados exitosamente desde Excel! La aplicación se recargará.");
                        window.location.reload();
                    }

                } catch (error) {
                    alert("Error al importar datos desde Excel. Asegúrate de que el archivo sea un respaldo válido de GastoZen y tenga el formato correcto.");
                    console.error("Error de importación Excel:", error);
                }
            };
            reader.readAsArrayBuffer(file);
            if (event.target) event.target.value = ''; 
        }
    };

    const handleReset = () => {
        if (window.confirm("¿Estás seguro de que quieres restablecer todos los datos de la aplicación? Esta acción no se puede deshacer.")) {
            if (window.confirm("CONFIRMACIÓN FINAL: Esto eliminará todas tus transacciones, cuentas y categorías.")) {
                localStorage.removeItem(LS_TRANSACTIONS);
                localStorage.removeItem(LS_ACCOUNTS);
                localStorage.removeItem(LS_CATEGORIES);
                localStorage.removeItem(LS_THEME); 
                alert("Todos los datos han sido restablecidos. La aplicación se recargará ahora.");
                window.location.reload();
            }
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-8 hidden md:block">Configuración</h1>
            <div className="space-y-8">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Apariencia</h2>
                    <ThemeSwitcher />
                 </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Gestión de Datos</h2>
                    <div className="space-y-4">
                       <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800"
                        >
                            Exportar Datos (Excel)
                        </button>
                        <div>
                            <label
                                htmlFor="import-file"
                                className="cursor-pointer inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800"
                            >
                                Importar Datos (Excel)
                            </label>
                            <input type="file" id="import-file" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleImport} className="hidden" />
                        </div>
                       </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Importa un archivo de respaldo Excel (.xlsx) de GastoZen previamente exportado.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border-2 border-red-300 dark:border-red-500">
                    <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Zona Peligrosa</h2>
                    <button
                        onClick={handleReset}
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
                    >
                        Restablecer Todos los Datos
                    </button>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">Advertencia: Esto eliminará permanentemente todos tus datos financieros almacenados en este navegador.</p>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Acerca de GastoZen</h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        GastoZen es tu amigable gestor de finanzas personales. Registra gastos, administra cuentas y obtén información sobre tus hábitos de consumo.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Versión: 1.0.4</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recuerda: La API Key para las funciones de Gemini debe estar configurada en tus variables de entorno (\`process.env.API_KEY\`).</p>
                </div>
            </div>
        </div>
    );
};


// Main App Component
const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <ThemeProvider>
        <GastoZenProvider>
        <HashRouter>
            <Layout isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} closeSidebar={closeSidebar}>
            <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Routes>
            </Layout>
        </HashRouter>
        </GastoZenProvider>
    </ThemeProvider>
  );
};

export default App;
