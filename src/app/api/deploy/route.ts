import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { deployments, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateApiKey } from '@/utils/auth';
import { DeploymentService } from '@/services/deployment';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projectId = request.headers.get('x-project-id');
    const version = request.headers.get('x-version') || '1.0.0';
    const commitMessage = request.headers.get('x-commit-message') || 'Manual Upload';

    if (!projectId) {
      return NextResponse.json({ error: 'Missing x-project-id header' }, { status: 400 });
    }

    // Check if project exists
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Extract file from multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded. Must submit a file field.' }, { status: 400 });
    }

    // Create a new Deployment record in DB
    const deploymentId = crypto.randomUUID();
    const logFilePath = path.join(process.env.DEPLOYS_LOG_DIR || path.join(process.cwd(), 'logs'), `${deploymentId}.log`);

    const [deployment] = await db
      .insert(deployments)
      .values({
        id: deploymentId,
        projectId,
        status: 'pending',
        version,
        commitMessage,
        logPath: logFilePath,
      })
      .returning();

    // Write file to /tmp/<deploymentId>.tar.gz
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempTarPath = `/tmp/${deploymentId}.tar.gz`;
    await fs.writeFile(tempTarPath, buffer);

    // Trigger deployment process asynchronously
    DeploymentService.startDeployment(
      deploymentId,
      project.id,
      project.deploymentPath,
      project.pm2ProcessName,
      project.port,
      project.buildFolder || 'dist',
      project.framework
    );

    return NextResponse.json(
      {
        message: 'Deployment received and scheduled.',
        deploymentId: deployment.id,
        status: deployment.status,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('Deployment receiving failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
