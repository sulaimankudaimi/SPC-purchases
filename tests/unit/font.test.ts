import { describe, it, expect } from 'vitest';
import { amiriFontDataUri } from '../../src/shared/amiriFont';

describe('Amiri font', () => {
  it('loads amiri font data uri', () => {
    expect(amiriFontDataUri).toBeDefined();
    expect(amiriFontDataUri.startsWith('data:')).toBe(true);
  });
});
