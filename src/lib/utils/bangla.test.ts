import { describe, it, expect } from 'vitest';
import { toBanglaNumber, formatBanglaCurrency } from './bangla';

describe('Bangla Number Utils', () => {
  it('converts English digits to Bangla digits', () => {
    expect(toBanglaNumber('1234567890')).toBe('১২৩৪৫৬৭৮৯০');
  });

  it('formats large currency correctly with South Asian commas and Bangla digits', () => {
    // 100000 -> 1,00,000 -> ১,০০,০০০
    expect(formatBanglaCurrency(100000)).toBe('১,০০,০০০');
    
    // 10000000 -> 1,00,00,000 -> ১,০০,০০,০০০
    expect(formatBanglaCurrency(10000000)).toBe('১,০০,০০,০০০');
  });
});
