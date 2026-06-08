"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  const tirarErrorControlado = () => {
    console.log("📬 Despachando paquete a Sentry...");
    
    // Esto obliga al SDK inyectado a armar el paquete de red al instante
    Sentry.captureException(new Error("🚀 ¡Búnker de Sentry Validado en Vivo por Mati! 🚀"));
    
    alert("¡Evento enviado! Mirá la pestaña Network.");
  };

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h1>Búnker de Telemetría</h1>
      <button 
        onClick={tirarErrorControlado}
        style={{ padding: "10px 20px", background: "#0070f3", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
      >
        Mandar Alerta Directa 🎯
      </button>
    </div>
  );
}