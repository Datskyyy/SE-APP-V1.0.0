export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isStrongEnoughPassword(password: string) {
  return password.length >= 6;
}
