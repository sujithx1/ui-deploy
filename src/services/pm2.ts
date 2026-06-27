import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class PM2Service {
  static async stop(processName: string): Promise<boolean> {
    try {
      await execPromise(`pm2 stop ${processName}`);
      return true;
    } catch (error) {
      console.error(`PM2 stop failed for ${processName}:`, error);
      return false;
    }
  }

  static async restart(processName: string): Promise<boolean> {
    try {
      await execPromise(`pm2 restart ${processName}`);
      return true;
    } catch (error) {
      console.error(`PM2 restart failed for ${processName}:`, error);
      return false;
    }
  }

  static async delete(processName: string): Promise<boolean> {
    try {
      await execPromise(`pm2 delete ${processName}`);
      return true;
    } catch (error) {
      console.error(`PM2 delete failed for ${processName}:`, error);
      return false;
    }
  }
}
