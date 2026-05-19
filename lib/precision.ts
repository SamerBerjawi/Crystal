import Big from 'big.js';

/**
 * Provides high-precision financial mathematics to avoid floating point errors.
 */
export const precision = {
  add: (a: number, b: number): number => {
    return new Big(a).plus(new Big(b)).toNumber();
  },
  subtract: (a: number, b: number): number => {
    return new Big(a).minus(new Big(b)).toNumber();
  },
  multiply: (a: number, b: number): number => {
    return new Big(a).times(new Big(b)).toNumber();
  },
  divide: (a: number, b: number): number => {
    if (b === 0) return 0;
    return new Big(a).div(new Big(b)).toNumber();
  },
  sum: (arr: number[]): number => {
    return arr.reduce((acc, val) => new Big(acc).plus(new Big(val)).toNumber(), 0);
  },
  abs: (a: number): number => {
    return new Big(a).abs().toNumber();
  }
};
