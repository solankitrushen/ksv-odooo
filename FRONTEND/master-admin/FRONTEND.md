# Frontend — Template Reference

Next.js 15 App Router admin dashboard. Auth is handled by Clerk. The frontend proxies authenticated API calls to the Express backend — the browser never talks to the backend directly.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Clerk (`@clerk/nextjs`) |
| UI Components | shadcn/ui (Radix primitives + Tailwind) |
| Styling | Tailwind CSS v4 |
| Theme | next-themes (light / dark / system) |
| Icons | lucide-react |
| Language | TypeScript |

---

## Project Structure

```
frontend/src/
│
├── app/
│   ├── layout.tsx                        # Root layout — ClerkProvider, ThemeProvider, AuthProvider
│   ├── page.tsx                          # Root redirect → /dashboard
│   ├── globals.css                       # CSS variables, base styles
│   │
│   ├── (auth)/                           # Route group — no dashboard chrome
│   │   ├── layout.tsx                    # Centered card layout for auth pages
│   │   └── auth/
│   │       ├── login/[[...sign-in]]/     # Clerk <SignIn /> (catch-all for SSO callbacks)
│   │       └── signup/[[...sign-up]]/    # Clerk <SignUp />
│   │
│   ├── (dashboard)/                      # Route group — wrapped in DashboardLayout
│   │   ├── layout.tsx                    # Mounts DashboardLayout
│   │   └── dashboard/
│   │       └── page.tsx                  # Main dashboard page (start here for new features)
│   │
│   └── api/                              # Next.js route handlers (backend proxy)
│       └── user/
│           └── notification-prefs/
│               └── route.ts             # GET/PATCH — proxies to Express backend
│
├── components/
│   ├── layout/
│   │   ├── dashboard-layout.tsx          # Shell: sidebar + header + main content area
│   │   ├── left-sidebar.tsx              # Collapsible nav sidebar (persists to localStorage)
│   │   └── header.tsx                   # Top header bar
│   │
│   ├── settings/
│   │   └── settings-modal.tsx            # 4-tab settings modal (Profile/Appearance/Notifications/Security)
│   │
│   ├── auth/
│   │   └── require-auth.tsx              # Client-side auth guard component
│   │
│   ├── theme-provider.tsx                # next-themes wrapper + useTheme() hook
│   └── ui/                              # shadcn/ui components (button, input, dialog, switch…)
│
├── contexts/
│   ├── auth-context.tsx                  # useAuth() — wraps Clerk, exposes { user, isAuthenticated, logout }
│   └── page-title-context.tsx            # usePageTitle() — sets dynamic breadcrumb in header
│
├── constants/
│   └── nav.constants.ts                  # SIDEBAR_NAV array — add nav items here
│
├── lib/
│   ├── backend-fetch.ts                  # fetchBackendJson() — safe JSON fetch with error handling
│   ├── server-fetch.ts                   # fetchBackendJsonWithAuth() — server-side fetch with Clerk JWT
│   ├── backend-url.ts                    # BACKEND_URL constant from env
│   └── utils.ts                          # cn() helper (clsx + tailwind-merge)
│
└── middleware.ts                         # Clerk middleware — protects all non-/auth/* routes
```

---

## Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

