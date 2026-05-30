"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/utils/supabase/client";
import { useFinanzasStore } from "@/lib/store";
import AccountDetailModal from "@/components/AccountDetailModal";
import DashboardKPIs from "@/components/DashboardKPIs";
import AccountList from "@/components/AccountList";
import TransactionsTable from "@/components/TransactionsTable";
import AddTransactionModal from "@/components/modals/AddTransactionModal";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const supabase = createClientSupabaseClient();
  
  const { 
    transactions, 
    accounts, 
    deleteTransaction, 
    getAccountBalance, 
    accountCategories, 
    accountGroups, 
    fetchInitialData, 
    getTotalARS, 
    getTotalUSD 
  } = useFinanzasStore();

  // 1. Detector de usuario en consola
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("🚨 DETECTOR EN UI - USUARIO ACTUAL:", user);
    };
    checkUser();
  }, [supabase]);

  // 2. Cableado de diagnóstico con numeración estricta
  useEffect(() => {
    console.log("🚀 COMUNICADO 1: El useEffect del Dashboard acaba de arrancar en tu máquina.");
    
    const initApp = async () => {
      console.log("🚀 COMUNICADO 2: Entrando a la función initApp().");
      try {
        console.log("🚀 COMUNICADO 3: Disparando fetchInitialData() hacia Supabase... (Esperando respuesta)");
        
        await fetchInitialData();
        
        console.log("🚀 COMUNICADO 4: ¡ÉXITO! Supabase respondió y la promesa se resolvió.");
      } catch (error) {
        console.error("🔥 COMUNICADO 4 ALTERNATIVO: Entró al CATCH. Falló la consulta:", error);
      }
      
      // Sacamos el setMounted afuera de la promesa para obligar a la UI a despertar
      console.log("🚀 COMUNICADO 5: Forzando setMounted(true) para dibujar la pantalla.");
      setMounted(true);
    };

    initApp();
  }, []);
  
  // Filtros de la tabla
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "transfer" | "adjustment">("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");

  const handleClearFilters = () => {
    setFilterAccount("all");
    setFilterCategory("all");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterType("all");
    setFilterGroup("all");
  };

  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;

  const openAccountDetailModal = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const closeAccountDetailModal = () => {
    setSelectedAccountId(null);
  };

  // Salvavidas de hidratación: si no cargaron los datos reales en el cliente, no dibujamos nada
  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 w-full flex items-center justify-center text-slate-400 text-sm">Cargando panel financiero...</div>;
  }

  return (
    <div className="p-8 w-full mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">PV Finanzas</h1>
          <p className="text-slate-500">Control de caja</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={async () => {
              try {
                await supabase.auth.signOut();
                localStorage.clear(); // Limpieza preventiva para que no se tilde el token viejo
                sessionStorage.clear();
                router.push("/login");
                router.refresh();     // Obligamos a Next.js a resetear el mapa de rutas
              } catch (err) {
                console.error("Error al cerrar sesión:", err);
                window.location.href = "/login"; // Hard redirect si falla el router
              }
            }}
            className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition"
          >
            Cerrar Sesión
          </button>
          <button 
            onClick={() => setIsTransactionModalOpen(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
          >
            + Nueva entrada
          </button>
        </div>
      </div>

      <DashboardKPIs />

      <AccountList
        accounts={accounts}
        getAccountBalance={getAccountBalance}
        openAccountDetailModal={openAccountDetailModal}
      />

      <TransactionsTable
        transactions={transactions}
        accounts={accounts}
        deleteTransaction={deleteTransaction}
        filterAccount={filterAccount}
        setFilterAccount={setFilterAccount}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        filterType={filterType}
        setFilterType={setFilterType}
        handleClearFilters={handleClearFilters}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        transactionsPerPage={transactionsPerPage}
        accountCategories={accountCategories}
        filterGroup={filterGroup}
        setFilterGroup={setFilterGroup}
        accountGroups={accountGroups}
      />

      <AddTransactionModal 
        isOpen={isTransactionModalOpen} 
        onClose={() => setIsTransactionModalOpen(false)} 
      />

      {selectedAccountId && (
        <AccountDetailModal
          accountId={selectedAccountId}
          onClose={closeAccountDetailModal}
        />
      )}
    </div>
  );
}