-- Create ENUM for currencies
CREATE TYPE public.currency_enum AS ENUM ('ARS', 'USD');

-- Create ENUM for account types
CREATE TYPE public.account_type_enum AS ENUM ('bancaria', 'billetera', 'cripto');

-- Table: public.transaction_types
CREATE TABLE public.transaction_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    code text NOT NULL UNIQUE
);
ALTER TABLE public.transaction_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public transaction types are viewable by everyone." ON public.transaction_types FOR SELECT USING (true);


-- Table: public.profiles (to extend Supabase auth.users)
CREATE TABLE public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Table: public.accounts
CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    currency currency_enum NOT NULL,
    type account_type_enum NOT NULL,
    initial_balance numeric DEFAULT 0 NOT NULL,
    current_balance numeric DEFAULT 0 NOT NULL
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso cuentas" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Table: public.categories
CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    group_name text
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public categories are viewable by everyone." ON public.categories FOR SELECT USING (true);

-- Table: public.transactions
CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    is_voided boolean DEFAULT FALSE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    target_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE, -- Nullable for income/expense/adjustment
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL, -- Nullable for transfers
    transaction_type_id uuid REFERENCES public.transaction_types(id) ON DELETE RESTRICT NOT NULL,
    transaction_type_code text NOT NULL, -- Store the code directly for easier querying
    amount numeric NOT NULL,
    description text,
    date date DEFAULT now() NOT NULL,
    related_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL, -- Self-referencing for transfers
    currency currency_enum NOT NULL,
    exchange_rate numeric
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso transacciones" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Insert default transaction types if they don't exist
INSERT INTO public.transaction_types (name, code)
VALUES
    ('Ingreso', 'income'),
    ('Egreso', 'expense'),
    ('Transferencia', 'transfer'),
    ('Ajuste', 'adjustment')
ON CONFLICT (code) DO NOTHING;
