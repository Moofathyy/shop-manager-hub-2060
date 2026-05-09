
CREATE TYPE public.txn_type AS ENUM ('payment','payout','refund','chargeback');
CREATE TYPE public.txn_status AS ENUM ('pending','succeeded','failed','cancelled');
CREATE TYPE public.payout_status AS ENUM ('pending','processing','paid','on_hold','failed');
CREATE TYPE public.refund_status AS ENUM ('pending','approved','rejected','processed');
CREATE TYPE public.review_status AS ENUM ('published','flagged','removed');
CREATE TYPE public.review_target AS ENUM ('product','seller');
CREATE TYPE public.dispute_status AS ENUM ('open','in_review','resolved_shopper','resolved_seller','resolved_split','closed');
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','waiting','resolved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','urgent');

-- Helper for finance-only actions
CREATE OR REPLACE FUNCTION public.is_finance_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','finance_admin'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_finance_admin(uuid) FROM PUBLIC, anon, authenticated;

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type public.txn_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.txn_status NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_ref TEXT,
  flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'pending',
  scheduled_for DATE,
  processed_at TIMESTAMPTZ,
  hold_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refunds
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.review_target NOT NULL,
  target_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT,
  status public.review_status NOT NULL DEFAULT 'published',
  flag_reason TEXT,
  removed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disputes
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shopper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  internal_notes TEXT,
  sla_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at triggers
CREATE TRIGGER set_updated_at_payouts BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_tickets BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- transactions
CREATE POLICY "self view txn" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view txn" ON public.transactions FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "finance manage txn" ON public.transactions FOR ALL
  USING (public.is_finance_admin(auth.uid())) WITH CHECK (public.is_finance_admin(auth.uid()));

-- payouts
CREATE POLICY "seller view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "admins view payouts" ON public.payouts FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "finance manage payouts" ON public.payouts FOR ALL
  USING (public.is_finance_admin(auth.uid())) WITH CHECK (public.is_finance_admin(auth.uid()));

-- refunds
CREATE POLICY "shopper view own refund" ON public.refunds FOR SELECT USING (auth.uid() = requested_by);
CREATE POLICY "shopper request refund" ON public.refunds FOR INSERT WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "admins view refunds" ON public.refunds FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "finance manage refunds" ON public.refunds FOR ALL
  USING (public.is_finance_admin(auth.uid())) WITH CHECK (public.is_finance_admin(auth.uid()));

-- reviews
CREATE POLICY "public view published reviews" ON public.reviews FOR SELECT USING (status = 'published');
CREATE POLICY "reviewer view own" ON public.reviews FOR SELECT USING (auth.uid() = reviewer_id);
CREATE POLICY "reviewer create" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "reviewer update own" ON public.reviews FOR UPDATE USING (auth.uid() = reviewer_id);
CREATE POLICY "admins view reviews" ON public.reviews FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins moderate reviews" ON public.reviews FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "admins delete reviews" ON public.reviews FOR DELETE USING (public.is_admin(auth.uid()));

-- disputes
CREATE POLICY "party view dispute" ON public.disputes FOR SELECT USING (auth.uid() = shopper_id OR auth.uid() = seller_id);
CREATE POLICY "shopper open dispute" ON public.disputes FOR INSERT WITH CHECK (auth.uid() = shopper_id);
CREATE POLICY "admins view disputes" ON public.disputes FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins resolve disputes" ON public.disputes FOR UPDATE USING (public.is_admin(auth.uid()));

-- tickets
CREATE POLICY "self view ticket" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "self create ticket" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view tickets" ON public.tickets FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage tickets" ON public.tickets FOR UPDATE USING (public.is_admin(auth.uid()));

-- ticket_messages
CREATE POLICY "ticket party view messages" ON public.ticket_messages FOR SELECT USING (
  (NOT is_internal AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()))
  OR public.is_admin(auth.uid())
);
CREATE POLICY "ticket party post" ON public.ticket_messages FOR INSERT WITH CHECK (
  auth.uid() = author_id AND (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    OR public.is_admin(auth.uid())
  )
);

-- Indexes
CREATE INDEX idx_txn_created ON public.transactions(created_at DESC);
CREATE INDEX idx_txn_type ON public.transactions(type);
CREATE INDEX idx_payouts_seller ON public.payouts(seller_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);
CREATE INDEX idx_refunds_order ON public.refunds(order_id);
CREATE INDEX idx_reviews_target ON public.reviews(target_type, target_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_assigned ON public.tickets(assigned_to);
CREATE INDEX idx_messages_ticket ON public.ticket_messages(ticket_id, created_at);
