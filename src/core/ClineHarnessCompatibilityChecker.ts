/**
 * ClineHarnessCompatibilityChecker
 * 
 * Checks Node.js version compatibility for @cline/sdk
 * @cline/sdk requires Node.js >= 22 (as specified in package.json engines field)
 */

export interface CompatibilityCheckResult {
  isCompatible: boolean;
  nodeVersion: string;
  requiredVersion: string;
  reason?: string;
  canUseLegacy: boolean;
}

export class ClineHarnessCompatibilityChecker {
  private static readonly REQUIRED_NODE_VERSION = '22.0.0';
  private static readonly MIN_SUPPORTED_VERSION = '18.0.0';

  /**
   * Check if current environment is compatible with Cline SDK
   */
  static check(): CompatibilityCheckResult {
    const nodeVersion = process.version;
    const requiredVersion = this.REQUIRED_NODE_VERSION;

    try {
      const currentMajor = this.extractMajorVersion(nodeVersion);
      const requiredMajor = this.extractMajorVersion(requiredVersion);

      const isCompatible = currentMajor >= requiredMajor;
      const canUseLegacy = currentMajor >= this.extractMajorVersion(this.MIN_SUPPORTED_VERSION);

      return {
        isCompatible,
        nodeVersion,
        requiredVersion,
        reason: isCompatible 
          ? undefined 
          : `Node.js ${nodeVersion} is below required version ${requiredVersion}`,
        canUseLegacy,
      };
    } catch (error) {
      return {
        isCompatible: false,
        nodeVersion,
        requiredVersion,
        reason: `Failed to parse Node.js version: ${error}`,
        canUseLegacy: true, // Assume legacy works if we can't determine
      };
    }
  }

  /**
   * Extract major version number from version string (e.g., "v18.0.0" -> 18)
   */
  private static extractMajorVersion(version: string): number {
    const match = version.match(/^v?(\d+)/);
    if (!match) {
      throw new Error(`Invalid version string: ${version}`);
    }
    return parseInt(match[1], 10);
  }

  /**
   * Get recommendation for execution backend
   */
  static getBackendRecommendation(): 'cline' | 'legacy' {
    const check = this.check();
    return check.isCompatible ? 'cline' : 'legacy';
  }

  /**
   * Log compatibility check result
   */
  static logCheck(): void {
    const result = this.check();
    console.log('[ClineHarnessCompatibilityChecker] Compatibility check:');
    console.log(`  Node.js version: ${result.nodeVersion}`);
    console.log(`  Required version: ${result.requiredVersion}`);
    console.log(`  Compatible: ${result.isCompatible}`);
    console.log(`  Can use legacy: ${result.canUseLegacy}`);
    if (result.reason) {
      console.log(`  Reason: ${result.reason}`);
    }
    console.log(`  Recommended backend: ${this.getBackendRecommendation()}`);
  }
}