BACKEND_URL=http://localhost:5003
```

`BACKEND_URL` is server-side only (no `NEXT_PUBLIC_` prefix). The browser never touches the backend directly.

---

## Auth Architecture

```
Browser → Clerk (auth)
         ↓
     Next.js middleware (middleware.ts)
         │ clerkMiddleware() protects all routes except /auth/*
         ↓
     Page / API Route Handler
         │ fetchBackendJsonWithAuth() attaches Clerk JWT
         ↓
     Express backend (protect middleware verifies JWT)
```

### How backend calls work

All calls to the Express backend go through Next.js API route handlers (`app/api/`). This keeps the Clerk secret key server-side and means the browser only ever talks to the same origin.

**Client component → Next.js API route → Express backend:**
```ts
// In a client component
const res = await fetch("/api/user/notification-prefs");

// In app/api/user/notification-prefs/route.ts
import { fetchBackendJsonWithAuth } from "@/lib/server-fetch";
export async function GET() {
  const { data } = await fetchBackendJsonWithAuth(`${BACKEND_URL}/api/v1/user/notification-prefs`);
  return NextResponse.json(data);
}
```

`fetchBackendJsonWithAuth` (server-side only) automatically attaches the current user's Clerk JWT as a Bearer token.

---

## Adding a New Page

### 1. Create the page file

```ts
// src/app/(dashboard)/your-feature/page.tsx
export default function YourFeaturePage() {
  return <div>Your content</div>;
}
```

### 2. Add it to the sidebar nav

```ts
// src/constants/nav.constants.ts
import { YourIcon } from "lucide-react";

export const SIDEBAR_NAV: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/your-feature", label: "Your Feature", icon: YourIcon }, // add here
];
```

That's it — the sidebar renders from this array automatically.

### 3. Add a nested section (optional)

```ts
{
  label: "Section Name",
  icon: FolderIcon,
  children: [
    { href: "/section/page-one", label: "Page One" },
    { href: "/section/page-two", label: "Page Two" },
  ],
}
```

---

## Adding a Backend API Proxy Route

1. Create `src/app/api/your-route/route.ts`
2. Use `fetchBackendJsonWithAuth` to forward with auth:

```ts
import { NextRequest, NextResponse } from "next/server";
import { fetchBackendJsonWithAuth } from "@/lib/server-fetch";
import { BACKEND_URL } from "@/lib/backend-url";

export async function GET() {
  const { data, error } = await fetchBackendJsonWithAuth(
    `${BACKEND_URL}/api/v1/your-endpoint`
  );
  if (!data) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await fetchBackendJsonWithAuth(
    `${BACKEND_URL}/api/v1/your-endpoint`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!data) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}
```

3. Call from a client component:
```ts
const res = await fetch("/api/your-route", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
const data = await res.json();
```

---

## Sidebar

`left-sidebar.tsx` — collapsible, state persists to `localStorage` under key `"sidebar-collapsed"`.

- **Expanded** (`w-60`): full nav labels, user name/email, settings gear.
- **Collapsed** (`w-[52px]`): icons only, click the "A" logo to expand.
- Nav is driven entirely by `SIDEBAR_NAV` in `nav.constants.ts` — no other changes needed.

---

## Settings Modal

`settings-modal.tsx` — opened via the settings gear in the sidebar profile section.

Four tabs:

| Tab | What it does |
|---|---|
| Profile | Edit first/last name via `user.update()`. Read-only email. |
| Appearance | Light / Dark / System theme picker. Uses `useTheme()`. |
| Notifications | 4 toggles synced to MongoDB via `GET/PATCH /api/user/notification-prefs`. Prefetched when modal opens. |
| Security | Password change via `user.updatePassword()`. Connected accounts. Sign out all devices. |

**Notification prefs prefetch:** fetch starts the moment the modal opens (`open === true`), not when the user clicks the tab. By the time they navigate there the data is ready.

---

## Contexts

### `useAuth()`
```ts
const { user, isAuthenticated, isLoading, logout } = useAuth();
// user: { userId, email, firstName, lastName, role, profileImageUrl } | null
```
Wraps Clerk's `useUser()`. Use this everywhere instead of `useUser()` directly — it normalises the shape.

### `usePageTitle()`
```ts
const { setPageTitle } = usePageTitle();
// In a page component:
useEffect(() => {
  setPageTitle({ title: "My Page", description: "What this page does", backHref: "/dashboard" });
  return () => setPageTitle(null);
}, []);
```
Renders a breadcrumb sub-header below the top nav bar. Pass `null` to clear it.

---

## Theme

`theme-provider.tsx` wraps `next-themes`. The `useTheme()` hook is re-exported from there. Use `resolvedTheme` (not `theme`) when you need to know actual current value:

```ts
const { theme, resolvedTheme, setTheme } = useTheme();
setTheme("dark");   // "light" | "dark" | "system"
```

CSS variables for colours are defined in `globals.css` under `[data-theme="light"]` / `[data-theme="dark"]`.

---

## Known Issues (fix before production)

- `happy-dom` in `package.json` has a critical RCE vulnerability (VM context escape). Remove it if unused: `npm uninstall happy-dom`.
- Next.js 15.5.11 has an HTTP request smuggling CVE. Upgrade: `npm install next@latest`.
- `.env.local` must never be committed — confirm it's gitignored (`git check-ignore -v .env.local`).
