"use client";

import React, { useEffect } from 'react';
import { createClientSupabaseClient } from '../utils/supabase/client';
import { useFinanzasStore } from '../lib/store';
import { Profile } from '../types/finanzas';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const setProfile = useFinanzasStore((state) => state.setProfile);

  useEffect(() => {
    const supabase = createClientSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (error) {
              console.error('Error fetching profile:', error);
              setProfile(null);
            } else {
              setProfile(profileData as Profile);
            }
          } catch (error) {
            console.error('Unhandled error fetching profile:', error);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setProfile]);

  return <>{children}</>;
}

import * as Sentry from "@sentry/nextjs";

// Inicialización forzada del lado del cliente
if (typeof window !== "undefined") {
  Sentry.init({
    dsn: "https://1162df553fa58b404d00d184a71423b0@o4511526815137792.ingest.us.sentry.io/4511526815334400", // Poné la URL real de tu DSN
    tracesSampleRate: 1.0,
    debug: true, // Esto te va a mostrar los logs reales en el F12
  });
}
