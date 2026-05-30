'use client';

import React, { useState, useEffect } from 'react';
import { useFinanzasStore } from '../../lib/store';
import { Account, AccountCategory } from '../../types/finanzas';

interface TabProps {
  label: string;
  children: React.ReactNode;
}

const Tab: React.FC<TabProps> = ({ children }) => {
  return <div className="p-4">{children}</div>;
};

interface TabsProps {
  children: React.ReactElement<TabProps>[];
}

const Tabs: React.FC<TabsProps> = ({ children }) => {
  const [activeTab, setActiveTab] = useState(children[0].props.label);

  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {children.map((child) => (
            <button
              key={child.props.label}
              onClick={() => setActiveTab(child.props.label)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${activeTab === child.props.label
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
            >
              {child.props.label}
            </button>
          ))}
        </nav>
      </div>
      {
        children.map((child) => {
          if (child.props.label === activeTab) {
            return <div key={child.props.label}>{child.props.children}</div>;
          }
          return null;
        })
      }
    </div>
  );
};

const ListManager: React.FC<{
  title: string;
  list: { id: string; name: string }[]; // More specific type for list items
  onAdd: (name: string) => void;
   onDelete: (id: string) => void; // Changed signature
   onUpdate: (id: string, newName: string) => void; // Changed signature
   getItemName?: (item: { id: string; name: string }) => string; // More specific type
   accounts?: Account[]; // Add accounts prop for deletion rule
   renderItemExtra?: (item: { id: string; name: string }) => React.ReactNode; // More specific type
}> = ({ title, list, onAdd, onDelete, onUpdate, getItemName, accounts, renderItemExtra }) => {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem('');
    }
  };

  const handleEdit = (item: { id: string; name: string }) => { // Changed parameter to object
    setEditingId(item.id); // Store id
    setEditingText(item.name); // Store name for editing
  };

  const handleSave = (id: string) => { // Changed parameter to id
    if (editingText.trim()) {
      onUpdate(id, editingText.trim()); // Pass id and newName
    }
    setEditingId(null);
    setEditingText('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingText('');
  };

  const isDeletable = (id: string) => { // Changed parameter to id
    if (!accounts) return true; // If accounts are not provided, assume deletable
    // Check if any account uses this category or group
    const item = list.find(i => i.id === id); // Find item by id
    if (!item) return true; // If item not found, assume deletable
    return !accounts.some(account => account.categoria === item.name || account.grupo === item.name); // Check against item.name
  };

  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <div className="mt-2 flex space-x-2">
        <input
          type="text"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={`Nueva ${title.slice(0, -1)}`}
        />
        <button
          onClick={handleAdd}
          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Agregar
        </button>
      </div>
      <ul className="mt-4 border border-gray-200 rounded-md divide-y divide-gray-200">
        {list.map((item) => (
          <li key={item.id} className="px-4 py-3 flex items-center justify-between text-sm text-gray-900"> {/* Changed key to item.id */}
            {editingId === item.id ? ( // Changed comparison to item.id
              <div className="flex-grow flex items-center space-x-2">
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  onClick={() => handleSave(item.id)} // Pass item.id
                  className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-green-700"
                >
                  Guardar
                </button>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center rounded-md border border-transparent bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <span className="flex-grow flex items-center justify-between">
                {getItemName ? getItemName(item) : item.name} {/* Use item.name if getItemName not provided */}
                {renderItemExtra && renderItemExtra(item)}
              </span>
            )}
            <div className="flex space-x-2 ml-4">
              {editingId !== item.id && ( // Changed comparison to item.id
                <button
                  onClick={() => handleEdit(item)} // Pass item object
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  Editar
                </button>
              )}
              <button
                onClick={() => onDelete(item.id)} // Pass item.id
                className={`text-red-600 hover:text-red-900 ${!isDeletable(item.id) ? 'disabled:opacity-40 disabled:cursor-not-allowed' : ''}`}
                disabled={!isDeletable(item.id)} // Pass item.id
                title={!isDeletable(item.id) ? 'No se puede eliminar porque tiene cuentas asociadas' : ''}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function ConfiguracionPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { 
    accountGroups,
    accountCategories,

    addAccountGroup,
    updateAccountGroup,
    deleteAccountGroup,
    addAccountCategory,
    updateAccountCategory,
    deleteAccountCategory,
    accounts,
    addAccount,
    deleteAccount,
    getAccountBalance,
    updateAccount,
    fetchInitialData,
  } = useFinanzasStore();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const [newAccount, setNewAccount] = useState<Omit<Account, 'id'> & { grupo: string; categoria: string }>({
    nombre: '',
    montoInicial: 0,
    moneda: 'ARS',
    grupo: '', // Empezamos vacío de forma segura para el servidor
    categoria: '', // Empezamos vacío de forma segura para el servidor
  });

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editedAccount, setEditedAccount] = useState<Account | null>(null);

  const handleAddAccount = () => {
    if (newAccount.nombre && newAccount.montoInicial >= 0 && newAccount.grupo && newAccount.categoria) {
      addAccount(newAccount);
      setNewAccount({
        nombre: '',
        montoInicial: 0,
        // date: new Date().toISOString().split('T')[0], // No longer needed
        moneda: 'ARS',
        grupo: accountGroups[0] || '',
        categoria: accountCategories[0]?.name || '',
      });
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setEditedAccount({ ...account });
  };

  const handleSaveAccount = () => {
    if (editedAccount) {
      updateAccount(editedAccount);
      setEditingAccountId(null);
      setEditedAccount(null);
    }
  };

  const handleCancelEditAccount = () => {
    setEditingAccountId(null);
    setEditedAccount(null);
  };

  const handleDeleteAccount = (accountId: string) => {
    const accountToDelete = accounts.find(acc => acc.id === accountId);
    if (accountToDelete) {
      const currentBalance = getAccountBalance(accountId);
      if (currentBalance !== 0) {
        const confirmDelete = window.confirm(
          `¡Atención! Esta cuenta tiene un saldo activo de ${currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}. Si la eliminas, podrías generar inconsistencias en los balances históricos. ¿Estás seguro de que deseas eliminarla de todas formas?`
        );
        if (!confirmDelete) {
          return;
        }
      }
      deleteAccount(accountId);
    }
  };

  if (!mounted) {
    return null; // O un spinner
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      <Tabs>

       <Tab label="Grupos de Cuenta">
          <ListManager
            title="Grupos de Cuenta"
            list={accountGroups}
            onAdd={addAccountGroup}
            onUpdate={updateAccountGroup}
            onDelete={deleteAccountGroup}
            accounts={accounts}
            getItemName={(group) => group.name} // Asegura consistencia de lectura
            renderItemExtra={(group: { id: string; name: string }) => {
              // CORREGIDO: Ahora se accede a group.name para filtrar las cuentas asociadas
              const totalARS = accounts
                .filter(a => a.grupo === group.name && a.moneda === 'ARS')
                .reduce((acc, a) => acc + getAccountBalance(a.id), 0);

              const totalUSD = accounts
                .filter(a => a.grupo === group.name && a.moneda === 'USD')
                .reduce((acc, a) => acc + getAccountBalance(a.id), 0);            

              const formatCurrency = (value: number, currency: 'ARS' | 'USD') => {
                return new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: currency,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(value);
              };

              return (
                <span className="text-xs text-gray-500 ml-2">
                  ({formatCurrency(totalARS, 'ARS')} / {formatCurrency(totalUSD, 'USD')})
                </span>
              );
            }}
          />
        </Tab>
        <Tab label="Categorías de Cuenta">
          <ListManager
            title="Categorías de Cuenta"
            list={accountCategories}
            onAdd={addAccountCategory}
            onUpdate={updateAccountCategory}
            onDelete={deleteAccountCategory}
            accounts={accounts}
            getItemName={(category: { id: string; name: string }) => category.name}
            renderItemExtra={(category: { id: string; name: string }) => {
              // CORREGIDO: Asegurado tipado explícito del objeto en lugar de usar la interfaz global rota
              const totalARS = accounts
                .filter(a => a.categoria === category.name && a.moneda === 'ARS')
                .reduce((acc, a) => acc + getAccountBalance(a.id), 0);

              const totalUSD = accounts
                .filter(a => a.categoria === category.name && a.moneda === 'USD')
                .reduce((acc, a) => acc + getAccountBalance(a.id), 0);

              const formatCurrency = (value: number, currency: 'ARS' | 'USD') => {
                return new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: currency,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(value);
              };

              return (
                <span className="text-xs text-gray-500 ml-2">
                  ({formatCurrency(totalARS, 'ARS')} / {formatCurrency(totalUSD, 'USD')})
                </span>
              );
            }}
          />
        </Tab>        
        <Tab label="Cuentas">
          <div className="mt-4">
            <h3 className="text-lg font-medium text-gray-900">Administrar Cuentas</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-700">Nombre de la Cuenta</label>
                <input
                  type="text"
                  id="accountName"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={newAccount.nombre}
                  onChange={(e) => setNewAccount({ ...newAccount, nombre: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="initialAmount" className="block text-sm font-medium text-gray-700">Monto Inicial</label>
                <input
                  type="number"
                  id="initialAmount"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={newAccount.montoInicial}
                  onChange={(e) => setNewAccount({ ...newAccount, montoInicial: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="accountCurrency" className="block text-sm font-medium text-gray-700">Moneda</label>
                <select
                  id="accountCurrency"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={newAccount.moneda}
                  onChange={(e) => setNewAccount({ ...newAccount, moneda: e.target.value as 'ARS' | 'USD' })}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label htmlFor="accountGroup" className="block text-sm font-medium text-gray-700">Grupo</label>
                <select
                  id="accountGroup"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={newAccount.grupo}
                  onChange={(e) => setNewAccount({ ...newAccount, grupo: e.target.value })}
                >
                  {accountGroups.map((group) => (
                    // CORREGIDO: Usamos group.id para la key única y group.name para el valor y texto
                    <option key={group.id} value={group.name}>{group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="accountCategory" className="block text-sm font-medium text-gray-700">Categoría</label>
                <select
                  id="accountCategory"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={newAccount.categoria}
                  onChange={(e) => setNewAccount({ ...newAccount, categoria: e.target.value })}
                >
                  {accountCategories.map((category) => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddAccount}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Agregar Cuenta
              </button>
            </div>

            <div className="mt-8">
              <h4 className="text-md font-medium text-gray-900">Cuentas Existentes</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moneda</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto Inicial</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Actual</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        {editingAccountId === account.id ? (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="text"
                                value={editedAccount?.nombre || ''}
                                onChange={(e) => setEditedAccount({ ...editedAccount!, nombre: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={editedAccount?.moneda || 'ARS'}
                                onChange={(e) => setEditedAccount({ ...editedAccount!, moneda: e.target.value as 'ARS' | 'USD' })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="ARS">ARS</option>
                                <option value="USD">USD</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="number"
                                value={editedAccount?.montoInicial || 0}
                                onChange={(e) => setEditedAccount({ ...editedAccount!, montoInicial: parseFloat(e.target.value) })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: editedAccount?.moneda || 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(getAccountBalance(account.id))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={editedAccount?.grupo || ''}
                                onChange={(e) => setEditedAccount({ ...editedAccount!, grupo: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                {accountGroups.map((group) => (
                                  <option key={group} value={group}>{group}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={editedAccount?.categoria || ''}
                                onChange={(e) => setEditedAccount({ ...editedAccount!, categoria: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                {accountCategories.map((category) => (
                                  <option key={category.id} value={category.name}>{category.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={handleSaveAccount}
                                className="text-green-600 hover:text-green-900 mr-2"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={handleCancelEditAccount}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Cancelar
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{account.nombre}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{account.moneda}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{account.montoInicial.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: account.moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(getAccountBalance(account.id))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{account.grupo}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{account.categoria}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleEditAccount(account)}
                                className="text-indigo-600 hover:text-indigo-900 mr-2"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteAccount(account.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Eliminar
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>

  );
}
