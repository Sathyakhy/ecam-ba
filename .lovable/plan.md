# Plan: Project Config + richer Project model

This is a fairly large set of changes. Here is what I'll build and how.

## What you'll get

1. **Multiple Project Managers (manual)** — a project can have many PMs of three kinds: **eCam (internal staff)**, **Customer contact**, **Vendor contact**. Each PM entry stores the person's name + role, and (when applicable) links to a Customer or Vendor record.
2. **Overview shows Product + Vendor** — the project header / overview displays the linked Product and Vendor name(s), in addition to Customer.
3. **Project Roles** — a separate set of roles that belong to a project (distinct from member access roles). e.g. "Lead Engineer", "QA", "Site Supervisor". Each project member can be tagged with one or more of these project roles.
4. **Project Config (sidebar)** — a new top-level sidebar item "Project Config" with four tabs:
   - **Roles** — manage the catalog of project roles
   - **Products** — manage product catalog (name, code, description)
   - **Customers** — customer **companies**, each with multiple **staff contacts**
   - **Vendors** — vendor **companies**, each with multiple **staff contacts**

   The existing top-level "Customers" sidebar item is replaced by this section.

## Database changes (migration)

New tables:
- `products` (name, code, description, created_by) — RLS: auth read; admin/creator write
- `vendors` (name, contact_email, contact_phone, notes, created_by) — same shape as `customers`
- `customer_contacts` (customer_id, full_name, job_title, email, phone) — staff under a customer company
- `vendor_contacts` (vendor_id, full_name, job_title, email, phone)
- `project_roles_catalog` (name, description) — admin-managed catalog of role names
- `project_managers` (project_id, kind: 'ecam'|'customer'|'vendor', name, profile_id?, customer_contact_id?, vendor_contact_id?, email?, phone?) — multiple PMs per project
- `project_member_roles` (project_member_id, role_id) — link members to project roles

Alter `projects`:
- add `product_id uuid null` (FK-soft to products)
- add `vendor_id uuid null` (FK-soft to vendors)

RLS: standard pattern (`auth read`, `can_manage_project` or admin for writes; catalog tables admin-managed but auth-readable).

## UI changes

- **Sidebar**: add "Project Config" item with sub-routes; remove standalone "Customers" link (moved inside Project Config).
- **New routes**:
  - `/project-config` (layout with tabs) → `/roles`, `/products`, `/customers`, `/vendors`
  - Customer / Vendor detail pages list staff contacts with add/edit/delete.
- **Project edit dialog**: add Product (select), Vendor (select). Customer stays.
- **Project Managers section** on the project page: list of PMs with "Add PM" → pick kind (eCam/Customer/Vendor) → if eCam pick staff profile (still allow manual name), if Customer/Vendor pick the company then a contact (or type manually). Edit/remove per row.
- **Project overview**: show Customer, Vendor, Product, and PM list.
- **Members page**: each member row can be assigned project roles (multi-select from catalog).

## Notes / scope

- I'll keep your existing data: current `customers` table is reused as the "customer companies" table. The old top-level Customers route is removed from sidebar but the data stays.
- "eCam" = your internal staff (profiles). I'm using "eCam" as you wrote it; tell me if it's a typo for "team" / "internal" and I'll rename.
- This is one migration + ~10 file changes. I'll do it in one batch.

Approve and I'll ship it.