#!/usr/bin/env ts-node
// Global type declarations for Node.js 18+ fetch
declare global {
  function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/**
 * X Platform Scraping CLI (Sync Version)
 * 
 * Script untuk melakukan scraping data dari X platform (Twitter)
 * dengan membagi rata limit per hari dalam range tanggal yang panjang.
 * Menggunakan endpoint /api/sync/x (synchronous - langsung return hasil)
 * 
 * Usage:
 *   ts-node src/scripts/scrape-x-cli.ts [options]
 * 
 * Options:
 *   -i, --input <path>      Path ke file input CSV (default: input_keyword.csv)
 *   -o, --output <path>     Path ke direktori output (default: output)
 *   -c, --concurrency <n>   Jumlah concurrent requests (default: 3)
 *   --api-url <url>         Base URL API (default: http://localhost:3000/api)
 *   -h, --help              Tampilkan bantuan
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
interface InputRow {
  category: string;
  keyword: string;
  dateRange: string;
  limit: number;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DailyTask {
  keyword: string;
  category: string;
  startDate: string;
  endDate: string;
  maxItems: number;
  originalLimit: number;
}

/**
 * Response dari /api/sync/x endpoint
 * Langsung mengembalikan hasil scraping (synchronous)
 */
interface SyncScrapeResult {
  success: boolean;
  metadata: {
    platform: string;
    scrapedAt: string;
    completedAt: string;
    totalItems: number;
    totalDuration: number;
  };
  data: {
    posts: XPost[];
    metadata: {
      keywords: string;
      startDate: string;
      endDate: string;
      totalRanges: number;
      collectedAt: string;
    };
  };
  statistics: {
    totalItems: number;
    duration: number;
    successRate: number;
  };
  error?: {
    message: string;
    code: string;
  };
}

interface XPost {
  id: string;
  text: string;
  url: string;
  twitterUrl?: string;
  createdAt: string;
  author: {
    userName: string;
    name?: string;
  };
}

interface OutputRow {
  id: string;
  authorUserName: string;
  text: string;
  url: string;
  keyword: string;
  category: string;
  createdAt: string;
}

interface CliOptions {
  inputPath: string;
  outputDir: string;
  concurrency: number;
  apiUrl: string;
}

// Parse command line arguments
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    inputPath: 'input_keyword.csv',
    outputDir: 'output',
    concurrency: 25,
    apiUrl: 'http://localhost:3000/api'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-i':
      case '--input':
        options.inputPath = args[++i];
        break;
      case '-o':
      case '--output':
        options.outputDir = args[++i];
        break;
      case '-c':
      case '--concurrency':
        options.concurrency = parseInt(args[++i], 10) || 3;
        break;
      case '--api-url':
        options.apiUrl = args[++i];
        break;
      case '-h':
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
X Platform Scraping CLI (Sync Version)

Usage:
  ts-node src/scripts/scrape-x-cli.ts [options]

Options:
  -i, --input <path>      Path ke file input CSV (default: input_keyword.csv)
  -o, --output <path>     Path ke direktori output (default: output)
  -c, --concurrency <n>   Jumlah concurrent requests (default: 3)
  --api-url <url>         Base URL API (default: http://localhost:3000/api)
  -h, --help              Tampilkan bantuan

Contoh:
  ts-node src/scripts/scrape-x-cli.ts -i input_keyword.csv -o output -c 5
`);
}

// Parse CSV dengan delimiter semicolon
function parseCSV(content: string): InputRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  
  const rows: InputRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle quoted fields dengan benar
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++; // Skip next quote
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
    
    const row: InputRow = {
      category: values[0] || '',
      keyword: values[1] || '',
      dateRange: values[2] || '',
      limit: parseInt(values[3], 10) || 0
    };
    
    rows.push(row);
  }
  
  return rows;
}

// Parse date range string (e.g., "2024-01-01 - 2025-06-30")
function parseDateRange(dateRangeStr: string): DateRange {
  const parts = dateRangeStr.split('-').map(p => p.trim());
  
  // Handle format "YYYY-MM-DD - YYYY-MM-DD"
  if (parts.length === 4) {
    const startDate = new Date(`${parts[0]}-${parts[1]}-${parts[2].split(' ')[0]}`);
    const endDate = new Date(`${parts[2].split(' ')[1] || parts[2]}-${parts[3]}`);
    return { startDate, endDate };
  }
  
  // Fallback: split by " - "
  const dates = dateRangeStr.split(' - ').map(d => d.trim());
  return {
    startDate: new Date(dates[0]),
    endDate: new Date(dates[1])
  };
}

// Format date ke YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Hitung jumlah hari antara dua tanggal
function getDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay)) + 1;
}

// Generate daily tasks dari input row
function generateDailyTasks(row: InputRow): DailyTask[] {
  const { startDate, endDate } = parseDateRange(row.dateRange);
  const totalDays = getDaysBetween(startDate, endDate);
  
  // Bagi rata limit per hari
  const baseLimitPerDay = Math.floor(row.limit / totalDays);
  const remainder = row.limit % totalDays;
  
  const tasks: DailyTask[] = [];
  const currentDate = new Date(startDate);
  let dayIndex = 0;
  
  while (currentDate <= endDate) {
    // Distribute remainder ke hari-hari pertama
    const dailyLimit = baseLimitPerDay + (dayIndex < remainder ? 1 : 0);
    
    tasks.push({
      keyword: row.keyword,
      category: row.category,
      startDate: formatDate(currentDate),
      endDate: formatDate(currentDate),
      maxItems: dailyLimit,
      originalLimit: row.limit
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
    dayIndex++;
  }
  
  return tasks;
}

// Task with index interface
interface TaskWithIndex<T> {
  task: T;
  index: number;
}

// Concurrent queue implementation
class ConcurrentQueue<T, R> {
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  async execute(
    items: TaskWithIndex<T>[], 
    executor: (item: TaskWithIndex<T>) => Promise<R>
  ): Promise<{ results: R[]; errors: { item: TaskWithIndex<T>; error: Error }[] }> {
    const tasks = [...items];
    const results: R[] = [];
    const errors: { item: TaskWithIndex<T>; error: Error }[] = [];
    let running = 0;

    return new Promise((resolve) => {
      const processNext = async () => {
        if (tasks.length === 0 && running === 0) {
          resolve({ results, errors });
          return;
        }

        while (running < this.concurrency && tasks.length > 0) {
          const taskItem = tasks.shift()!;
          running++;

          executor(taskItem)
            .then(result => {
              results.push(result);
            })
            .catch(error => {
              errors.push({ item: taskItem, error });
            })
            .finally(() => {
              running--;
              processNext();
            });
        }
      };

      processNext();
    });
  }
}

// API Client untuk endpoint /api/sync/x
class SyncScrapingApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Synchronous scraping - langsung mengembalikan hasil
   * POST /api/sync/x
   */
  async scrapeX(task: DailyTask): Promise<SyncScrapeResult> {
    const payload = {
      config: {
        keywords: task.keyword,
        startDate: task.startDate,
        endDate: task.endDate,
        maxItems: task.maxItems
      },
      options: {
        priority: 'normal'
      }
    };

    const response = await fetch(`${this.baseUrl}/sync/x`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: SyncScrapeResult = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${data.error?.message || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(`Scraping failed: ${data.error?.message || 'Unknown error'}`);
    }

    return data;
  }
}

// Process single task
async function processTask(
  task: DailyTask, 
  apiClient: SyncScrapingApiClient,
  taskIndex: number,
  totalTasks: number
): Promise<OutputRow[]> {
  console.log(`\n[${taskIndex + 1}/${totalTasks}] Processing: ${task.keyword.substring(0, 50)}...`);
  console.log(`  📅 Date: ${task.startDate} to ${task.endDate}`);
  console.log(`  📊 Max Items: ${task.maxItems}`);

  try {
    // Sync scraping - langsung dapat hasil tanpa polling
    console.log(`  ⏳ Sending sync request...`);
    
    const result = await apiClient.scrapeX(task);
    
    console.log(`  ✅ Scraping completed: ${result.metadata.totalItems} items (${result.metadata.totalDuration}ms)`);

    // Transform to output format
    return result.data.posts.map(post => ({
      id: post.id,
      authorUserName: post.author.userName,
      text: post.text.replace(/[\r\n]+/g, ' ').replace(/"/g, '""'), // Escape newlines and quotes
      url: post.url || post.twitterUrl || '',
      keyword: task.keyword,
      category: task.category,
      createdAt: post.createdAt
    }));

  } catch (error) {
    console.error(`  ❌ Error processing task: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

// Escape CSV field
function escapeCSV(value: string): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes jika mengandung semicolon atau quotes
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Write output CSV
function writeOutputCSV(rows: OutputRow[], outputPath: string): void {
  const header = 'id;author.userName;text;url;keyword;category;createdAt\n';
  
  const lines = rows.map(row => [
    escapeCSV(row.id),
    escapeCSV(row.authorUserName),
    escapeCSV(row.text),
    escapeCSV(row.url),
    escapeCSV(row.keyword),
    escapeCSV(row.category),
    escapeCSV(row.createdAt)
  ].join(';'));

  const content = header + lines.join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf-8');
}

// Main function
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    const options = parseArgs();
    
    console.log('\n🚀 X Platform Scraping CLI (Sync Version)');
    console.log('========================================\n');
    console.log(`Input: ${options.inputPath}`);
    console.log(`Output: ${options.outputDir}`);
    console.log(`Concurrency: ${options.concurrency}`);
    console.log(`API URL: ${options.apiUrl}`);
    console.log(`Endpoint: /api/sync/x (synchronous)\n`);

    // Validate input file exists
    if (!fs.existsSync(options.inputPath)) {
      throw new Error(`Input file not found: ${options.inputPath}`);
    }

    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }

    // Read and parse input CSV
    const inputContent = fs.readFileSync(options.inputPath, 'utf-8');
    const inputRows = parseCSV(inputContent);

    console.log(`📁 Loaded ${inputRows.length} keywords from input file\n`);

    // Generate all daily tasks
    const allTasks: DailyTask[] = [];
    for (const row of inputRows) {
      const tasks = generateDailyTasks(row);
      allTasks.push(...tasks);
    }

    console.log(`📊 Total daily tasks to process: ${allTasks.length}\n`);

    // Initialize API client
    const apiClient = new SyncScrapingApiClient(options.apiUrl);

    // Test API connection
    try {
      const healthCheck = await fetch(`${options.apiUrl}/health`);
      if (healthCheck.ok) {
        console.log('✅ API is reachable\n');
      }
    } catch {
      console.warn('⚠️ Could not reach API health endpoint, continuing anyway...\n');
    }

    // Process tasks with concurrency control
    const queue = new ConcurrentQueue<DailyTask, OutputRow[]>(options.concurrency);
    
    // Buat array task dengan index untuk tracking
    const tasksWithIndex: TaskWithIndex<DailyTask>[] = allTasks.map((task, index) => ({ task, index }));
    
    const { results, errors } = await queue.execute(
      tasksWithIndex, 
      async ({ task, index }) => {
        return processTask(task, apiClient, index, allTasks.length);
      }
    );

    // Flatten results
    const allOutputRows: OutputRow[] = results.flat();
    
    console.log(`\n📊 Processing Summary:`);
    console.log(`  ✅ Successful tasks: ${allTasks.length - errors.length}`);
    console.log(`  ❌ Failed tasks: ${errors.length}`);
    console.log(`  📦 Total items collected: ${allOutputRows.length}`);

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const inputFileName = path.basename(options.inputPath, '.csv');
    const outputFileName = `${inputFileName}_${timestamp}.csv`;
    const outputPath = path.join(options.outputDir, outputFileName);

    // Write output CSV
    writeOutputCSV(allOutputRows, outputPath);
    
    console.log(`\n💾 Output saved to: ${outputPath}`);

    // Log errors if any
    if (errors.length > 0) {
      console.log(`\n⚠️ Errors encountered:`);
      errors.forEach(({ item, error }) => {
        console.log(`  - ${item.task.keyword.substring(0, 30)}... (${item.task.startDate}): ${error.message}`);
      });
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n⏱️ Total duration: ${duration.toFixed(2)} seconds`);
    console.log('✨ Done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run main
main();
