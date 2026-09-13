export const brand = {
  name: import.meta.env.VITE_BRAND_NAME || 'Kuberniti Money',
  tagline: 'Quick loans. Clear terms. Trusted support.',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@kubernitimoney.com',
  supportPhone: import.meta.env.VITE_SUPPORT_PHONE || '+91-1800-XXX-XXXX',
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '',
  siteUrl: import.meta.env.VITE_SITE_URL || 'http://localhost:3001',
  legalName: 'kubernitimoney',
  legalEntity: 'Har Shreejee Finance and Leasing Company Ltd',
  cin: 'U65921DL1996PLC082373',
  copyrightYear: 2025,
} as const;

export const colors = {
  primaryDeep: '#2A2D4F',
  secondaryDark: '#424665',
  midShade: '#646884',
  lightGray: '#8D8FA4',
  lighterGray: '#B0B0C1',
  bgApp: '#F4F6F9',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  sidebarBg: '#2A2D4F',
  sidebarText: '#B0B0C1',
  sidebarActive: '#FFFFFF',
  sidebarHover: '#424665',
  /** @deprecated Use primaryDeep — kept as alias for the primary palette */
  accentIndigo: '#2A2D4F',
  /** @deprecated Use secondaryDark — kept as alias for the primary palette */
  accentTeal: '#424665',
} as const;

export const loanPurposes = [
  'Personal',
  'Medical emergency',
  'Wedding',
  'Home interiors',
  'Travel fund shortage',
  'Loan repayment',
  'Loan to clear bills',
  'Meeting immediate commitment',
  'Immediate purchase',
  'Buying gadgets',
  'Down-payment shortfall',
  'Household fund shortage',
  'Loan for paying school fees',
  'Others',
] as const;

export const MIN_MONTHLY_INCOME = 40000;
