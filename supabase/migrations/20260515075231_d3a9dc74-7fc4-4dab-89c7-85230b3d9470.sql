ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 999;

-- Backfill existing rows with sequential priorities (alphabetical order as a starting point)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM public.positions
  WHERE priority = 999
)
UPDATE public.positions p
SET priority = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

CREATE INDEX IF NOT EXISTS positions_priority_idx ON public.positions(priority);