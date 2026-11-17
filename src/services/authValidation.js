export function normalizeUsername(value) { return value.trim().toLowerCase(); }
export function validateRegistration({ fullName, username, password, confirmPassword, role }) {
  if (!fullName.trim() || fullName.trim().length > 120) return 'Enter your full name (1–120 characters).';
  if (!/^[a-z0-9_]{3,40}$/.test(normalizeUsername(username))) return 'Username: 3–40 letters, numbers or underscores.';
  if (password.length < 8 || password.length > 128) return 'Password must contain 8–128 characters.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  if (!['buyer', 'seller', 'agent'].includes(role)) return 'Select Buyer, Seller or Agent.';
  return '';
}
