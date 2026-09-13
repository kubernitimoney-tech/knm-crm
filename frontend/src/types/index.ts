export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId: string;
  avatar?: string;
  status: 'Active' | 'Inactive' | 'Resigned' | 'Absconding';
  joinedDate: string;
  lastLogin: string;
}

export interface Lead {
  id: string;
  leadId: string;
  customerName: string;
  /** Lead category (Fresh/Reloan) — backend `LeadCategory`, not pipeline status. */
  category: 'Fresh' | 'Reloan';
  /** @deprecated Use `category` for Fresh/Reloan; kept for backward compatibility. */
  status: 'Fresh' | 'Reloan';
  assignedRM: string;
  assignedCM: string;
  email: string;
  mobile: string;
  pancard: string;
  amount?: number;
  monthlyIncome?: number;
  requiredAmount?: number;
  city?: string;
  employmentType?: string;
  source?: string;
  createdAt: string;
  pipelineStatus?: string;
  assignedRmId?: string | null;
  assignedRmEmail?: string;
  customerId?: string;
}

export interface SanctionLead {
  id: string;
  leadId: string;
  customerName: string;
  branch: string;
  assignedCM: string;
  email: string;
  mobile: string;
  pancard: string;
  loanAmount: number;
  tenure: number;
  roi: number;
  repayDate: string;
  processingFee: number;
  monthlyIncome: number;
  cibil: number;
  status: string;
  date: string;
  rejectionReason?: string;
  loanType?: string;
  redFlagReason?: string;
  // Disbursal specific fields
  accountNo?: string;
  ifscCode?: string;
  loanNo?: string;
  loanAccount?: string;
  disbursedAmount?: number;
  // Closed accounts specific fields
  paymentAmount?: number;
  paymentMode?: string;
  paymentDate?: string;
  refNo?: string;
  discountAmt?: number;
  settledAmount?: number;
}

export interface Sanction {
  id: string;
  leadId: string;
  officer: string;
  target: number;
  achievement: number;
  percentage: number;
  deficit: number;
}

export interface SanctionFreshRepeat {
  id: string;
  officer: string;
  freshCases: number;
  freshLoanAmount: number;
  repeatCases: number;
  repeatLoanAmount: number;
  grandTotalCases: number;
  grandTotalAmount: number;
}

export interface BranchMetric {
  id: string;
  branch: string;
  target: number;
  achievement: number;
  percentage: number;
  deficit: number;
}

export interface MenuItem {
  title: string;
  path?: string;
  icon?: string;
  submenu?: MenuItem[];
}
