import {EventEmitter} from "events";
import {Cache} from "./cache";
import {EWSCalender} from "./ews";
import {log} from "./log";
import {PanLPath} from "./path";
import {CalenderType, Persist} from "./persist";

export interface ITimelineEntry {
  start: number;
  end: number;
}

export interface ITimeline {
  dayOffset: number;
  entries: ITimelineEntry[];
}

export interface IMeetingInfo {
  subjectLength: number;
  organizerLength: number;
  utf8: string;
}

export interface ITimelineRequest {
  dayOffset: number;
  lookForward: boolean;
  maxCount: number;
  startTime: number;
}

export interface ICalender {
  getTimeline(address: string, req: ITimelineRequest): Promise<ITimeline>;
}

export class CalenderManager {
  private calender: ICalender;
  private isConnected: boolean;

  constructor(
    private cache: Cache,
    private persist: Persist,
    private event: EventEmitter) {
    if (this.event === undefined ||
      this.cache === undefined || this.persist === undefined) {
      throw(new Error("Invalid parameter"));
    }
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public async getTimeline(
    path: PanLPath, req: ITimelineRequest): Promise<ITimeline> {
      return this.calender.getTimeline(
        await this.cache.getRoomAddress(path), req);
  }

  public async getMeetingInfo(
    path: PanLPath, startTime: number): Promise<IMeetingInfo> {
    throw new Error("Method getMeetingInfo not implemented.");
  }

  public async createBooking(
    path: PanLPath, start: number, end: number): Promise<void> {
    throw new Error("Method getMeetingInfo not implemented.");
  }

  public async extendMeeting(
    path: PanLPath, start: number, end: number): Promise<void> {
    throw new Error("Method getMeetingInfo not implemented.");
  }

  public async endMeeting(path: PanLPath, start: number): Promise<void> {
    throw new Error("Method getMeetingInfo not implemented.");
  }

  public async cancelMeeting(path: PanLPath, start: number): Promise<void> {
    throw new Error("Method getMeetingInfo not implemented.");
  }

  public async cancelUnclaimedMeeting(
    path: PanLPath, start: number): Promise<void> {
    /* Requires no */
    throw new Error("Method getMeetingInfo not implemented.");
  }

  public async onChangeNotification(
    path: PanLPath, previous: number, now: ITimelineEntry): Promise<void> {
    // Process calender updates, should be called from calender
    // TODO: update cache
    this.event.emit("update", path, previous, now);
  }

  public async connect(): Promise<void> {
    log.info("Start Calender Manager...");

    try {
      const config = await this.persist.getCalenderConfig();

      switch (config.type) {
        case CalenderType.UNCONFIGURED:
          log.info("Calender is not configured.");
          return;
        case CalenderType.EXCHANGE:
        case CalenderType.OFFICE365:
          this.calender = new EWSCalender(config);
          break;
        case CalenderType.GOOGLE:
          throw new Error("Method not implemented.");
        case CalenderType.MOCKUP:
          throw new Error("Method not implemented.");
      }
    } catch (err) {
      this.event.emit("calMgrError", err);
      return;
    }
    this.isConnected = true;
    this.event.emit("calMgrReady");
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
}
