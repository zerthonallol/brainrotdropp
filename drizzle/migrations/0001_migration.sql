CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  price_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  announcement text,
  announcement_id text,
  announcement_by bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are public" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.app_settings (id) VALUES (1);