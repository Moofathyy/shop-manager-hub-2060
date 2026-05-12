CREATE TABLE public.scheduled_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  recipient_email TEXT NOT NULL,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage scheduled reports"
ON public.scheduled_reports
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER scheduled_reports_updated_at
BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();