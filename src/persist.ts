import {Int64LE} from "int64-buffer";
import "reflect-metadata";
import {Connection, createConnection} from "typeorm";
import {Agent} from "./entity/agent";
import {Config, ConfigType} from "./entity/config";
import {Link} from "./entity/link";

export enum CalenderType {
  UNCONFIGURED,
  EXCHANGE,
  OFFICE365,
  GOOGLE,
  MOCKUP,
}

export enum AddressFamily {
  IPv4,
  IPv6,
}

export interface ICalenderConfig {
  type: CalenderType;
  address: string;
  username: string;
  password: string;
  readonly: boolean; /* Delegation, impersonation */
}

export interface IHubConfig {
  localAuthDB: boolean;
  remoteAuthDB: string;
}

export interface IPanLConfig {
  timeout: number;
}

export interface IRoom {
  address: string;
  name: string;
}

export class Persist {
  public static async getInstance(): Promise<Persist> {
    if (Persist.instance === undefined) {
      Persist.instance = new Persist(await createConnection());
    }
    return Persist.instance;
  }

  private static instance: Persist | undefined;

  private constructor(private conn: Connection) { }

  public async stop(): Promise<void> {
    await this.conn.close();
    Persist.instance = undefined;
  }

  public async getAgentId(buf: Buffer): Promise<number> {
    const uid = new Int64LE(buf);
    let agent = await Agent.findOne({where : {uid: uid.toString()}}) as Agent;
    if (agent !== undefined) {
      return agent.id;
    } else {
      agent = new Agent();
      agent.uid = uid.toString();
      await agent.save();
      return agent.id;
    }
  }

  public async getCalenderConfig(): Promise<ICalenderConfig> {
    const v = await Config.findOne(
      {where: {id: ConfigType.CALENDER_CONFIG}}) as Config;

    if (v === undefined) {
      // TODO: set default to UNCONFIGURED
      // return {type: CalenderType.UNCONFIGURED, address: "",
      // username: "", password: "", readonly: true};
      return {
        type: CalenderType.OFFICE365,
        address: "https://outlook.office365.com/EWS/Exchange.asmx",
        username: "tan@hanhzz.onmicrosoft.com",
        password: "T@nt3sting",
        readonly: false,
      };
    } else {
      return JSON.parse(v.val);
    }
  }

  public async setCalenderConfig(cfg: ICalenderConfig): Promise<void> {
    let v = await Config.findOne(
      {where: {id: ConfigType.CALENDER_CONFIG}}) as Config;
    if (v === undefined) {
      v = new Config();
      v.id = ConfigType.CALENDER_CONFIG;
    }
    v.val = JSON.stringify(cfg);
    v.save();
    // TODO: Try connect to calender, broadcast PanL changes in caller function
  }

  public async addRoom(room: IRoom): Promise<void> {
    let link = await Link.findOne({where: {address : room.address}}) as Link;
    if (link !== undefined) {
      link.name = room.name;
      // TODO: update PanL room name
    } else {
      link = new Link();
      link.address = room.address;
      link.name = room.name;
      link.uuid = "0";
    }
    await link.save();
  }

  public async findRoom(uuid: Buffer): Promise<IRoom | undefined> {
    const val = new Int64LE(uuid);
    const link = await Link.findOne({where: {uuid: val.toString()}}) as Link;
    return link === undefined ? undefined :
      {address: link.address, name: link.name};
  }

  public async linkPanL(uuid: Buffer, email: string): Promise<void> {
    const link = await Link.findOne({where: {address: email}}) as Link;
    if (link === undefined) {
      return;
    }
    link.uuid = new Int64LE(uuid).toString();
    await link.save();
  }

  public async removePanL(uuid: Buffer): Promise<void> {
    const val = new Int64LE(uuid);
    const link = await Link.findOne({where: {uuid : val.toString()}}) as Link;
    if (link !== undefined) {
      await link.remove();
    }
  }
}
