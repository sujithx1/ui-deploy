import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { NginxService } from '@/services/nginx';
import { validateApiKey } from '@/utils/auth';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const list = await db.select().from(projects);
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, subdomain, port, framework, buildFolder, deploymentPath } = body;

    if (!name || !subdomain || !port || !framework) {
      return NextResponse.json(
        { error: 'Name, subdomain, port, and framework are required fields.' },
        { status: 400 }
      );
    }

    // Set defaults if not provided
    const pm2ProcessName = body.pm2ProcessName || `app-${subdomain.replace(/\./g, '-')}`;
    const targetDeploymentPath =
      deploymentPath || `/home/mdspl-sujith/sujith/apps/${pm2ProcessName}`;
    const targetBuildFolder = buildFolder || (framework === 'nextjs' ? '.next' : 'dist');

    // Save project in database
    const [project] = await db
      .insert(projects)
      .values({
        name,
        subdomain,
        port: parseInt(port, 10),
        framework,
        deploymentPath: targetDeploymentPath,
        buildFolder: targetBuildFolder,
        pm2ProcessName,
        status: 'idle',
      })
      .returning();

    // Generate Nginx configuration and enable it
    const nginxSuccess = await NginxService.configureSubdomain(subdomain, parseInt(port, 10));
    if (!nginxSuccess) {
      console.warn(`Nginx auto-configuration failed or partially succeeded for ${subdomain}`);
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error('Project creation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
