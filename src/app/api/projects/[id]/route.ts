import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NginxService } from '@/services/nginx';
import { PM2Service } from '@/services/pm2';
import { validateApiKey } from '@/utils/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(projects)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    // Reconfigure Nginx if subdomain or port changes
    if (
      (body.subdomain && body.subdomain !== existing.subdomain) ||
      (body.port && parseInt(body.port, 10) !== existing.port)
    ) {
      const port = body.port ? parseInt(body.port, 10) : existing.port;
      const subdomain = body.subdomain || existing.subdomain;
      
      await NginxService.deleteSubdomain(existing.subdomain);
      await NginxService.configureSubdomain(subdomain, port);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Delete Nginx config
    await NginxService.deleteSubdomain(project.subdomain);

    // 2. Stop and delete PM2 process
    if (project.framework !== 'static') {
      await PM2Service.delete(project.pm2ProcessName);
    }

    // 3. Remove project from database (cascades will delete deployments and logs)
    await db.delete(projects).where(eq(projects.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete project failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
