export interface Collection {
  id: string;
  customerId: string;
  collectionDate: string;
  collectionAmount: number;
  paymentMode: string;
  collectionStatus: 'Received' | 'Pending' | 'Failed';
  transactionRefNo: string;
  collectedBy: string;
  bankName: string;
  depositDate: string;
  nextFollowUpDate: string;
  receiptNumber: string;
  collectionType: string;
  bounceCharges: number;
  remarks: string;
  createdAt: string;
}

export interface Remark {
  id: string;
  customerId: string;
  remarkCategory: string;
  followUpDate: string;
  priority: 'Low' | 'Medium' | 'High';
  assignedTo: string;
  notes: string;
  createdAt: string;
}
