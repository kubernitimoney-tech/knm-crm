/** Text input placeholder — e.g. "Enter Email Address" */
export function enterPlaceholder(label: string): string {
  return `Enter ${label}`;
}

/** Dropdown / select placeholder — e.g. "Select Branch" */
export function selectPlaceholder(label: string): string {
  return `Select ${label}`;
}

/** Search field placeholder — e.g. "Enter Name, Mobile, or Lead ID" */
export function searchPlaceholder(...fields: string[]): string {
  return `Enter ${fields.join(', ')}`;
}
