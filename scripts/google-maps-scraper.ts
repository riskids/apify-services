#!/usr/bin/env ts-node
/**
 * Google Maps Scraper Script
 * 
 * Script untuk scraping Google Maps secara concurrent dengan input dari CSV
 * dan menghasilkan output CSV yang sudah di-deduplicate
 * 
 * Usage:
 *   npx ts-node scripts/google-maps-scraper.ts
 *   npx ts-node scripts/google-maps-scraper.ts -c 5
 *   npx ts-node scripts/google-maps-scraper.ts -o custom_output.csv
 */

import * as fs from 'fs';
import * as path from 'path';

// Konfigurasi
const API_BASE_URL = 'http://localhost:3000';
const INPUT_FILE = path.join(__dirname, '..', 'input', 'google maps', 'input_garage door services.csv');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const LOCK_FILE = path.join(__dirname, '..', 'output', '.scraper.lock');

// Types
interface InputRow {
  city: string;
  country: string;
  keyword: string;
  niche: string;
}

interface GoogleMapsApiRequest {
  config: {
    location: string;
    searchStringsArray: string[];
    language: string;
    maxResults: number;
  };
}

interface GoogleMapsApiResponse {
  success: boolean;
  metadata?: {
    platform: string;
    totalItems: number;
    totalDuration: number;
  };
  data?: {
    places?: GoogleMapsPlace[];
    metadata?: any;
  };
  statistics?: {
    totalItems: number;
    duration: number;
    successRate: number;
  };
}

interface GoogleMapsPlace {
  name: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewsCount?: number;
  phoneNumber?: string;
  website?: string;
  placeId?: string;
}

interface OutputRow {
  [key: string]: string;
}

// Helper: delay
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// File Locking Mechanism for thread-safe writing
class FileLock {
  private lockPath: string;
  private lock_fd: number | null = null;

  constructor(lockPath: string) {
    this.lockPath = lockPath;
  }

  async acquire(): Promise<void> {
    const maxAttempts = 100;
    const retryDelay = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Create lock file if it doesn't exist
        if (!fs.existsSync(this.lockPath)) {
          fs.writeFileSync(this.lockPath, '', { flag: 'wx' });
        }
        // Try to open with exclusive lock
        this.lock_fd = fs.openSync(this.lockPath, 'r+');
        fs.fsyncSync(this.lock_fd);
        return; // Lock acquired
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock file already exists, wait and retry
          await delay(retryDelay);
        } else if (error.code === 'EBUSY' || error.code === 'EAGAIN') {
          // File busy, wait and retry
          await delay(retryDelay);
        } else {
          // Other error, try to create new lock
          await delay(retryDelay);
        }
      }
    }
    throw new Error('Failed to acquire lock');
  }

  release(): void {
    if (this.lock_fd !== null) {
      try {
        fs.closeSync(this.lock_fd);
      } catch (e) {
        // Ignore close errors
      }
      this.lock_fd = null;
    }
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch (e) {
      // Ignore unlink errors
    }
  }
}

// File lock instance for output file
const outputLock = new FileLock(LOCK_FILE);

// File lock instance for input file
const inputLock = new FileLock(path.join(__dirname, '..', 'input', '.input.lock'));

// Helper: fetch
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json() as T;
      return { success: response.ok, data, status: response.status };
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      console.log(`  Warning: Attempt ${attempt} failed, retrying...`);
      await delay(1000 * attempt);
    }
  }
  return { success: false, error: 'Max retries reached' };
}

// Parse CSV line(line: string):
function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

// Parse input CSV
function parseInputFile(filePath: string): InputRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('Input file is empty or has no data rows');
  }

  const headers = parseLine(lines[0]);
  const cityIdx = headers.indexOf('city');
  const countryIdx = headers.indexOf('country');
  const keywordIdx = headers.indexOf('keyword');
  const nicheIdx = headers.findIndex(h => h.toLowerCase() === 'niche');
  
  if (cityIdx === -1 || countryIdx === -1 || keywordIdx === -1) {
    throw new Error('Invalid input format. Required columns: city, country, keyword');
  }
  
  const rows: InputRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length > 0 && values[cityIdx]) {
      rows.push({
        city: values[cityIdx] || '',
        country: values[countryIdx] || '',
        keyword: values[keywordIdx] || '',
        niche: nicheIdx !== -1 ? values[nicheIdx] || '' : ''
      });
    }
  }
  
  return rows;
}

