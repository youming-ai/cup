# Cleanup Obsolete Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up unused/obsolete files (`ErrorBoundary.tsx`, `useQueryParam.ts`, `og.svg`) to keep the codebase clean, and verify the build and tests still pass.

**Architecture:** Safe removal. Delete the identified files, verify that TypeScript, Vitest, Vite build, and Knip checks all succeed with zero errors.

**Tech Stack:** Bun, TypeScript, Vitest, Vite, Knip.

## Global Constraints
- Do not modify or delete dynamically resolved files (`public/sw.js`, `worker/index.ts` default export).
- Ensure all vitest tests continue to pass.
- Ensure the build compilation (`tsc && vite build`) finishes with exit code 0.

---

### Task 1: Delete Obsolete Files

**Files:**
- Modify: Delete `src/components/ErrorBoundary.tsx`
- Modify: Delete `src/hooks/useQueryParam.ts`
- Modify: Delete `public/og.svg`

**Interfaces:**
- Consumes: None (these files are completely unused)
- Produces: None

- [ ] **Step 1: Delete the files**
Run:
```bash
rm src/components/ErrorBoundary.tsx
rm src/hooks/useQueryParam.ts
rm public/og.svg
```

- [ ] **Step 2: Commit file deletion**
Run:
```bash
git add src/components/ErrorBoundary.tsx src/hooks/useQueryParam.ts public/og.svg
git commit -m "chore: delete unused components, hooks, and static assets"
```

---

### Task 2: Verify Types and Build

**Files:**
- Modify: None

**Interfaces:**
- Consumes: Cleaned file state from Task 1
- Produces: Successful type-check and Vite build output

- [ ] **Step 1: Run type-checking and build**
Run:
```bash
bun run build
```
Expected: Compiles with no typescript errors and outputs Vite distribution.

- [ ] **Step 2: Commit verification result**
Run:
```bash
git commit --allow-empty -m "test: verify compilation and build passes post-cleanup"
```

---

### Task 3: Verify Unit Tests and Knip Scan

**Files:**
- Modify: None

**Interfaces:**
- Consumes: Build verified in Task 2
- Produces: All unit tests passing, and Knip showing no additional unused files

- [ ] **Step 1: Run unit tests**
Run:
```bash
bun run test --run
```
Expected: All tests pass.

- [ ] **Step 2: Run Knip check**
Run:
```bash
npx knip
```
Expected: Output showing only `public/sw.js` and `worker/index.ts` as unused (or exits with known entries).

- [ ] **Step 3: Commit final verification**
Run:
```bash
git commit --allow-empty -m "test: verify unit tests and knip scanning post-cleanup"
```
