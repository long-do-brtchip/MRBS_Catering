import {Int64LE} from "int64-buffer";
import "reflect-metadata";
import {Agent} from "./entity/hub/agent";
import {Config, ConfigType} from "./entity/hub/config";
import {Panl} from "./entity/hub/panl";
import {Room} from "./entity/hub/room";
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

export enum LANG_ID {
  EN,
  CN,
  JP,
  KR,
}

export interface ICalendarConfig {
  type: CalendarType;
  address: string;
  username: string;
  password: string;
  readonly: boolean; /* Delegation, impersonation */
}

export interface IMeetingControlUnit {
  extendMeeting: boolean;
  claimMeeting: boolean;
  cancelMeeting: boolean;
  endMeeting: boolean;
  onSpotBooking: boolean;
  featureBooking: boolean;
}

export interface IHubConfig {
  expiry: number;
  meetingSubject: string;
}

export interface IPanlConfig {
  timeout: number;
  militaryTimeFormat: boolean;
  language: LANG_ID;
  featureDisabled: IMeetingControlUnit;
  authAllowPasscode: IMeetingControlUnit;
  authAllowRFID: IMeetingControlUnit;
}

export class Persist {
  public static async getAgentId(buf: Buffer): Promise<number> {
    const uid = new Int64LE(buf);
    let agent = await Agent.findOne({where : {uid: uid.toString()}});
    if (agent !== undefined) {
      return agent.id;
    } else {
      agent = new Agent();
      agent.uid = uid.toString();
      await agent.save();
      return agent.id;
    }
  }

  public static async addRoom(address: string, name: string): Promise<void> {
    let room = await Room.findOne({where: {address}});

    if (room === undefined) {
      room = new Room(address, name);
    } else {
      room.name = name;
    }
    await room.save();
  }

  public static async findRoom(email: string): Promise<Room | undefined> {
    return Room.findOne({where: {address: email}});
  }

  public static async findPanlRoom(uuid: Buffer): Promise<Room | undefined> {
    return Panl.findRoom((new Int64LE(uuid)).toString());
  }

  public static async linkPanL(uuid: Buffer, room: Room): Promise<void> {
    const val = new Int64LE(uuid);
    let panl = await Panl.findOne({where: {uuid: val.toString()}});

    if (panl === undefined) {
      panl = new Panl();
      panl.uuid = new Int64LE(uuid).toString();
      panl.room = room;
    } else {
      panl.room = room;
    }
    await panl.save();
  }

  public static async removePanL(uuid: Buffer): Promise<void> {
    const val = new Int64LE(uuid);
    const panl = await Panl.findOne({where: {uuid : val.toString()}});
    if (panl !== undefined) {
      await panl.remove();
    }
  }

  public static async getCalendarConfig(): Promise<ICalendarConfig> {
    return Persist.getConfig<ICalendarConfig>(ConfigType.CALENDAR_CONFIG, {
      // TODO: set default to UNCONFIGURED
      type: CalendarType.OFFICE365,
      address: "https://outlook.office365.com/EWS/Exchange.asmx",
      username: "tan@hanhzz.onmicrosoft.com",
      password: "T@nt3sting",
      readonly: false,
    });
  }

  public static async getHubConfig(): Promise<IHubConfig> {
    return Persist.getConfig<IHubConfig>(ConfigType.HUB_CONFIG, {
      expiry: 180,
      meetingSubject: "Meeting create by PanL70",
      });
  }

  public static async getPanlConfig(): Promise<IPanlConfig> {
    return Persist.getConfig<IPanlConfig>(ConfigType.PANL_CONFIG, {
      timeout: 10,
      militaryTimeFormat: false,
      language: LANG_ID.EN,
      featureDisabled: {
        extendMeeting: false,
        claimMeeting: false,
        cancelMeeting: true,
        endMeeting: false,
        onSpotBooking: false,
        featureBooking: true,
      },
      authAllowPasscode: {
        extendMeeting: true,
        claimMeeting: true,
        cancelMeeting: true,
        endMeeting: true,
        onSpotBooking: true,
        featureBooking: true,
      },
      authAllowRFID: {
        extendMeeting: true,
        claimMeeting: true,
        cancelMeeting: true,
        endMeeting: true,
        onSpotBooking: true,
        featureBooking: true,
      }});
  }

  public static async setCalendarConfig(cfg: ICalendarConfig): Promise<void> {
    await Persist.setConfig<ICalendarConfig>(ConfigType.CALENDAR_CONFIG, cfg);
    // TODO: Try connect to calendar, broadcast PanL changes in caller function
  }

  public static async setHubConfig(cfg: IHubConfig): Promise<void> {
    await Persist.setConfig<IHubConfig>(ConfigType.HUB_CONFIG, cfg);
  }

  public static async setPanlConfig(cfg: IPanlConfig): Promise<void> {
    await Persist.setConfig<IPanlConfig>(ConfigType.PANL_CONFIG, cfg);
  }

  private static async getConfig<T>(id: number, def: T): Promise<T> {
    const v = await Config.findOne({where: {id}});

    if (v === undefined) {
      return def;
    } else {
      return JSON.parse(v.val);
    }
  }

  private static async setConfig<T>(id: number, cfg: T): Promise<void> {
    let v = await Config.findOne({where: {id}});
    if (v === undefined) {
      v = new Config();
      v.id = id;
    }
    v.val = JSON.stringify(cfg);
    await v.save();
  }
}
