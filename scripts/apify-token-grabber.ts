#!/usr/bin/env ts-node

/**
 * Apify Token Grabber
 * Script untuk generate multiple Apify tokens dan menyimpannya ke file
 */

import * as fs from 'fs';
import * as path from 'path';

// Konfigurasi
const API_BASE_URL = 'http://localhost:3000';
const TOKEN_FILE = path.join(__dirname, '..', 'config', 'apify-token.txt');
const POLLING_INTERVAL_MS = 90 * 1000; // 90 detik

// Types
interface GenerateResponse {
    success: boolean;
    jobId?: string;
    status?: string;
    message?: string;
}

interface JobMetadata {
    token: string;
    email: string;
    createdAt: string;
    scrapingDuration: number;
    scrapedAt: string;
    worker: string;
    version: string;
}

interface JobData {
    title: string;
    content: string;
    metadata: JobMetadata;
    scrapedAt: string;
    url: string;
    workerType: string;
}

interface JobStatusResponse {
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'error';
    data?: JobData;
    duration?: number;
    retries?: number;
    error?: string | null;
}

interface FetchResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
}

interface MonitorResult {
    success: boolean;
    token?: string;
    email?: string;
    error?: string;
}

interface JobInfo {
    index: number;
    jobId: string;
    status: string;
}

interface SummaryResult {
    success: number;
    failed: number;
    tokens: Array<{ token: string; email: string }>;
}

// Helper: delay
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Helper: fetch dengan error handling
async function fetchWithRetry<T>(
    url: string, 
    options: RequestInit, 
    maxRetries: number = 3
): Promise<FetchResult<T>> {
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
            console.log(`  ⚠️  Attempt ${attempt} failed, retrying...`);
            await delay(1000 * attempt);
        }
    }
    return { success: false, error: 'Max retries reached' };
}

// Generate single token (create job)
async function generateToken(): Promise<FetchResult<GenerateResponse>> {
    const url = `${API_BASE_URL}/api/apify/generate`;
    const options: RequestInit = {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };

    return await fetchWithRetry<GenerateResponse>(url, options);
}

// Check job status
async function checkJobStatus(jobId: string): Promise<FetchResult<JobStatusResponse>> {
    const url = `${API_BASE_URL}/api/scrape/${jobId}`;
    const options: RequestInit = {
        method: 'GET',
        headers: {
            'accept': 'application/json'
        }
    };

    return await fetchWithRetry<JobStatusResponse>(url, options);
}

// Append token to file
function saveTokenToFile(token: string): boolean {
    try {
        // Read existing content
        let content = '';
        if (fs.existsSync(TOKEN_FILE)) {
            content = fs.readFileSync(TOKEN_FILE, 'utf8');
        }

        // Check if token already exists
        const lines = content.split('\n');
        if (lines.some(line => line.trim() === token)) {
            console.log(`  ⚠️  Token already exists in file, skipping`);
            return false;
        }

        // Append token
        const newContent = content.endsWith('\n') || content === '' 
            ? content + token + '\n' 
            : content + '\n' + token + '\n';
        
        fs.writeFileSync(TOKEN_FILE, newContent);
        return true;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Error saving token: ${errorMsg}`);
        return false;
    }
}

// Check single job status (for batch monitoring)
async function checkSingleJob(job: JobInfo): Promise<MonitorResult & { jobId: string; index: number; done: boolean }> {
    const result = await checkJobStatus(job.jobId);
    
    if (!result.success) {
        console.log(`  ❌ Job ${job.index}: Failed to check status - ${result.error || 'Unknown error'}`);
        return { success: false, error: result.error, jobId: job.jobId, index: job.index, done: false };
    }

    const data = result.data!;
    const status = data.status;

    if (status === 'completed') {
        const token = data.data?.metadata?.token;
        const email = data.data?.metadata?.email;
        
        if (token) {
            console.log(`  ✅ Job ${job.index}: Completed! Email: ${email || 'N/A'}`);
            const saved = saveTokenToFile(token);
            if (saved) {
                console.log(`     💾 Token saved`);
            }
            return { success: true, token, email, jobId: job.jobId, index: job.index, done: true };
        } else {
            console.log(`  ⚠️  Job ${job.index}: Completed but no token found`);
            return { success: false, error: 'No token in response', jobId: job.jobId, index: job.index, done: true };
        }
    } else if (status === 'failed' || status === 'error') {
        console.log(`  ❌ Job ${job.index}: Failed - ${data.error || 'Unknown error'}`);
        return { success: false, error: data.error || 'Job failed', jobId: job.jobId, index: job.index, done: true };
    } else {
        console.log(`  ⏳ Job ${job.index}: Status = ${status}`);
        return { success: false, jobId: job.jobId, index: job.index, done: false };
    }
}

// Monitor all jobs in parallel every 90 seconds
async function monitorAllJobs(jobs: JobInfo[]): Promise<SummaryResult> {
    const results: SummaryResult = {
        success: 0,
        failed: 0,
        tokens: []
    };
    
    const pendingJobs = [...jobs];
    let checkRound = 0;
    const maxRounds = 40; // Max 40 * 90 detik = 60 menit

    while (pendingJobs.length > 0 && checkRound < maxRounds) {
        checkRound++;
        console.log(`\n📊 Check Round #${checkRound} - ${pendingJobs.length} job(s) pending`);
        console.log(`   Waiting 90 seconds...\n`);
        
        await delay(POLLING_INTERVAL_MS);
        
        // Check all pending jobs in parallel
        const checkResults = await Promise.all(
            pendingJobs.map(job => checkSingleJob(job))
        );
        
        // Process results and remove completed jobs
        const completedIndices = new Set<number>();
        
        for (const res of checkResults) {
            if (res.done) {
                completedIndices.add(res.index);
                if (res.success && res.token) {
                    results.success++;
                    results.tokens.push({ token: res.token, email: res.email || 'N/A' });
                } else {
                    results.failed++;
                }
            }
        }
        
        // Remove completed jobs from pending list
        for (let i = pendingJobs.length - 1; i >= 0; i--) {
            if (completedIndices.has(pendingJobs[i].index)) {
                pendingJobs.splice(i, 1);
            }
        }
    }

    if (pendingJobs.length > 0) {
        console.log(`\n⏰ Timeout: ${pendingJobs.length} job(s) did not complete in time`);
        results.failed += pendingJobs.length;
    }

    return results;
}

