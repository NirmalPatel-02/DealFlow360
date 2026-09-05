/**
 * Format a percentage value
 * @param {number|string} value
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPercent(value, decimals = 1) {
  const numeric = Number(value || 0);
  return `${numeric.toFixed(decimals)}%`;
}

/**
 * Format a date string
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

/**
 * Capitalize first letter of string
 * @param {string} text
 * @returns {string}
 */
export function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default {
  formatPercent,
  formatDate,
  capitalize,
};
