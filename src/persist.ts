import {Int64LE} from "int64-buffer";
import "reflect-metadata";
import {Agent} from "./entity/hub/agent";
import {Config, ConfigType} from "./entity/hub/config";
import {Link} from "./entity/hub/link";
import {log} from "./log";

export enum CalendarType {
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

export interface ICalendarConfig {
  type: CalendarType;
  address: string;
  username: string;
  password: string;
  readonly: boolean; /* Delegation, impersonation */
}

export interface IHubConfig {
  localAuthDB: boolean;
  remoteAuthDB: string;
  expiry: number;
  meetingSubject: string;
}

export interface IPanLConfig {
  timeout: number;
}

export interface IRoom {
  address: string;
  name: string;
}

export class Persist {
  public static async getAgentId(buf: Buffer): Promise<number> {
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

  public static async getCalendarConfig(): Promise<ICalendarConfig> {
    const v = await Config.findOne(
      {where: {id: ConfigType.CALENDAR_CONFIG}}) as Config;

    if (v === undefined) {
      // TODO: set default to UNCONFIGURED
      // return {type: CalendarType.UNCONFIGURED, address: "",
      // username: "", password: "", readonly: true};
      return {
        type: CalendarType.MOCKUP,
        address: "https://outlook.office365.com/EWS/Exchange.asmx",
        username: "tan@hanhzz.onmicrosoft.com",
        password: "T@nt3sting",
        readonly: false,
      };
    } else {
      return JSON.parse(v.val);
    }
  }

  public static async setCalendarConfig(cfg: ICalendarConfig): Promise<void> {
    let v = await Config.findOne(
      {where: {id: ConfigType.CALENDAR_CONFIG}}) as Config;
    if (v === undefined) {
      v = new Config();
      v.id = ConfigType.CALENDAR_CONFIG;
    }
    v.val = JSON.stringify(cfg);
    v.save();
    // TODO: Try connect to calendar, broadcast PanL changes in caller function
  }

  public static async addRoom(room: IRoom): Promise<void> {
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

  public static async findRoom(uuid: Buffer): Promise<IRoom | undefined> {
    const val = new Int64LE(uuid);
    const link = await Link.findOne({where: {uuid: val.toString()}}) as Link;
    return link === undefined ? undefined :
      {address: link.address, name: link.name};
  }

  public static async findRoomUuid(address: string):
  Promise<string | undefined> {
    const link = await Link.findOne({where: {address}}) as Link;
    return link === undefined ? undefined : link.uuid;
  }

  public static async linkPanL(uuid: Buffer, email: string): Promise<void> {
    const link = await Link.findOne({where: {address: email}}) as Link;
    if (link === undefined) {
      return;
    }
    link.uuid = new Int64LE(uuid).toString();
    await link.save();
  }

  public static async removePanL(uuid: Buffer): Promise<void> {
    const val = new Int64LE(uuid);
    const link = await Link.findOne({where: {uuid : val.toString()}}) as Link;
    if (link !== undefined) {
      await link.remove();
    }
  }

  public static async getHubConfig(): Promise<IHubConfig> {
    const v = await Config.findOne(
      {where: {id: ConfigType.HUB_CONFIG}}) as Config;

    if (v === undefined) {
      // TODO: set default to UNCONFIGURED
      return {
        localAuthDB: true,
        remoteAuthDB: "abc...",
        expiry: 180,
        meetingSubject: "Meeting create by PanL70",
      };
    } else {
      return JSON.parse(v.val);
    }
  }

  public static async setHubConfig(cfg: IHubConfig): Promise<void> {
    let v = await Config.findOne(
      {where: {id: ConfigType.HUB_CONFIG}}) as Config;
    if (v === undefined) {
      v = new Config();
      v.id = ConfigType.HUB_CONFIG;
    }
    v.val = JSON.stringify(cfg);
    v.save();
  }
}
