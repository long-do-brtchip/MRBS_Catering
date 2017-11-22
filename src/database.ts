import {Connection, createConnections, getConnection} from "typeorm";
import {log} from "./log";

export class Database {
  public static async getInstance(): Promise<Database> {
    if (Database.instance === undefined) {
      Database.instance = new Database(await createConnections());
    } else {
      Database.instance.addRef();
    }
    return Database.instance;
  }

  private static instance: Database | undefined;

  private constructor(private conns: Connection[], private refCnt = 1) { }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      log.silly("Close database connection");
      for (const conn of this.conns) {
        await conn.close();
      }
      Database.instance = undefined;
    }
  }

  private addRef(): void {
    this.refCnt++;
  }
}
