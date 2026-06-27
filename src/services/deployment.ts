import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { db } from '@/db';
import { deployments, logs, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

const LOGS_DIR = process.env.DEPLOYS_LOG_DIR || path.join(process.cwd(), 'logs');
const DEPLOY_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'deploy.sh');

export class DeploymentService {
  /**
   * Run the deployment process asynchronously for a specific project.
   */
  static async startDeployment(
    deploymentId: string,
    projectId: string,
    deploymentPath: string,
    pm2ProcessName: string,
    port: number,
    buildFolder: string,
    framework: string
  ): Promise<void> {
    try {
      // Ensure logs directory exists
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }

      const logFilePath = path.join(LOGS_DIR, `${deploymentId}.log`);
      const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

      // Helper function to write logs to both DB and file
      const writeLog = async (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        const timestampedMsg = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
        logStream.write(timestampedMsg);
        
        try {
          await db.insert(logs).values({
            deploymentId,
            level,
            message,
          });
        } catch (dbErr) {
          console.error('Failed to save log to database:', dbErr);
        }
      };

      // Update deployment status to active
      await db
        .update(deployments)
        .set({ status: 'active' })
        .where(eq(deployments.id, deploymentId));

      await db
        .update(projects)
        .set({ status: 'deploying' })
        .where(eq(projects.id, projectId));

      await writeLog(`Initializing deployment script execution...`);

      // Spawn the bash script
      const child = spawn('/bin/bash', [
        DEPLOY_SCRIPT_PATH,
        deploymentId,
        deploymentPath,
        pm2ProcessName,
        port.toString(),
        buildFolder,
        framework,
      ]);

      child.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          writeLog(output, 'info');
        }
      });

      child.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          writeLog(output, 'error');
        }
      });

      child.on('close', async (code) => {
        logStream.end();
        const success = code === 0;
        const finalStatus = success ? 'successful' : 'failed';
        const projectStatus = success ? 'active' : 'failed';

        await writeLog(
          `Deployment script finished with exit code ${code}. Status: ${finalStatus.toUpperCase()}`,
          success ? 'info' : 'error'
        );

        // Update DB records
        await db
          .update(deployments)
          .set({
            status: finalStatus,
            completedAt: new Date(),
          })
          .where(eq(deployments.id, deploymentId));

        await db
          .update(projects)
          .set({ status: projectStatus })
          .where(eq(projects.id, projectId));
      });

      child.on('error', async (err) => {
        logStream.end();
        await writeLog(`Failed to start deployment process: ${err.message}`, 'error');

        await db
          .update(deployments)
          .set({
            status: 'failed',
            completedAt: new Date(),
          })
          .where(eq(deployments.id, deploymentId));

        await db
          .update(projects)
          .set({ status: 'failed' })
          .where(eq(projects.id, projectId));
      });
    } catch (error: any) {
      console.error('Unhandled deployment service error:', error);
    }
  }
}
