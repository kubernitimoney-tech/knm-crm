# Loan Management System

A comprehensive, enterprise-grade system for managing loan lifecycles, from lead generation and credit sanctioning to disbursal and collections.

## 🚀 Work Completed So Far

### 1. UI Standardization & Refinement
We have performed a global audit of the application's tables and forms to ensure a professional and consistent labeling system:
- **Labels Updated**:
    - `PAN` → `PAN No.`
    - `Mobile` / `Mob` → `Mobile No.`
    - `Aadhaar` / `Adhar` → `Aadhaar No.`
    - `Amount` → `Amt.` (e.g., `Loan Amt.`, `Disbursed Amt.`, `Settled Amt.`, `Req. Amt.`)
    - `Account No` → `Account No.`
    - `Loan No` → `Loan No.`
    - `Ref No` → `Ref No.`
- **Title Updates**: Set the application's formal title to "Loan Management System" in the index file.

### 2. Code Quality & Stability (Linting)
Fixed several critical TypeScript and React issues to ensure a stable build:
- **Type Safety**: Resolved mismatches where `Element` was passed instead of `string` or `ReactNode`.
- **Component Props**: Updated the `Card` component to accept `ReactNode` for titles and subtitles, allowing for richer UI elements.
- **Ref Handling**: Corrected `useRef` assignments in the OTP input fields in `RecoverPasswordPage`.
- **Routing Props**: Cleaned up invalid props (like `size`) being passed to `Link` components.

### 3. Database Architecture
Schema documentation lives at the repo root in `TABLE.md` (canonical reference for the current Django models).

---

## 🛠️ Tech Stack
- **Frontend**: React (Vite) + TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom UI Kit (Buttons, Cards, Tables)
- **State Management**: Zustand / Hooks
- **Documentation**: See `TABLE.md` at repo root for schema reference

## 📂 Project Structure
- `/src/features`: Business logic split by domain (Leads, Sanctions, Disbursal, Collections, etc.)
- `/src/components`: Reusable UI components.