// Scrape single location
async function scrapeLocation(input: InputRow): Promise<GoogleMapsPlace[]> {
  const location = `${input.city}, ${input.country}`;
  
  const request: GoogleMapsApiRequest = {
    config: {
      location,
      searchStringsArray: [input.keyword],
      language: 'en',
      maxResults: 350
    }
  };

  const url = `${API_BASE_URL}/api/sync/google-maps`;
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  };

  const result = await fetchWithRetry<GoogleMapsApiResponse>(url, options);
  
  if (!result.success || !result.data?.data) {
    throw new Error(result.error || 'Failed to scrape location');
  }

  // Handle different response structures: { places: [...] } or [...] directly
  const data = result.data.data as any;
  const places = Array.isArray(data) ? data : (data.places || []);
  return places;
}

// Transform to output format
function transformToOutput(places: GoogleMapsPlace[], country: string, niche: string): OutputRow[] {
  return places.map(place => {
    return {
      'Company name': place.name || '',
      'First name': '',
      'Last name': '',
      'Website': place.website || '',
      'Email address': '',
      'Country': place.countryCode || country,
      'City': place.city || '',
      'Province/State': place.state || '',
      'Phone number': place.phoneNumber || '',
      'Niche': niche
    };
  });
}

// Escape CSV field
function escapeCSV(value: string): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Write output CSV with lock (append mode)
async function writeOutputCSV(rows: OutputRow[], outputPath: string): Promise<void> {
  await outputLock.acquire();
  try {
    const headerKeys = [
      'Company name',
      'First name',
      'Last name',
      'Website',
      'Email address',
      'Country',
      'City',
      'Province/State',
      'Phone number',
      'Niche'
    ];

    const lines: string[] = [];
    
    for (const row of rows) {
      lines.push(headerKeys.map(key => escapeCSV(row[key])).join(';'));
    }
    
    // Append to file instead of overwriting
    const fileContent = lines.join('\n') + '\n';
    fs.appendFileSync(outputPath, fileContent, 'utf-8');
  } finally {
    outputLock.release();
  }
}

// Initialize output file with headers
async function initOutputFile(outputPath: string): Promise<void> {
  await outputLock.acquire();
  try {
    const headerKeys = [
      'Company name',
      'First name',
      'Last name',
      'Website',
      'Email address',
      'Country',
      'City',
      'Province/State',
      'Phone number',
      'Niche'
    ];
    const headerLine = headerKeys.map(escapeCSV).join(';') + '\n';
    fs.writeFileSync(outputPath, headerLine, 'utf-8');
  } finally {
    outputLock.release();
  }
}

// Rewrite output file with deduplicated data (overwrite mode)
async function rewriteOutputFile(rows: OutputRow[], outputPath: string): Promise<void> {
  await outputLock.acquire();
  try {
    const headerKeys = [
      'Company name',
      'First name',
      'Last name',
      'Website',
      'Email address',
      'Country',
      'City',
      'Province/State',
      'Phone number',
      'Niche'
    ];

    const lines: string[] = [];
    lines.push(headerKeys.map(escapeCSV).join(';'));
    
    for (const row of rows) {
      lines.push(headerKeys.map(key => escapeCSV(row[key])).join(';'));
    }
    
    // Overwrite the file
    fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
  } finally {
    outputLock.release();
  }
}

