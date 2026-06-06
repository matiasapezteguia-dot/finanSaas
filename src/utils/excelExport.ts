import * as XLSX from 'xlsx';
import { Account, Transaction } from '../types/finanzas';

/**
 * Servicio utilitario centralizado para la exportación de datos financieros a Excel.
 * Encapsula el uso de SheetJS (xlsx) aislando la UI de la infraestructura de archivos.
 */
export const excelExportService = {
  
  /**
   * 1. EXPORTAR TRANSACCIONES (Libro Diario)
   * Toma el historial de movimientos y cruza los IDs relacionales con los nombres de cuenta actuales.
   */
  exportTransacciones: (transactions: Transaction[], accounts: Account[]) => {
    if (!transactions || transactions.length === 0) {
      window.alert("No hay transacciones registradas para exportar.");
      return;
    }

    console.log(`📊 Generando archivo Excel para ${transactions.length} movimientos...`);

    // Mapeamos al formato exacto de filas que queremos en la planilla
    const filasExcel = transactions.map((tx) => {
      // Cruzamos los datos usando los IDs limpios que refactorizamos hoy
      const cuentaAsociada = accounts.find((a) => a.id === tx.cuentaId);

      return {
        "Fecha": tx.fecha ? new Date(tx.fecha).toLocaleDateString('es-AR') : 'Sin Fecha',
        "Cuenta": cuentaAsociada ? cuentaAsociada.nombre : 'Cuenta Desconocida',
        "Categoría": tx.categoria || 'Sin Categoría',
        "Descripción / Detalle": tx.descripcion || '',
        "Moneda": cuentaAsociada ? cuentaAsociada.moneda : 'ARS',
        "Monto": Number(tx.monto) || 0,
        "Tipo": tx.monto >= 0 ? "Ingreso" : "Egreso"
      };
    });

    // Construcción del archivo XLSX
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(filasExcel);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Libro Diario");

    // Nombre dinámico con fecha de hoy
    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreArchivo = `pv_finanzas_movimientos_${fechaHoy}.xlsx`;

    // Descarga en navegador
    XLSX.writeFile(workbook, nombreArchivo);
    console.log("✅ ¡Descarga de Excel de Transacciones completada!");
  },

  /**
   * 2. EXPORTAR CUENTAS Y SALDOS (Estado de Situación)
   * Toma la foto actual del Dashboard (Nombres, Monedas, Grupos, Categorías y balances calculados).
   */
  exportCuentas: (accounts: Account[], getAccountBalance: (id: string) => number) => {
    if (!accounts || accounts.length === 0) {
      window.alert("No hay cuentas registradas para exportar.");
      return;
    }

    console.log(`📊 Generando archivo Excel de Saldos para ${accounts.length} cuentas...`);

    // Mapeamos los datos utilizando el calculador de balances reactivo del Store
    const filasExcel = accounts.map((account) => {
      return {
        "Grupo / Bloque": account.grupo || 'Otros',       // E.g., USO DIARIO, EFECTIVO, INVERSIONES
        "Categoría": account.categoria || 'Sin Categoría', // 🌟 NUEVA COLUMNA: E.g., Billetera Virtual, Banco, etc.
        "Nombre de la Cuenta": account.nombre || 'Sin Nombre',
        "Moneda": account.moneda || 'ARS',
        "Monto Inicial": Number(account.montoInicial) || 0,
        "Saldo Actual": Number(getAccountBalance(account.id)) || 0
      };
    });

    // Ordenamos las filas alfabéticamente por Grupo para que queden prolijas en bloque
    filasExcel.sort((a, b) => a["Grupo / Bloque"].localeCompare(b["Grupo / Bloque"]));

    // Construcción del archivo XLSX
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(filasExcel);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Saldos Consolidados");

    // Nombre dinámico con fecha de hoy
    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreArchivo = `pv_finanzas_saldos_${fechaHoy}.xlsx`;

    // Descarga en navegador
    XLSX.writeFile(workbook, nombreArchivo);
    console.log("✅ ¡Descarga de Excel de Saldos completada con la columna Categoría!");
  }
};