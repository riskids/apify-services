#!/usr/bin/env ts-node
/**
 * CSV Deduplication Script
 * 
 * Script untuk menghapus duplikasi data berdasarkan kolom 'id'
 * Format CSV: semicolon-delimited dengan header
 * 
 * Usage:
 *   ts-node src/scripts/dedupe-csv.ts <input-file> [options]
 * 
 * Options:
 *   -o, --output <path>     Path output file (default: <input>_deduped.csv)
 *   -c, --column <name>     Kolom untuk deduplikasi (default: id)
 *   -k, --keep <strategy>   Strategy: first|last (default: first)
 *   -s, --stats             Tampilkan statistik lengkap
 *   -h, --help              Tampilkan bantuan
 * 
 * Contoh:
 *   ts-node src/scripts/dedupe-csv.ts output/data.csv
 *   ts-node src/scripts/dedupe-csv.ts output/data.csv -o output/clean.csv -s
 */

import * as fs from 'fs';
import * as path from 'path';

// Deduplication script - no external API calls needed

interface CliOptions {
  inputPath: string;
  outputPath: string;
  column: string;
  keep: 'first' | 'last';
  showStats: boolean;
}

interface ParseResult {
  headers: string[];
  rows: string[][];
}

interface DedupeResult {
  headers: string[];
  rows: string[][];
  totalCount: number;
  uniqueCount: number;
  duplicateCount: number;
  duplicates: Array<{
    key: string;
    count: number;
    kept: 'first' | 'last';
  }>;
}

