
-- products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth create products" ON public.products FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin or creator update products" ON public.products FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR created_by = auth.uid())
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR created_by = auth.uid());
CREATE POLICY "admin delete products" ON public.products FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- vendors
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth create vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin or creator update vendors" ON public.vendors FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR created_by = auth.uid())
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR created_by = auth.uid());
CREATE POLICY "admin delete vendors" ON public.vendors FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- customer_contacts
CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  job_title text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read customer_contacts" ON public.customer_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage customer_contacts" ON public.customer_contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER customer_contacts_updated BEFORE UPDATE ON public.customer_contacts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- vendor_contacts
CREATE TABLE public.vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  job_title text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vendor_contacts" ON public.vendor_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage vendor_contacts" ON public.vendor_contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE TRIGGER vendor_contacts_updated BEFORE UPDATE ON public.vendor_contacts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- project_roles_catalog
CREATE TABLE public.project_roles_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_roles_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read project_roles_catalog" ON public.project_roles_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage project_roles_catalog" ON public.project_roles_catalog FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER project_roles_catalog_updated BEFORE UPDATE ON public.project_roles_catalog FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- project_managers
CREATE TABLE public.project_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ecam','customer','vendor')),
  name text NOT NULL,
  profile_id uuid,
  customer_id uuid,
  customer_contact_id uuid,
  vendor_id uuid,
  vendor_contact_id uuid,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_managers_project_idx ON public.project_managers(project_id);
ALTER TABLE public.project_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read project_managers" ON public.project_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage project_managers" ON public.project_managers FOR ALL TO authenticated
  USING (private.can_manage_project(auth.uid(), project_id))
  WITH CHECK (private.can_manage_project(auth.uid(), project_id));

-- project_member_roles
CREATE TABLE public.project_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_member_id uuid NOT NULL REFERENCES public.project_members(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.project_roles_catalog(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_member_id, role_id)
);
ALTER TABLE public.project_member_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read project_member_roles" ON public.project_member_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage project_member_roles" ON public.project_member_roles FOR ALL TO authenticated
  USING (private.can_manage_project(auth.uid(), project_id))
  WITH CHECK (private.can_manage_project(auth.uid(), project_id));

-- projects: add product_id, vendor_id
ALTER TABLE public.projects ADD COLUMN product_id uuid;
ALTER TABLE public.projects ADD COLUMN vendor_id uuid;
