export type StatusWiseLeadTab =
  | 'fresh'
  | 'reloan'
  | 'interested'
  | 'documents-received'
  | 'call-back'
  | 'no-answer'
  | 'document-pending'
  | 'rejected';

export const STATUS_WISE_LEAD_TABS: {
  value: StatusWiseLeadTab;
  label: string;
}[] = [
  { value: 'fresh', label: 'Fresh' },
  { value: 'reloan', label: 'Reloan' },
  { value: 'call-back', label: 'Call Back' },
  { value: 'no-answer', label: 'No Answer' },
  { value: 'document-pending', label: 'Document Pending' },
  { value: 'interested', label: 'Interested' },
  { value: 'documents-received', label: 'Documents Received' },
  { value: 'rejected', label: 'Rejected' },
];

export function isStatusWiseLeadTab(value: string | null): value is StatusWiseLeadTab {
  return STATUS_WISE_LEAD_TABS.some((tab) => tab.value === value);
}

export function statusWiseTabFetchParams(tab: StatusWiseLeadTab): {
  status?: string;
  application_status?: string;
  call_disposition?: string;
} {
  switch (tab) {
    case 'fresh':
      return { status: 'fresh' };
    case 'reloan':
      return { status: 'reloan' };
    case 'interested':
      return { status: 'interested' };
    case 'documents-received':
      return { status: 'documents_received' };
    case 'call-back':
      return { status: 'call_back' };
    case 'no-answer':
      return { call_disposition: 'no_answer' };
    case 'document-pending':
      return { status: 'documents_pending' };
    case 'rejected':
      return { application_status: 'rejected' };
    default:
      return {};
  }
}

export function statusWiseTabEmptyMessage(tab: StatusWiseLeadTab): string {
  switch (tab) {
    case 'fresh':
      return 'No fresh leads found';
    case 'reloan':
      return 'No reloan leads found';
    case 'interested':
      return 'No interested leads found';
    case 'documents-received':
      return 'No leads with Documents Received status found';
    case 'call-back':
      return 'No leads with Call Back status found';
    case 'no-answer':
      return 'No leads with No Answer disposition found';
    case 'document-pending':
      return 'No leads with Document Pending status found';
    case 'rejected':
      return 'No leads with rejected applications found';
    default:
      return 'No leads found';
  }
}
