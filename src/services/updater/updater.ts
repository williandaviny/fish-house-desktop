export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  body?: string;
  downloadUrl?: string;
  publishedAt?: string;
}

export const APP_VERSION = '1.0.0';
const GITHUB_REPO = 'williandaviny/fish-house-desktop';

export class UpdaterService {
  public static getCurrentVersion(): string {
    return APP_VERSION;
  }

  public static async checkForUpdates(): Promise<UpdateInfo> {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      });

      if (!res.ok) {
        return { hasUpdate: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION };
      }

      const data = await res.json();
      const latestTag = (data.tag_name || '').replace(/^v/, '').trim();
      const current = APP_VERSION.replace(/^v/, '').trim();
      const hasUpdate = this.compareVersions(latestTag, current) > 0;

      const exeAsset = data.assets?.find((a: any) =>
        a.name.endsWith('.exe') || a.name.endsWith('.msi')
      );

      return {
        hasUpdate,
        currentVersion: APP_VERSION,
        latestVersion: latestTag || APP_VERSION,
        body: data.body || 'Nova versão com melhorias e correções.',
        downloadUrl: exeAsset?.browser_download_url || data.html_url,
        publishedAt: data.published_at
      };
    } catch (err) {
      return { hasUpdate: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION };
    }
  }

  private static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}
