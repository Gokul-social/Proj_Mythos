/**
 * Input Validation and Sanitization
 * Validates and sanitizes user inputs before submission
 */

import type { Stablecoin } from '@/components/dashboard/StablecoinSelector';

/**
 * Sanitize string input - remove potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes and control characters
  return input
    .replace(/\0/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Validate wallet address format (base58/hex)
 */
export function validateWalletAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  const trimmed = address.trim();
  
  // Skip validation for placeholder addresses
  if (trimmed.includes('placeholder')) {
    return true;
  }
  
  // Allow empty string (will be handled by caller)
  if (trimmed.length === 0) {
    return false;
  }
  
  // Legacy hex address validation (not used for Solana base58)
  // Must start with 0x and be 42 characters (including 0x prefix)
  // Followed by 40 hexadecimal characters
  const hexPattern = /^0x[a-fA-F0-9]{40}$/;
  
  return hexPattern.test(trimmed);
}

/**
 * Validate and sanitize numeric input
 */
export function validateNumber(
  value: string | number,
  min?: number,
  max?: number
): { valid: boolean; value?: number; error?: string } {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid number' };
  }
  
  if (min !== undefined && num < min) {
    return { valid: false, error: `Value must be at least ${min}` };
  }
  
  if (max !== undefined && num > max) {
    return { valid: false, error: `Value must be at most ${max}` };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate principal amount
 */
export function validatePrincipal(principal: number | string): { valid: boolean; value?: number; error?: string } {
  return validateNumber(principal, 0.01, 1000000000); // 0.01 to 1 billion
}

/**
 * Validate interest rate
 */
export function validateInterestRate(rate: number | string): { valid: boolean; value?: number; error?: string } {
  return validateNumber(rate, 0, 100); // 0% to 100%
}

/**
 * Validate term months
 */
export function validateTermMonths(months: number | string): { valid: boolean; value?: number; error?: string } {
  return validateNumber(months, 1, 60); // 1 to 60 months
}

/**
 * Validate credit score
 */
export function validateCreditScore(score: number | string): { valid: boolean; value?: number; error?: string } {
  return validateNumber(score, 300, 850); // 300 to 850
}

/**
 * Sanitize and validate loan form data
 */
export interface LoanFormData {
  role: 'borrower' | 'lender';
  walletAddress: string;
  stablecoin: Stablecoin;
  principal: number;
  interest_rate: number;
  term_months: number;
  credit_score?: number;
  autoConfirm: boolean;
  borrower_address?: string;
  lender_address?: string;
}

export function validateLoanFormData(data: Partial<LoanFormData>): {
  valid: boolean;
  data?: LoanFormData;
  errors: string[];
} {
  const errors: string[] = [];
  const sanitized: Partial<LoanFormData> = {};
  
  // Validate role
  if (!data.role || !['borrower', 'lender'].includes(data.role)) {
    errors.push('Invalid role');
  } else {
    sanitized.role = data.role;
  }
  
  // Validate wallet address (optional - allow empty or valid address)
  const walletAddr = data.walletAddress ? data.walletAddress.trim() : '';
  
  if (walletAddr && walletAddr.length > 0) {
    // Only validate if an address is actually provided
    if (!validateWalletAddress(walletAddr)) {
      errors.push('Invalid wallet address format. Must start with 0x and be 42 characters');
    } else {
      sanitized.walletAddress = sanitizeString(walletAddr);
    }
  } else {
    // Wallet address is optional - use placeholder if not provided
    sanitized.walletAddress = data.role === 'borrower' 
      ? '0x_placeholder_borrower' 
      : '0x_placeholder_lender';
  }
  
  // Validate stablecoin
  const validStablecoins: Stablecoin[] = ['USDT', 'USDC', 'PYUSD'];
  if (!data.stablecoin || !validStablecoins.includes(data.stablecoin.toUpperCase() as Stablecoin)) {
    errors.push('Invalid stablecoin');
  } else {
    sanitized.stablecoin = data.stablecoin.toUpperCase() as Stablecoin;
  }
  
  // Validate principal
  const principalResult = validatePrincipal(data.principal);
  if (!principalResult.valid) {
    errors.push(principalResult.error || 'Invalid principal');
  } else {
    sanitized.principal = principalResult.value!;
  }
  
  // Validate interest rate
  const rateResult = validateInterestRate(data.interest_rate);
  if (!rateResult.valid) {
    errors.push(rateResult.error || 'Invalid interest rate');
  } else {
    sanitized.interest_rate = rateResult.value!;
  }
  
  // Validate term months
  const termResult = validateTermMonths(data.term_months);
  if (!termResult.valid) {
    errors.push(termResult.error || 'Invalid term');
  } else {
    sanitized.term_months = termResult.value!;
  }
  
  // Validate credit score if borrower
  if (data.role === 'borrower' && data.credit_score !== undefined) {
    const scoreResult = validateCreditScore(data.credit_score);
    if (!scoreResult.valid) {
      errors.push(scoreResult.error || 'Invalid credit score');
    } else {
      sanitized.credit_score = scoreResult.value;
    }
  }
  
  // Validate autoConfirm (default to false if not provided)
  sanitized.autoConfirm = data.autoConfirm === true;
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: sanitized as LoanFormData, errors: [] };
}



