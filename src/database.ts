import {Connection, createConnections, getConnection} from "typeorm";
import {Employee} from "./entity/auth/employee";
import {Passcode} from "./entity/auth/passcode";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export class Database {
  public static async getInstance(): Promise<Database> {
    if (!Database.instance) {
      log.verbose("Database connections created");
      Database.instance = new Database(await createConnections());
      const conn = getConnection("auth");
      Employee.useConnection(conn);
      Passcode.useConnection(conn);
      Rfid.useConnection(conn);
    } else {
      Database.instance.addRef();
    }
    return Database.instance;
  }

  private static instance: Database;

  private constructor(private conns: Connection[], private refCnt = 1) { }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      log.silly("Close database connections");
      for (const conn of this.conns) {
        log.silly("Close connection to " + conn.name);
        await conn.close();
      }
      delete Database.instance;
    }
  }

  public async dropSchemas(): Promise<void> {
    await Promise.all([
      getConnection("auth").dropDatabase(),
      getConnection().dropDatabase(),
    ]);
    await this.stop();
  }

  private addRef(): void {
    this.refCnt++;
  }
}
