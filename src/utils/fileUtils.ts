/**
 * File system utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export class FileUtils {
  /**
   * Ensure directory exists
   */
  public static async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Write file with automatic directory creation
   */
  public static async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Read file content
   */
  public static async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * Check if file exists
   */
  public static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  public static async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * List files in directory
   */
  public static async listFiles(dirPath: string, pattern?: string): Promise<string[]> {
    const files = await fs.readdir(dirPath);
    
    if (!pattern) {
      return files.map(f => path.join(dirPath, f));
    }

    const regex = new RegExp(pattern);
    return files
      .filter(f => regex.test(f))
      .map(f => path.join(dirPath, f));
  }

  /**
   * Read JSON file
   */
  public static async readJson<T>(filePath: string): Promise<T> {
    const content = await this.readFile(filePath);
    return JSON.parse(content) as T;
  }

  /**
   * Write JSON file
   */
  public static async writeJson(filePath: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.writeFile(filePath, content);
  }

  /**
   * Read lines from file (filtering empty lines and comments)
   */
  public static async readLines(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath);
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
  }
}
