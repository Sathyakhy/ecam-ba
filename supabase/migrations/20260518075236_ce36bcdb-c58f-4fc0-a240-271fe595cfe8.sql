CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    OR (
      _role = 'admin'::app_role
      AND EXISTS (
        SELECT 1
        FROM public.user_system_roles usr
        JOIN public.system_roles sr ON sr.id = usr.role_id
        WHERE usr.user_id = _user_id
          AND sr.access_level = 'edit'
          AND 'admin' = ANY(sr.modules)
      )
    )
$function$;