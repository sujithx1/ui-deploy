import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deployments, logs } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { validateApiKey } from '@/utils/auth';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');

    if (!deploymentId) {
      return NextResponse.json({ error: 'Missing deploymentId query parameter' }, { status: 400 });
    }

    // Fetch DB logs
    const dbLogs = await db
      .select()
      .from(logs)
      .where(eq(logs.deploymentId, deploymentId))
      .orderBy(asc(logs.timestamp));

    // Try to read raw file logs
    let rawContent = '';
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId));

    if (deployment && deployment.logPath) {
      try {
        rawContent = await fs.readFile(deployment.logPath, 'utf-8');
      } catch (fileErr) {
        // If file not exists or deleted, fallback to joining DB logs
        rawContent = dbLogs.map((l) => `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
      }
    }

    return NextResponse.json({
      logs: dbLogs,
      rawContent,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
