/**
 * Format monetary amount with currency symbol
 * @param {number|string} amount
 * @param {string} [currency='USD']
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'INR', options = {}) {
  const numeric = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: options.decimals ?? 0,
      maximumFractionDigits: options.decimals ?? 0,
    }).format(numeric);
  } catch {
    return `₹${numeric.toLocaleString('en-IN')}`;
  }
}

export default {
  formatCurrency,
};
