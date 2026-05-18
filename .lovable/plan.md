## Plan: OpenProject-style Project Management v1 + Gantt

### Database (single migration)

New tables:
- **customers** — name, contact_email, contact_phone, notes. Auth-read; admin/creator manage.
- **project_tasks** — project_id, parent_task_id (nullable, for subtasks), title, description, status (todo|in_progress|done|blocked), priority (low|normal|high|urgent), due_date, assignee_id, created_by, order_index. RLS: read by any auth; insert/update/delete via `can_manage_project` OR `is_project_member` OR assignee.
- **project_task_comments** — task_id, author_id, body. Author or project manager can delete.
- **project_task_attachments** — task_id, uploader_id, file_name, file_path, file_size, mime_type. Files in new `project-attachments` storage bucket (private), folder = project_id.
- **project_activity** — project_id, actor_id, action (text), entity_type, entity_id, meta jsonb, created_at. Read by auth; insert by any project member; no update/delete.

Alter `projects`:
- add `customer_id uuid` (nullable, references customers)
- add `manager_id uuid` (nullable, the Project Manager — distinct from owner)

Trigger functions to auto-write `project_activity` rows on insert/update of projects, milestones, tasks (status changes only), members, status_updates.

Storage bucket `project-attachments` (private) + RLS policies scoped to project membership via folder name.

### Routing — per-project sub-nav

Refactor `projects.$projectId.tsx` from leaf into a **layout** that renders the project header + tab bar + `<Outlet/>`. Add children:
- `projects.$projectId.index.tsx` → **Overview** (description, progress cards, recent activity, recent updates)
- `projects.$projectId.tasks.tsx` → **Tasks board** (4 columns: To Do / In Progress / Done / Blocked) with new-task dialog, filter (assignee/priority), task detail dialog showing description, subtasks, comments, attachments
- `projects.$projectId.milestones.tsx` → milestones list + progress
- `projects.$projectId.gantt.tsx` → **Gantt timeline** (SVG-based: rows = milestones + tasks with dates, columns = days/weeks between project start/due)
- `projects.$projectId.members.tsx` → team list, add/remove, change role
- `projects.$projectId.activity.tsx` → activity log feed with filters (actor, date, entity type)

### Index page

Enhance `projects.tsx`:
- Add **search** input and **customer** filter alongside status filter
- Dashboard strip at top: cards for Total / Active / Overdue / Completed
- Card grid shows customer name + manager + progress bar

### Permissions (reuse existing schema)

- **Admin** = Department Manager: full CRUD anywhere
- **Project owner / manager_id / project_members.role='manager'** = Project Manager: manage tasks/members/milestones for that project
- **project_members** = Team Member: update own assigned tasks, post comments/status updates

### Customers admin

Small Customers page at `/customers` (admin-only) for CRUD. Customer picker dropdown inside Edit/New project dialogs.

### Code shape

- New shared meta in `src/lib/project-meta.ts`: add `TASK_STATUS_META` (todo/in_progress/done/blocked).
- New helper `src/lib/project-activity.ts` for client-side activity logging fallback (DB triggers do most of it; client logs comments/attachments).
- Sidebar: add Customers under Admin group.

### Out of scope (deferred)

- Notifications system, role-based dashboards per role, workload view, rich text editor — keep textareas.
- Email/push notifications.

### File list

Migration: 1 file (~250 lines SQL)
New routes: 6 child route files + 1 customers route
New components: TaskBoard, TaskCard, TaskDialog, GanttChart, ActivityFeed, CustomerPicker
Edits: projects.tsx (index), projects.$projectId.tsx (becomes layout), app-sidebar.tsx, project-meta.ts
