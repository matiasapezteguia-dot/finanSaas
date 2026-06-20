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
  const [mounted, setMounted] = useState(false);
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
  } = useFinanzasStore();

  // Orquestador de inicialización inmune a congelamientos por F5 y navegación entre rutas
  useEffect(() => {
    console.log("🚀 COMUNICADO 1: El useEffect del Dashboard arrancó.");
    let isSubscribed = true;

    // Función auxiliar para cargar los datos y despertar la pantalla
    const inicializarDatosDashboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // 🔒 CONTROL ABSOLUTO: Si no hay sesión madura, abortamos el inicio
        if (!session) {
          console.log("🛑 Intento de acceso no autorizado. Redirigiendo...");
          router.push("/login");
          return;
        }

        console.log("🚀 COMUNICADO 3: Disparando fetchInitialData() con sesión asegurada.");
        await fetchInitialData();
        console.log("🚀 COMUNICADO 4: ¡ÉXITO! Datos del Store sincronizados.");

        if (isSubscribed) {
          setMounted(true); // Solo se despierta la pantalla si el usuario es REAL y tiene datos
        }
      } catch (error) {
        console.error("🔥 Error al cargar datos del Store:", error);
      }
    };

    // 🔒 DOBLE VERIFICACIÓN INMEDIATA (Soluciona la pantalla blanca o el "Cargando..." perpetuo)
    const verificarSesionActual = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("🔑 Sesión madura detectada en caché inmediata para:", session.user?.email);
        await inicializarDatosDashboard();
      } else {
        // Si no hay sesión de entrada, forzamos redirección limpia
        router.push("/login");
      }
    };

    verificarSesionActual();

    console.log("⏳ Activando canal reactivo en segundo plano por si la sesión cambia...");

    // Escuchamos los cambios de auth usando la instancia compartida global
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 EVENTO DE AUTENTICACIÓN DETECTADO:", event, session ? "Hay sesión" : "No hay sesión");

      // 🔑 EL CANDADO CLAVE: Evitamos re-inicializar el Dashboard con cada SIGNED_IN fantasma si ya está montado
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !mounted) {
        await inicializarDatosDashboard();
      } else if (event === 'SIGNED_OUT' || (!session && event === 'INITIAL_SESSION')) {
        console.log("⚠️ No hay sesión activa. Redirigiendo a /login.");
        if (isSubscribed) {
          router.push("/login");
        }
      }
    });

    // Limpieza al desmontar el componente
    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [fetchInitialData, router, mounted]); // Incluimos mounted para que el candado sea dinámico e inteligente

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

  // Salvavidas de hidratación seguro
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