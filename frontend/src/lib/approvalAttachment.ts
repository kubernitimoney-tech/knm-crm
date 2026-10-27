/** Client-side mirror of the backend approval-evidence rules (content is re-checked server-side). */
export const APPROVAL_ATTACHMENT_EXTENSIONS = ['.pdf', '.eml', '.msg', '.png', '.jpg', '.jpeg'];
export const APPROVAL_ATTACHMENT_ACCEPT = APPROVAL_ATTACHMENT_EXTENSIONS.join(',');
export const APPROVAL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export function validateApprovalAttachment(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!APPROVAL_ATTACHMENT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return 'Only PDF, EML, MSG, PNG or JPG files are allowed.';
  }
  if (file.size === 0) return 'The attachment is empty.';
  if (file.size > APPROVAL_ATTACHMENT_MAX_BYTES) return 'The attachment must be 5 MB or smaller.';
  return null;
}
