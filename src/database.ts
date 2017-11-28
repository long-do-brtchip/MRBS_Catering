import {Connection, createConnections, getConnection,
        Repository} from "typeorm";
import {Employee} from "./entity/auth/employee";
import {PassCode} from "./entity/auth/passcode";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export class Database {
  public static repoPassCode: any;
  public static repoRfid: any;

  public static async getInstance(): Promise<Database> {
    if (Database.instance === undefined) {
      log.verbose("Database connections created");
      Database.instance = new Database(await createConnections());
      const conn = getConnection("auth");
      Employee.useConnection(conn);
      PassCode.useConnection(conn);
      Rfid.useConnection(conn);
      this.repoPassCode = conn.getRepository(PassCode);
      this.repoRfid = conn.getRepository(Rfid);
      } else {
      Database.instance.addRef();
    }
    return Database.instance;
  }

  private static instance: Database | undefined;

  private constructor(private conns: Connection[], private refCnt = 1) { }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      log.silly("Close database connections");
      for (const conn of this.conns) {
        log.silly("Close connection to " + conn.name);
        await conn.close();
      }
      Database.instance = undefined;
    }
  }

  private addRef(): void {
    this.refCnt++;
  }
}
