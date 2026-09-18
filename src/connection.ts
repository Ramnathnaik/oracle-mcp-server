import oracledb from "oracledb";

export interface ConnectionConfig {
  connectionString: string;
  username: string;
  password: string;
  poolMax?: number;
}

export class OracleConnectionManager {
  private pool: oracledb.Pool | null = null;
  private config: ConnectionConfig | null = null;

  async initialize(config: ConnectionConfig): Promise<void> {
    // Close any existing pool cleanly before creating a new one
    await this.close();

    // Enable thick mode if Oracle Client is available, otherwise use thin mode
    try {
      oracledb.initOracleClient();
      console.error("Oracle thick mode initialized");
    } catch {
      console.error("Oracle Client not found, using thin mode");
    }

    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.CLOB];

    this.pool = await oracledb.createPool({
      user: config.username,
      password: config.password,
      connectString: config.connectionString,

      // ── CRITICAL: poolMin MUST be 0 ──────────────────────────────────────
      // poolMin > 0 keeps "warm" connections alive in the background. When those
      // connections drop (idle timeout, DB restart, etc.) the pool's internal
      // health-check thread automatically retries authentication with the
      // credentials that were baked in at pool creation time.
      // If the password has since been rotated, every background retry counts
      // as a failed login against Oracle's FAILED_LOGIN_ATTEMPTS profile limit,
      // which will lock the account even when nobody is actively using the server.
      // poolMin: 0 means no connections are held open when the server is idle.
      poolMin: 0,

      poolMax: config.poolMax ?? 5,

      // Connections are created one at a time as demand grows.
      poolIncrement: 1,

      // ── Disable background pinging ───────────────────────────────────────
      // poolPingInterval controls how often idle connections are validated with
      // a lightweight round-trip to the DB. Setting it to -1 disables pinging
      // entirely. Combined with poolMin: 0, this means no background traffic
      // is ever generated toward Oracle while the server is idle.
      poolPingInterval: -1,
    });

    // Validate that the credentials actually work before declaring success.
    // This surfaces a wrong password immediately (at connect time) rather than
    // letting it fail silently later and accumulate failed-login strikes.
    const testConn = await this.pool.getConnection();
    await testConn.close();

    this.config = config;
    console.error(`Connected to Oracle DB: ${config.connectionString}`);
  }

  async getConnection(): Promise<oracledb.Connection> {
    if (!this.pool) {
      throw new Error(
        "Database not initialized. Call initialize() first or use the oracle_connect tool.",
      );
    }
    return this.pool.getConnection();
  }

  async execute<T = Record<string, unknown>>(
    sql: string,
    binds: unknown[] = [],
    options: oracledb.ExecuteOptions = {},
  ): Promise<T[]> {
    const conn = await this.getConnection();
    try {
      const result = await conn.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        ...options,
      });
      return (result.rows as T[]) ?? [];
    } finally {
      await conn.close();
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const conn = await this.pool.getConnection();
      await conn.close();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close(10);
      this.pool = null;
      this.config = null;
    }
  }

  getConfig(): ConnectionConfig | null {
    return this.config;
  }
}

export const connectionManager = new OracleConnectionManager();
