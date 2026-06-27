import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

const SITES_AVAILABLE_DIR = process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available';
const SITES_ENABLED_DIR = process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled';

export class NginxService {
  /**
   * Generate the Nginx server block configuration string.
   */
  static generateConfig(subdomain: string, port: number): string {
    return `server {
    listen 80;
    server_name ${subdomain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
  }

  /**
   * Create or update the Nginx configuration file for a project subdomain.
   */
  static async configureSubdomain(subdomain: string, port: number): Promise<boolean> {
    try {
      const configContent = this.generateConfig(subdomain, port);
      const availablePath = path.join(SITES_AVAILABLE_DIR, subdomain);
      const enabledPath = path.join(SITES_ENABLED_DIR, subdomain);

      // Write config to sites-available
      if (process.env.NODE_ENV !== 'production' && !fs.existsSync(SITES_AVAILABLE_DIR)) {
        // Create folder locally if in non-production/testing mode and directories don't exist
        fs.mkdirSync(SITES_AVAILABLE_DIR, { recursive: true });
        fs.mkdirSync(SITES_ENABLED_DIR, { recursive: true });
      }

      fs.writeFileSync(availablePath, configContent, 'utf-8');

      // Create symbolic link if it doesn't exist
      if (!fs.existsSync(enabledPath)) {
        fs.symlinkSync(availablePath, enabledPath);
      }

      // Reload Nginx config
      await this.reloadNginx();
      return true;
    } catch (error) {
      console.error(`Failed to configure Nginx subdomain for ${subdomain}:`, error);
      return false;
    }
  }

  /**
   * Delete Nginx configuration files for a project subdomain.
   */
  static async deleteSubdomain(subdomain: string): Promise<boolean> {
    try {
      const availablePath = path.join(SITES_AVAILABLE_DIR, subdomain);
      const enabledPath = path.join(SITES_ENABLED_DIR, subdomain);

      if (fs.existsSync(enabledPath)) {
        fs.unlinkSync(enabledPath);
      }
      if (fs.existsSync(availablePath)) {
        fs.unlinkSync(availablePath);
      }

      await this.reloadNginx();
      return true;
    } catch (error) {
      console.error(`Failed to delete Nginx subdomain configuration for ${subdomain}:`, error);
      return false;
    }
  }

  /**
   * Reload Nginx server configuration safely.
   */
  static async reloadNginx(): Promise<boolean> {
    try {
      // Test config first, then reload
      await execPromise('sudo nginx -t');
      await execPromise('sudo systemctl reload nginx');
      return true;
    } catch (error) {
      console.warn('Nginx reload failed or sudo permissions not setup yet. Logging error:', error);
      return false;
    }
  }
}
