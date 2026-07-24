"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// 🔑 IMPORTACIÓN UNIFICADA: Usamos el cliente único centralizado
import { supabase } from "@/lib/supabaseClient";
import { useFinanzasStore } from "@/lib/store";
import AccountDetailModal from "@/components/AccountDetailModal";
import DashboardKPIs from "@/components/DashboardKPIs";
import AccountList from "@/components/AccountList";
import TransactionsTable from "@/components/TransactionsTable";
import AddTransactionModal from "@/components/modals/AddTransactionModal";
export default function Dashboard() {
  const router = useRouter();

  const {
    transactions,
    accounts,
    deleteTransaction,
    getAccountBalance,
    accountCategories,
    accountGroups,
    fetchInitialData,
    getTotalARS,
    getTotalUSD,
    voidTransaction,
    isFetching,
    transactionTypes,
  } = useFinanzasStore();

  // 🚀 Orquestador de inicialización definitivo (Montaje Único - Inmune a congelamientos)
  useEffect(() => {
    console.log("🚀 Orquestador de inicialización arrancó (Montaje Único).");
    let isMounted = true;

    // Función desacoplada para cargar los datos protegiendo al Store de duplicados
    const cargarDatosDashboard = async () => {
      // 🔑 SOLUCIÓN CRÍTICA: Leemos el estado actual directamente de Zustand sin closures viejos
      const { accounts: storeAccounts, transactions: storeTransactions, isFetching } = useFinanzasStore.getState();

      if (isFetching) return;

      // Si el Store ya tiene información, protegemos la red y no volvemos a consultar
      if (storeAccounts.length > 0 || storeTransactions.length > 0) {
        console.log("ℹ️ Los datos ya existen en el Store, omitiendo fetch duplicado.");
        return;
      }

      try {
        console.log("🚀 COMUNICADO 3: Disparando fetchInitialData() con sesión asegurada.");
        await fetchInitialData();
        console.log("🚀 COMUNICADO 4: ¡ÉXITO! Datos del Store sincronizados.");
      } catch (error) {
        console.error("🔥 Error al cargar datos del Store:", error);
      }
    };

    // 1. Verificación pasiva inicial al montar la pantalla
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        console.log("🔑 Sesión detectada al montar para:", session.user?.email);
        cargarDatosDashboard();
      }
      // 💡 Nota: No redirigimos agresivamente acá en el arranque en frío; 
      // dejamos que el evento definitivo INITIAL_SESSION de onAuthStateChange tome la decisión.
    });

    // 2. Canal reactivo oficial de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      console.log("🔄 EVENTO DE AUTENTICACIÓN DETECTADO:", event, session ? "Hay sesión" : "No hay sesión");

      if (session) {
        // Si hay una sesión legítima (por login, refresh o sesión inicial), disparamos la carga segura
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          await cargarDatosDashboard();
        }
      } else {
        // 🔑 El veredicto final: Si explícitamente no hay sesión o se deslogueó, al login.
        if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          console.error("🛑 Sin sesión activa confirmada por Auth. Redirigiendo a /login.");
          router.push("/login");
        }
      }
    });

    // Limpieza atómica al desmontar el componente
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // 🔑 SOLUCIÓN: Array de dependencias limpio. Nunca más se va a reiniciar el hook a mitad de camino.
  }, [fetchInitialData, router]);

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
    setFilterAccount(accountId); // Sincronizar el filtro de la tabla con la cuenta seleccionada
  };

  const closeAccountDetailModal = () => {
    setSelectedAccountId(null);
    setFilterAccount("all"); // Resetear el filtro de la tabla al cerrar el modal
  };

  // Salvavidas de hidratación seguro
  if (isFetching && accounts.length === 0 && transactions.length === 0) {
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
                localStorage.clear();
                sessionStorage.clear();
                console.log("🏃‍♂️ Redirigiendo limpiamente a /login...");
                window.location.href = "/login";
              } catch (err) {
                console.error("Error al cerrar sesión:", err);
                window.location.href = "/login";
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
        voidTransaction={voidTransaction}
        transactionTypes={transactionTypes}
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