// Parse command line arguments
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0].startsWith('-')) {
    showHelp();
    process.exit(1);
  }

  const inputPath = args[0];
  const inputBase = path.basename(inputPath, '.csv');
  const inputDir = path.dirname(inputPath);
  
  const options: CliOptions = {
    inputPath,
    outputPath: path.join(inputDir, `${inputBase}_deduped.csv`),
    column: 'id',
    keep: 'first',
    showStats: false
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-o':
      case '--output':
        options.outputPath = args[++i];
        break;
      case '-c':
      case '--column':
        options.column = args[++i];
        break;
      case '-k':
      case '--keep':
        const keepValue = args[++i] as 'first' | 'last';
        if (keepValue !== 'first' && keepValue !== 'last') {
          console.error('Error: --keep harus "first" atau "last"');
          process.exit(1);
        }
        options.keep = keepValue;
        break;
      case '-s':
      case '--stats':
        options.showStats = true;
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
CSV Deduplication Script

Usage:
  ts-node src/scripts/dedupe-csv.ts <input-file> [options]

Arguments:
  <input-file>            Path ke file CSV input (wajib)

Options:
  -o, --output <path>     Path output file (default: <input>_deduped.csv)
  -c, --column <name>     Kolom untuk deduplikasi (default: id)
  -k, --keep <strategy>   Strategy: first|last (default: first)
  -s, --stats             Tampilkan statistik lengkap
  -h, --help              Tampilkan bantuan

Contoh:
  ts-node src/scripts/dedupe-csv.ts output/data.csv
  ts-node src/scripts/dedupe-csv.ts output/data.csv -o output/clean.csv
  ts-node src/scripts/dedupe-csv.ts output/data.csv -c author.userName -k last -s
`);
}

// Parse CSV dengan delimiter semicolon dan handle quoted fields
function parseCSV(content: string): ParseResult {
  const lines = content.trim().split('\n');
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header
  const headers = parseLine(lines[0]);
  
  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      rows.push(parseLine(line));
    }
  }
  
  return { headers, rows };
}

// Parse single line CSV dengan handle quotes
function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current); // Push last value
  
  return values;
}

// Find column index by name
function findColumnIndex(headers: string[], columnName: string): number {
  const index = headers.indexOf(columnName);
  if (index === -1) {
    throw new Error(`Kolom "${columnName}" tidak ditemukan. Kolom tersedia: ${headers.join(', ')}`);
  }
  return index;
}

// Deduplicate rows based on specified column
function deduplicate(
  headers: string[], 
  rows: string[][], 
  columnIndex: number, 
  keep: 'first' | 'last'
): DedupeResult {
  const seen = new Map<string, number>(); // key -> row index
  const duplicates: Map<string, number> = new Map(); // key -> count
  const uniqueRows: string[][] = [];
  
  if (keep === 'first') {
    // Keep first occurrence
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = row[columnIndex] || '';
      
      if (!seen.has(key)) {
        seen.set(key, uniqueRows.length);
        uniqueRows.push(row);
        duplicates.set(key, 1);
      } else {
        duplicates.set(key, (duplicates.get(key) || 1) + 1);
      }
    }
  } else {
    // Keep last occurrence
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const key = row[columnIndex] || '';
      
      if (!seen.has(key)) {
        seen.set(key, 0); // Will be reversed later
        uniqueRows.unshift(row); // Add to front since we're iterating backwards
        duplicates.set(key, 1);
      } else {
        duplicates.set(key, (duplicates.get(key) || 1) + 1);
      }
    }
  }
  
  // Build duplicate info
  const duplicateInfo: Array<{ key: string; count: number; kept: 'first' | 'last' }> = [];
  duplicates.forEach((count, key) => {
    if (count > 1) {
      duplicateInfo.push({ key, count, kept: keep });
    }
  });
  
  // Sort by count descending
  duplicateInfo.sort((a, b) => b.count - a.count);
  
  return {
    headers,
    rows: uniqueRows,
    totalCount: rows.length,
    uniqueCount: uniqueRows.length,
    duplicateCount: rows.length - uniqueRows.length,
    duplicates: duplicateInfo
  };
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

// Write CSV file
function writeCSV(headers: string[], rows: string[][], outputPath: string): void {
  const lines: string[] = [];
  
  // Header
  lines.push(headers.map(escapeCSV).join(';'));
  
  // Data rows
  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(';'));
  }
  
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
}

// Format number dengan thousand separator
function formatNumber(num: number): string {
  return num.toLocaleString('id-ID');
}

// Main function
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    const options = parseArgs();
    
    console.log('\n🧹 CSV Deduplication Tool');
    console.log('========================\n');
    
    // Validate input file exists
    if (!fs.existsSync(options.inputPath)) {
      throw new Error(`Input file not found: ${options.inputPath}`);
    }

    console.log(`📁 Input: ${options.inputPath}`);
    console.log(`📁 Output: ${options.outputPath}`);
    console.log(`🔑 Deduplicate by: ${options.column}`);
    console.log(`📌 Keep strategy: ${options.keep}\n`);

    // Read and parse CSV
    console.log('⏳ Reading CSV file...');
    const content = fs.readFileSync(options.inputPath, 'utf-8');
    const { headers, rows } = parseCSV(content);
    
    console.log(`✅ Loaded ${formatNumber(rows.length)} rows`);
    console.log(`📋 Columns: ${headers.join(', ')}\n`);

    // Find column index
    const columnIndex = findColumnIndex(headers, options.column);
    
    // Deduplicate
    console.log('⏳ Deduplicating...');
    const result = deduplicate(headers, rows, columnIndex, options.keep);
    
    // Write output
    console.log('💾 Writing output file...');
    writeCSV(result.headers, result.rows, options.outputPath);
    
    // Print summary
    console.log('\n📊 Summary:');
    console.log(`  📥 Total rows:     ${formatNumber(result.totalCount)}`);
    console.log(`  ✅ Unique rows:    ${formatNumber(result.uniqueCount)}`);
    console.log(`  🗑️  Duplicates:     ${formatNumber(result.duplicateCount)}`);
    console.log(`  📉 Reduction:      ${((result.duplicateCount / result.totalCount) * 100).toFixed(2)}%`);

    // Show detailed stats if requested
    if (options.showStats && result.duplicates.length > 0) {
      console.log(`\n📋 Duplicate Details (top 10):`);
      console.log(`   ${'Count'.padStart(6)} | ${options.column}`);
      console.log(`   ${'------'.padStart(6)}-${''.padStart(50, '-')}`);
      
      result.duplicates.slice(0, 10).forEach(dup => {
        const keyDisplay = dup.key.length > 45 ? dup.key.substring(0, 42) + '...' : dup.key;
        console.log(`   ${String(dup.count).padStart(6)} | ${keyDisplay}`);
      });
      
      if (result.duplicates.length > 10) {
        console.log(`   ... and ${result.duplicates.length - 10} more`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️ Duration: ${duration}ms`);
    console.log(`✨ Done! Output saved to: ${options.outputPath}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run main
main();
