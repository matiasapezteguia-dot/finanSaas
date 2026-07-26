-- Cierra el gap encontrado en la auditoría de RLS: las policies de
-- INSERT y UPDATE de transactions solo validaban auth.uid() = user_id,
-- pero no que account_id perteneciera al mismo usuario. Un usuario
-- autenticado podía insertar (o reasignar via update) una transacción
-- propia apuntando a la cuenta de otro usuario (violación de
-- integridad referencial cross-usuario).
--
-- category_id no se valida acá porque account_categories es un
-- catálogo compartido entre todos los usuarios (sin columna user_id),
-- no un recurso propio de cada quien.

DROP POLICY "Insertar transacciones propias" ON "public"."transactions";

CREATE POLICY "Insertar transacciones propias" ON "public"."transactions"
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      account_id IS NULL
      OR account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY "Actualizar transacciones propias" ON "public"."transactions";

CREATE POLICY "Actualizar transacciones propias" ON "public"."transactions"
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      account_id IS NULL
      OR account_id IN (
        SELECT id FROM public.accounts WHERE user_id = auth.uid()
      )
    )
  );
