# Cursor Rules (Dashboard)

- **rules/** — Cursor rule files (`.mdc`). These are applied when working in this Next.js dashboard.
- **structure.mdx** — Project structure and click-flow reference.

## Next.js skills (full GitHub content)

All rules from **https://github.com/wsimmonds/claude-nextjs-skills** are copied into **rules/** as `.mdc` files with `alwaysApply: true`, so they apply by default when writing Next.js code.

| File | Content |
|------|---------|
| **nextjs-app-router-fundamentals.mdc** | App Router, migration, layouts, metadata, generateStaticParams |
| **nextjs-server-client-components.mdc** | Server vs Client, cookies/headers, searchParams, useSearchParams + Suspense |
| **nextjs-anti-patterns.mdc** | useEffect/useState misuse, getServerSideProps, next/head, serial await, etc. |
| **nextjs-advanced-routing.mdc** | Route Handlers, Server Actions, Parallel/Intercepting routes, error boundaries, streaming |
| **nextjs-dynamic-routes-params.mdc** | Dynamic routes, params as Promise, useParams, catch-all |
| **nextjs-server-navigation.mdc** | Link, redirect(), no useRouter in Server Components |
| **nextjs-client-cookie-pattern.mdc** | Client component + server action to set cookies |
| **nextjs-pathname-id-fetch.mdc** | Fetch by URL param, app/[id]/page.tsx pattern |
| **nextjs-use-search-params-suspense.mdc** | useSearchParams + 'use client' + Suspense |
| **vercel-ai-sdk.mdc** | AI SDK v5, useChat, streamText, tools, embeddings |

**nextjs-skills-default.mdc** is a short summary of the same rules for quick reference.
