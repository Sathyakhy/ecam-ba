
DROP POLICY "auth manage customer_contacts" ON public.customer_contacts;
CREATE POLICY "manage customer_contacts" ON public.customer_contacts FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_contacts.customer_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    private.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_contacts.customer_id AND c.created_by = auth.uid())
  );

DROP POLICY "auth manage vendor_contacts" ON public.vendor_contacts;
CREATE POLICY "manage vendor_contacts" ON public.vendor_contacts FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_contacts.vendor_id AND v.created_by = auth.uid())
  )
  WITH CHECK (
    private.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_contacts.vendor_id AND v.created_by = auth.uid())
  );