// Delete processed input line after successful save
async function deleteInputLine(lineToDelete: string): Promise<void> {
  await inputLock.acquire();
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      return;
    }

    const content = fs.readFileSync(INPUT_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    
    // Keep header (first line) and lines that don't match the one to delete
    const newLines: string[] = [];
    let deleted = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      const trimmedToDelete = lineToDelete.trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;
      
      // Skip header line
      if (trimmedLine.toLowerCase().startsWith('city;')) {
        newLines.push(line);
        continue;
      }
      
      // Check if this line matches the one to delete
      if (!deleted && trimmedLine === trimmedToDelete) {
        deleted = true;
        continue;
      }
      
      newLines.push(line);
    }
    
    if (deleted) {
      fs.writeFileSync(INPUT_FILE, newLines.join('\n') + '\n', 'utf-8');
    }
  } catch (error) {
    console.log(`  Error deleting input line: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    inputLock.release();
  }
}

// Deduplicate
function deduplicateByCompanyName(rows: OutputRow[]): OutputRow[] {
  const seen = new Map<string, OutputRow>();
  
  for (const row of rows) {
    const companyName = row['Company name'].toLowerCase().trim();
    if (companyName && !seen.has(companyName)) {
      seen.set(companyName, row);
    }
  }
  
  return Array.from(seen.values());
}

// Parse CLI arguments
function parseArgs(): { concurrency: number; outputFile: string | null } {
  const args = process.argv.slice(2);
  let concurrency = 2;
  let outputFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '--concurrency') {
      concurrency = parseInt(args[++i], 10);
    } else if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    }
  }

  return { concurrency, outputFile };
}

// Main
async function main(): Promise<void> {
  const args = parseArgs();
  const concurrency = args.concurrency;
  
  console.log('\n=== Google Maps Scraper ===\n');

  console.log('Loading input file...');
  const inputs = parseInputFile(INPUT_FILE);
  console.log(`Loaded ${inputs.length} input(s)\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputFilename = args.outputFile || `google_maps_${timestamp}.csv`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  console.log(`Concurrency: ${concurrency}`);
  console.log(`Output: ${outputPath}\n`);

  // Initialize output file with headers
  console.log('Initializing output file...');
  await initOutputFile(outputPath);

  console.log('Starting concurrent scraping...\n');
  
  let completed = 0;
  let failed = 0;
  let totalPlaces = 0;

  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(inputs.length / concurrency);
    
    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} requests)...`);
    
    const promises = batch.map(async (input, idx) => {
      const globalIdx = i + idx;
      const originalLine = `${input.city};${input.country};${input.keyword};${input.niche}`;
      try {
        console.log(`  Processing [${globalIdx + 1}/${inputs.length}] ${input.city}, ${input.country} - ${input.keyword}`);
        const places = await scrapeLocation(input);
        console.log(`  Got ${places.length} places`);
        
        // Save data immediately on success with locking
        if (places.length > 0) {
          const transformed = transformToOutput(places, input.country, input.niche);
          await writeOutputCSV(transformed, outputPath);
          totalPlaces += transformed.length;
          
          // Delete input line after successful save
          await deleteInputLine(originalLine);
        }
        
        completed++;
        return { success: true, places };
      } catch (error) {
        console.log(`  Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
        return { success: false, places: [] };
      }
    });

    const results = await Promise.all(promises);
    
    if (i + concurrency < inputs.length) {
      await delay(500);
    }
  }

  console.log(`\nScraping completed!`);
  console.log(`  Successful: ${completed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total places: ${totalPlaces}\n`);

  // Read and deduplicate the output file
  console.log('Reading and deduplicating output file...');
  const outputContent = fs.readFileSync(outputPath, 'utf-8');
  const outputLines = outputContent.trim().split('\n');
  
  if (outputLines.length > 1) {
    const header = outputLines[0];
    const dataLines = outputLines.slice(1);
    
    const uniqueRows: OutputRow[] = [];
    const seen = new Set<string>();
    
    for (const line of dataLines) {
      if (!line.trim()) continue;
      const values = parseLine(line);
      if (values.length >= 10) {
        const row: OutputRow = {
          'Company name': values[0],
          'First name': values[1],
          'Last name': values[2],
          'Website': values[3],
          'Email address': values[4],
          'Country': values[5],
          'City': values[6],
          'Province/State': values[7],
          'Phone number': values[8],
          'Niche': values[9]
        };
        const companyName = row['Company name'].toLowerCase().trim();
        if (companyName && !seen.has(companyName)) {
          seen.add(companyName);
          uniqueRows.push(row);
        }
      }
    }
    
    console.log(`  Before deduplication: ${dataLines.length}`);
    console.log(`  After deduplication: ${uniqueRows.length}`);
    console.log(`  Removed: ${dataLines.length - uniqueRows.length} duplicates\n`);
    
    // Rewrite the output file with deduplicated data
    await rewriteOutputFile(uniqueRows, outputPath);
    console.log('Output file deduplicated and saved.\n');
  }

  // Count remaining input lines
  const remainingInputs = parseInputFile(INPUT_FILE);
  
  console.log('========== SUMMARY ==========');
  console.log(`Input rows processed: ${completed}`);
  console.log(`Failed:               ${failed}`);
  console.log(`Total places:        ${totalPlaces}`);
  console.log(`Remaining input:     ${remainingInputs.length}`);
  console.log('==============================');
  console.log(`Done! Output saved to: ${outputPath}\n`);
}

main().catch(error => {
  console.error('\nFatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
