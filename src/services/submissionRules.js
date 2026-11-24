export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function submissionValues(property, value, text, today = localDate()) {
  if (property.status !== 'active' || !['sale', 'rent'].includes(property.listing_type)) {
    throw new Error('This listing is no longer available.');
  }
  const notes = text.trim();
  if (notes.length > 2000) throw new Error('Use at most 2,000 characters.');
  const input = value.trim();
  if (property.listing_type === 'sale') {
    const decimal = input.replace(',', '.');
    const amount = Number(decimal);
    if (!/^\d+(\.\d{1,2})?$/.test(decimal) || amount <= 0 || amount >= 1e12) {
      throw new Error('Enter a positive amount below £1 trillion, with up to two decimal places.');
    }
    return { amount, message: notes || null };
  }
  const date = new Date(input + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== input || input < today) {
    throw new Error('Choose a valid move-in date from today onward.');
  }
  return { move_in_date: input, notes };
}
