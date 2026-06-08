'use client';

import React from 'react';

export default function SentryExamplePage() {
  const throwClientError = () => {
    throw new Error("🚀 ¡Búnker de Sentry Validado en Vivo por Mati! 🚀");
  };

  return (
    <div>
      <h1>Página de Ejemplo de Sentry</h1>
      <button onClick={throwClientError}>
        Forzar Error del Lado del Cliente
      </button>
    </div>
  );
}