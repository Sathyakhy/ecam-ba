
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM anon;
