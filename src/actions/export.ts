'use server';

import { ExportService } from '@/core/services/ExportService';

export async function getClaudeContext(): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const markdown = await ExportService.generateClaudeContextMarkdown();
    return { success: true, data: markdown };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
