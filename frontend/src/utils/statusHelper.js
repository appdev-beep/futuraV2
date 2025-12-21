export function displayStatus(s) {
  if (s === null || s === undefined) return s;
  const key = String(s).trim().toUpperCase();

  const map = {
    'PENDING_EMPLOYEE': 'For Employee Approval',
    'PENDING - EMPLOYEE': 'For Employee Approval',
    'EMPLOYEE': 'For Employee Approval',
    'PENDING_SUPERVISOR': 'For Supervisor Approval',
    'PENDING_MANAGER': 'For Manager Approval',
    'PENDING_HR': 'For HR Approval',
    'PENDING_AM': 'For AM Approval',
    'DRAFT': 'Draft',
    'APPROVED': 'Approved',
    'REJECTED': 'Rejected',
    'UNREAD': 'Unread'
  };

  if (map[key]) return map[key];

  if (key.startsWith('PENDING_')) {
    const rest = key.slice('PENDING_'.length).toLowerCase();
    return `For ${rest.charAt(0).toUpperCase() + rest.slice(1)} Approval`;
  }

  return String(s);
}

export default displayStatus;
