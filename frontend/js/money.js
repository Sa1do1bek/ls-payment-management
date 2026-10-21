export function safeInteger(value, field, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error(`${field} is outside the range this browser can display exactly.`);
  }
  return value;
}

export function paymentAmount(raw) {
  if (!/^[0-9]+$/.test(raw) || BigInt(raw) < 1n || BigInt(raw) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Enter a positive whole UZS amount within the displayed limit.');
  }
  return Number(raw);
}

export function outstandingTotal(debtors) {
  return debtors.reduce((sum, debtor) => sum + BigInt(safeInteger(debtor.debt, 'Debt')), 0n);
}
