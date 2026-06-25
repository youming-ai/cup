# 废弃文件清理设计规范 (2026-06-25)

## 1. 背景与目标
在项目迭代过程中，积累了一些未使用的代码文件和静态资源。为了保持代码库的健康度、可维护性并减少构建体积，我们需要对这些废弃文件进行扫描并安全地清理。

## 2. 清理范围与决策
经过扫描与确认，以下文件将予以删除或保留：

### A. 待删除的废弃文件
- `src/components/ErrorBoundary.tsx`
  - **原因**：组件未被任何文件导入，无实际使用场景。
- `src/hooks/useQueryParam.ts`
  - **原因**：自定义 Hook 未被任何文件导入，无实际使用场景。
- `public/og.svg`
  - **原因**：公共资源，但 `index.html` 仅引用了 `og.png`，此 SVG 资源完全未被使用。

### B. 特殊保留的文件（排除清理）
- `public/sw.js`
  - **原因**：虽然没有在 JS/TS 中静态导入，但在 `src/main.tsx` 中动态注册，是 PWA 安装的必要条件。
- `worker/index.ts` 中的 `default export`
  - **原因**：Cloudflare Worker 的默认入口点，由 Wrangler 运行时自动调用。

## 3. 验证方案 (Verification Plan)
删除文件后，必须执行以下步骤确保系统功能不受影响：
- **静态类型检查与构建**：执行 `bun run build`，它会运行 `tsc` 和 `vite build`。如果不报错，说明没有隐藏的静态依赖。
- **单元测试**：执行 `bun run test --run`，确认所有测试依然全部通过。
- **重新扫描**：再次运行 `npx knip`，确认不再有意外的废弃文件提示。
