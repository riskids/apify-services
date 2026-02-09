/**
 * Common validators
 */

import { DateUtils } from './dateUtils';

export class Validators {
  /**
   * Validate that value is not empty
   */
  public static isNotEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  }

  /**
   * Validate that value is a positive number
   */
  public static isPositiveNumber(value: any): boolean {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }

  /**
   * Validate that value is a non-negative number
   */
  public static isNonNegativeNumber(value: any): boolean {
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  }

  /**
   * Validate date range
   */
  public static isValidDateRange(startDate: string, endDate: string): boolean {
    if (!DateUtils.isValidDate(startDate) || !DateUtils.isValidDate(endDate)) {
      return false;
    }
    return startDate <= endDate;
  }

  /**
   * Validate that value is one of allowed values
   */
  public static isOneOf(value: any, allowedValues: any[]): boolean {
    return allowedValues.includes(value);
  }

  /**
   * Validate string length
   */
  public static isValidLength(value: string, min: number, max: number): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const length = value.length;
    return length >= min && length <= max;
  }

  /**
   * Validate URL format
   */
  public static isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate email format
   */
  public static isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationResult {
  public errors: ValidationError[] = [];

  public addError(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  public isValid(): boolean {
    return this.errors.length === 0;
  }

  public throwIfInvalid(): void {
    if (!this.isValid()) {
      const messages = this.errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${messages}`);
    }
  }
}