// Main function
async function main(): Promise<void> {
    // Parse CLI argument
    const totalTokens = parseInt(process.argv[2], 10);
    
    if (isNaN(totalTokens) || totalTokens < 1) {
        console.error('❌ Usage: npx ts-node scripts/apify-token-grabber.ts <total_tokens>');
        console.error('   Example: npx ts-node scripts/apify-token-grabber.ts 5');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════');
    console.log('     🚀 Apify Token Grabber');
    console.log('═══════════════════════════════════════════');
    console.log(`📌 Target: ${totalTokens} token(s)`);
    console.log(`📁 Output: ${TOKEN_FILE}`);
    console.log(`⏱️  Polling Interval: 90 seconds`);
    console.log('═══════════════════════════════════════════\n');

    // Step 1: Create jobs
    console.log('📤 Step 1: Creating token generation jobs...\n');
    const jobs: JobInfo[] = [];
    
    for (let i = 1; i <= totalTokens; i++) {
        console.log(`🔄 Creating job ${i}/${totalTokens}...`);
        const result = await generateToken();
        
        if (result.success && result.data?.jobId) {
            console.log(`  ✅ Job created: ${result.data.jobId}`);
            jobs.push({
                index: i,
                jobId: result.data.jobId,
                status: 'pending'
            });
        } else {
            console.log(`  ❌ Failed to create job: ${result.error || result.data?.message || 'Unknown error'}`);
        }
        
        // Small delay between requests
        await delay(500);
    }

    console.log(`\n✅ ${jobs.length} job(s) created successfully`);

    if (jobs.length === 0) {
        console.error('\n❌ No jobs were created. Exiting.');
        process.exit(1);
    }

    // Step 2: Monitor all jobs
    console.log('\n📊 Step 2: Monitoring all jobs every 90 seconds...\n');
    
    const results = await monitorAllJobs(jobs);

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('     📈 SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`✅ Successful: ${results.success}`);
    console.log(`❌ Failed:     ${results.failed}`);
    console.log(`📊 Total:      ${jobs.length}`);
    console.log('═══════════════════════════════════════════');
    
    if (results.tokens.length > 0) {
        console.log('\n📝 Tokens generated:');
        results.tokens.forEach((t, i) => {
            console.log(`   ${i + 1}. ${t.token.substring(0, 30)}... (${t.email})`);
        });
    }
    
    console.log(`\n💾 All tokens saved to: ${TOKEN_FILE}`);
    console.log('\n✨ Done!\n');
}

// Run main
main().catch(error => {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Fatal error:', errorMsg);
    process.exit(1);
});
