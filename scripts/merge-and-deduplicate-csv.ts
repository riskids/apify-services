#!/usr/bin/env ts-node

/**
 * Merge and Deduplicate CSV Script
 * 
 * Script untuk menggabungkan semua file CSV dari Google Maps scraper
 * dan menghapus duplikat berdasarkan Company name
 * 
 * Usage:
 *   npx ts-node scripts/merge-and-deduplicate-csv.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Konfigurasi
const INPUT_DIR = path.join(__dirname, '..', 'output', 'google maps', 'garage door services');
const OUTPUT_FILE = path.join(__dirname, '..', 'output', 'google maps', 'garage door services', 'merged_deduplicated.csv');

interface CSVRow {
  [key: string]: string;
}

// Parse CSV line
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

// Parse CSV file
function parseCSV(filePath: string): { headers: string[]; rows: CSVRow[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = parseLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseLine(line);
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return { headers, rows };
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

// Parse website URL to extract base domain
function extractBaseDomain(url: string): string {
  if (!url || !url.trim()) return '';
  
  try {
    // Remove protocol (http://, https://, //)
    let cleaned = url.trim().replace(/^(https?:\/\/|\/)/i, '');
    
    // Remove www. prefix
    cleaned = cleaned.replace(/^www\./i, '');
    
    // Remove query parameters (everything after ?)
    cleaned = cleaned.split('?')[0];
    
    // Remove trailing slash and path
    // Keep only the domain and TLD (e.g., garageservicevaughan.ca)
    const parts = cleaned.split('/');
    cleaned = parts[0];
    
    return cleaned.toLowerCase();
  } catch (error) {
    return '';
  }
}

// Add base domain column to each row
function addBaseDomain(rows: CSVRow[]): CSVRow[] {
  return rows.map(row => {
    const website = row['Website'] || '';
    const baseDomain = extractBaseDomain(website);
    // Replace website with base domain instead of adding new column
    return {
      ...row,
      'Website': baseDomain
    };
  });
}

// Write CSV file
function writeCSV(filePath: string, headers: string[], rows: CSVRow[]): void {
  const lines: string[] = [];
  lines.push(headers.map(escapeCSV).join(';'));
  
  for (const row of rows) {
    lines.push(headers.map(header => escapeCSV(row[header] || '')).join(';'));
  }
  
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

// Deduplicate by Company name AND Website (base domain)
function deduplicateByCompanyNameAndWebsite(rows: CSVRow[]): CSVRow[] {
  const seen = new Map<string, CSVRow>();
  
  for (const row of rows) {
    const companyName = (row['Company name'] || '').toLowerCase().trim();
    const website = (row['Website'] || '').toLowerCase().trim();
    
    // Create unique key combining company name and website
    const key = `${companyName}|||${website}`;
    
    if (companyName && !seen.has(key)) {
      seen.set(key, row);
    }
  }
  
  return Array.from(seen.values());
}

// Get all CSV files from directory
function getCSVFiles(dirPath: string): string[] {
  const files = fs.readdirSync(dirPath);
  return files
    .filter(file => file.endsWith('.csv'))
    .map(file => path.join(dirPath, file))
    .sort(); // Sort by name to ensure consistent order
}

// Main function
function main(): void {
  console.log('═══════════════════════════════════════════');
  console.log('     🔄 Merge & Deduplicate CSV Script');
  console.log('═══════════════════════════════════════════\n');

  // Check if input directory exists
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Input directory not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  // Get all CSV files
  const csvFiles = getCSVFiles(INPUT_DIR);
  
  if (csvFiles.length === 0) {
    console.error('❌ No CSV files found in input directory');
    process.exit(1);
  }

  console.log(`📂 Found ${csvFiles.length} CSV file(s) to merge:\n`);
  csvFiles.forEach((file, index) => {
    const fileName = path.basename(file);
    const stats = fs.statSync(file);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   ${index + 1}. ${fileName} (${sizeKB} KB)`);
  });
  console.log();

  // Parse and merge all CSV files
  const allRows: CSVRow[] = [];
  const allHeaders = new Set<string>();
  let totalRowsBeforeDedup = 0;

  for (const file of csvFiles) {
    console.log(`📄 Processing: ${path.basename(file)}`);
    const { headers, rows } = parseCSV(file);
    
    // Add headers
    headers.forEach(h => allHeaders.add(h));
    
    // Add rows
    allRows.push(...rows);
    totalRowsBeforeDedup += rows.length;
    console.log(`   ✅ Added ${rows.length} row(s)`);
  }

  console.log(`\n📊 Total rows before deduplication: ${totalRowsBeforeDedup}`);

  // Deduplicate by Company name AND Website
  console.log('\n🔄 Deduplicating by Company name and Website...');
  const deduplicatedRows = deduplicateByCompanyNameAndWebsite(allRows);
  const duplicatesRemoved = totalRowsBeforeDedup - deduplicatedRows.length;
  console.log(`   ✅ Removed ${duplicatesRemoved} duplicate(s)`);
  console.log(`   ✅ Remaining unique rows: ${deduplicatedRows.length}`);

  // Extract base domain from website URLs
  console.log('\n🔄 Extracting base domains from websites...');
  const rowsWithBaseDomain = addBaseDomain(deduplicatedRows);
  console.log(`   ✅ Added base domain column`);

  // Write output file
  console.log(`\n💾 Writing output file: ${OUTPUT_FILE}`);
  const headerArray = Array.from(allHeaders);
  writeCSV(OUTPUT_FILE, headerArray, rowsWithBaseDomain);

  // Get output file stats
  const outputStats = fs.statSync(OUTPUT_FILE);
  const outputSizeKB = (outputStats.size / 1024).toFixed(2);

  console.log('\n═══════════════════════════════════════════');
  console.log('     📈 SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`📁 Input files:     ${csvFiles.length}`);
  console.log(`📊 Before dedup:    ${totalRowsBeforeDedup} rows`);
  console.log(`📊 After dedup:      ${deduplicatedRows.length} rows`);
  console.log(`🗑️  Duplicates:       ${duplicatesRemoved} removed`);
  console.log(`💾 Output file:     ${path.basename(OUTPUT_FILE)}`);
  console.log(`📦 File size:       ${outputSizeKB} KB`);
  console.log('═══════════════════════════════════════════');
  console.log('\n✨ Done!\n');
}

// Run main
main();
