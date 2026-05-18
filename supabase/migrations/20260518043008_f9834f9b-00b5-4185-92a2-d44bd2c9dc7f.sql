ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);