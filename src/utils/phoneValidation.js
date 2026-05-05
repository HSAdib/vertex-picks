export const isValidBDPhoneNumber = (phone) => {
  if (!phone) return false;
  
  // Remove all spaces and hyphens
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // Starts with +880, total length 14
  if (cleaned.startsWith('+880')) {
    return cleaned.length === 14 && /^\+880\d{10}$/.test(cleaned);
  }
  
  // Starts with 880, total length 13
  if (cleaned.startsWith('880')) {
    return cleaned.length === 13 && /^880\d{10}$/.test(cleaned);
  }
  
  // Starts with 01, total length 11
  if (cleaned.startsWith('01')) {
    return cleaned.length === 11 && /^01\d{9}$/.test(cleaned);
  }
  
  return false;
};
