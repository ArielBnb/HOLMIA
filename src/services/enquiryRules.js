// Pure helpers for enquiries (no Supabase import, testable in Node).
export const ENQUIRY_MAX = 2000;

export const enquiryStatus = (enquiry) => (enquiry?.reply ? 'handled' : 'pending');

export const ENQUIRY_STATUS = {
  pending: { label: 'Pending', bg: '#FFF4E5', fg: '#8A5300' },
  handled: { label: 'Handled', bg: '#E8F5E9', fg: '#1B5E20' },
};

export function filterEnquiries(rows, filter) {
  if (filter === 'pending' || filter === 'handled') return rows.filter((e) => enquiryStatus(e) === filter);
  return rows;
}

export function countByStatus(rows) {
  const pending = rows.filter((e) => enquiryStatus(e) === 'pending').length;
  return { all: rows.length, pending, handled: rows.length - pending };
}

// Returns an error message, or '' when the text can be sent.
export function validateEnquiryText(text, label = 'Message') {
  const length = String(text ?? '').trim().length;
  if (length === 0) return `${label} cannot be empty.`;
  if (length > ENQUIRY_MAX) return `${label} must be at most ${ENQUIRY_MAX} characters.`;
  return '';
}
