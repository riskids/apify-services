/**
 * Date manipulation utilities
 */

import { DateRange } from '../types/common.types';

export class DateUtils {
  /**
   * Format date to YYYY-MM-DD
   */
  public static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse date string to Date object
   */
  public static parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${dateString}`);
    }
    return date;
  }

  /**
   * Check if date string is valid
   */
  public static isValidDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Add days to a date
   */
  public static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get difference in days between two dates
   */
  public static getDaysDiff(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / msPerDay);
  }

  /**
   * Generate date ranges
   */
  public static generateDateRanges(
    startDate: Date,
    endDate: Date,
    daysPerRange: number
  ): DateRange[] {
    const ranges: DateRange[] = [];
    let currentStart = new Date(startDate);

    while (currentStart <= endDate) {
      const rangeEnd = new Date(currentStart);
      rangeEnd.setDate(rangeEnd.getDate() + daysPerRange - 1);

      if (rangeEnd > endDate) {
        rangeEnd.setTime(endDate.getTime());
      }

      ranges.push({
        start: this.formatDate(currentStart),
        end: this.formatDate(rangeEnd),
      });

      currentStart = new Date(rangeEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    return ranges;
  }

  /**
   * Get ISO string for current time
   */
  public static now(): string {
    return new Date().toISOString();
  }

  /**
   * Check if date is within range
   */
  public static isWithinRange(date: Date, startDate: Date, endDate: Date): boolean {
    return date >= startDate && date <= endDate;
  }
}
