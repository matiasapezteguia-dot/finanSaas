// ==========================================================
// 1. TIPOS BASE Y ENUMS CONTABLES (SaaS & Multidivisa Ready)
// ==========================================================

export type MonedaType = 'ARS' | 'USD';
export type MovementCodeType = 'income' | 'expense' | 'transfer' | 'adjustment';

// ==========================================================
// 2. ENTIDADES PURAS DEL DOMINIO (Entidades de Negocio)
// ==========================================================

export interface AccountGroup {
  id: string;
  name: string;
  created_at?: string;
}

export interface AccountCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface MovementTypeItem {
  id: string;
  name: string;      // "Ingreso", "Egreso", "Transferencia", "Ajuste"
  code: string;      // 'income', 'expense', 'transfer', 'adjustment'
}

export interface Account {
  id: string;
  nombre: string;
  account_group_id: string;    // 🔑 ID real (UUID) relacional de la base de datos
  account_category_id: string; // 🔑 ID real (UUID) relacional de la base de datos
  moneda: 'ARS' | 'USD';
  montoInicial: number;
  current_amount: number;
  user_id: string;
  created_at?: string;
  
  // 🔄 CAPA DE COMPATIBILIDAD VIRTUAL:
  // El Store rellenará estas dos propiedades con el texto del catálogo al hacer el fetch.
  // De esta manera, el Dashboard y el 90% de las tablas no se enteran del cambio y siguen sanas.
  grupo: string;     
  categoria: string; 
}

export interface Transaction {
  id: string;
  cuentaId: string;
  transaction_type_id: string;
  transaction_type_code?: string;
  typeId?: string;
  categoria: string | null;
  monto: number;             // Signado internamente si es relacional
  descripcion: string | null;
  fecha: string;             // YYYY-MM-DD
  moneda: MonedaType;
  sourceAccountId?: string;
  targetAccountId?: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'operator' | 'viewer';
  created_at?: string;
}

// ==========================================================
// 3. CONTRATOS DE REPOSITORIO (Abstracción de Persistencia)
// ==========================================================

export interface ITransactionRepository {
  fetchAll(): Promise<Transaction[]>;
  save(transaction: Omit<Transaction, 'id' | 'created_at' | 'transaction_type_code'>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IAccountRepository {
  fetchAll(): Promise<Account[]>;
  save(account: Omit<Account, 'id' | 'created_at'>): Promise<Account>;
  update(account: Account): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ICatalogRepository {
  fetchGroups(): Promise<AccountGroup[]>;
  fetchCategories(): Promise<AccountCategory[]>;
  fetchTransactionTypes(): Promise<MovementTypeItem[]>;
  addCategory(name: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  addGroup(name: string): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  updateGroup(id: string, newName: string): Promise<void>;
  updateCategory(id: string, newName: string): Promise<void>;
}

// ==========================================================
// 4. ESTADO INTERNO DE LA APLICACIÓN (Zustand UI State)
// ==========================================================

export interface StoreState {
  transactions: Transaction[];
  accounts: Account[];
  accountGroups: AccountGroup[];
  accountCategories: AccountCategory[];
  transactionTypes: MovementTypeItem[];
  profile: Profile | null;
  isFetching: boolean;
}

export interface FinanzasStoreContextType extends StoreState {
  fetchInitialData: () => Promise<void>; // Asegurado método de sincronización
  addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  getAccountBalance: (accountId: string) => number;
  getTotalARS: () => number;
  getAvailableARS: () => number;
  getTotalARSInvestments: () => number;
  getTotalUSD: () => number;
  getBalance: (currency: MonedaType) => number;
  getBalancesByGroup: (currency: MonedaType) => { [key: string]: number };
  getBalancesByCategory: (currency: MonedaType) => { [key: string]: number };
  addAccount: (account: Omit<Account, 'id' | 'created_at'>) => Promise<void>;
  updateAccount: (updatedAccount: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addAccountGroup: (group: string) => Promise<void>;
  // CORREGIDO: Cambiado oldName por id para alinearse al repositorio
  updateAccountGroup: (id: string, newName: string) => Promise<void>;
  deleteAccountGroup: (group: string) => Promise<void>;
  addAccountCategory: (category: string) => Promise<void>;
  // CORREGIDO: Cambiado oldName por id para alinearse al repositorio
  updateAccountCategory: (id: string, newName: string) => Promise<void>;
  deleteAccountCategory: (category: string) => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}
