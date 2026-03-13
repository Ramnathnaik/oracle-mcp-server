import oracledb from "oracledb";

export interface ConnectionConfig {
  connectionString: string;
  username: string;
  password: string;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
}

export class OracleConnectionManager {
  private pool: oracledb.Pool | null = null;
  private config: ConnectionConfig | null = null;

  async initialize(config: ConnectionConfig): Promise<void> {
    this.config = config;

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
      poolMin: config.poolMin ?? 1,
      poolMax: config.poolMax ?? 5,
      poolIncrement: config.poolIncrement ?? 1,
    });

    console.error(`Connected to Oracle DB: ${config.connectionString}`);
  }

  async getConnection(): Promise<oracledb.Connection> {
    if (!this.pool) {
      throw new Error(
        "Database not initialized. Call initialize() first or use connect tool."
      );
    }
    return this.pool.getConnection();
  }

  async execute<T = Record<string, unknown>>(
    sql: string,
    binds: unknown[] = [],
    options: oracledb.ExecuteOptions = {}
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
    }
  }

  getConfig(): ConnectionConfig | null {
    return this.config;
  }
}

export const connectionManager = new OracleConnectionManager();
