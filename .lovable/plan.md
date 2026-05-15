## Plan

1. **Fix the loading loop around authentication**
   - Update the auth provider so it cannot stay forever on “Loading workspace…” when the profile request is stuck or fails.
   - Add a safe error state that signs out only for real unauthorized sessions and otherwise lets the page show a clear retry/error path.

2. **Make onboarding list navigation reliable**
   - Change the onboarding “Open plan” action to navigate programmatically to `/onboarding/:profileId` instead of relying on nested button/link behavior.
   - This avoids mobile/browser click issues where the button looks clickable but navigation does not happen.

3. **Improve onboarding plan data errors**
   - Update the plan detail queries to surface database/access errors instead of silently returning empty data.
   - If access is denied or the plan cannot load, show a readable message rather than “No onboarding plan yet”.

4. **Verify the admin flow**
   - Confirm the logged-in admin reaches the onboarding list and can open the existing plan.
   - Re-check that the backend helper permissions are present and that the existing plan remains accessible to admins.

## Technical details

- Files to update:
  - `src/hooks/use-auth.tsx`
  - `src/routes/_authenticated/onboarding.tsx`
  - `src/routes/_authenticated/onboarding.$profileId.tsx`
- No new database schema change is expected right now; the helper function grants already exist in the backend.