import {EventEmitter} from "events";
import {Cache} from "./cache";
import {EWSCalender} from "./ews";
import {log} from "./log";
import {MockupCalender} from "./mockup";
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
  subject: string;
  organizer: string;
}

export interface ITimelineRequest {
  dayOffset: number;
  lookForward: boolean;
  maxCount: number;
  startTime: number;
}

export interface ICalender {
  getTimeline(path: PanLPath, req: ITimelineRequest): Promise<ITimeline>;
  getMeetingInfo(path: PanLPath, startTime: number): Promise<IMeetingInfo>;
  createBooking(path: PanLPath, start: number, end: number): Promise<void>;
  extendMeeting(path: PanLPath, start: number, end: number): Promise<void>;
  endMeeting(path: PanLPath, start: number): Promise<void>;
  cancelMeeting(path: PanLPath, start: number): Promise<void>;
  cancelUnclaimedMeeting(path: PanLPath, start: number): Promise<void>;
}

export interface ICalenderNotification {
  onChangeNotification(
    path: PanLPath, previous: number, now: ITimelineEntry): void;
}

export class CalenderManager implements ICalenderNotification {
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

  public getTimeline(
    path: PanLPath, req: ITimelineRequest): Promise<ITimeline> {
    return this.calender.getTimeline(path, req);
  }

  public getMeetingInfo(
    path: PanLPath, startTime: number): Promise<IMeetingInfo> {
    return this.calender.getMeetingInfo(path, startTime);
  }

  public createBooking(
    path: PanLPath, start: number, end: number): Promise<void> {
    return this.calender.createBooking(path, start, end);
  }

  public extendMeeting(
    path: PanLPath, start: number, end: number): Promise<void> {
    return this.calender.extendMeeting(path, start, end);
  }

  public endMeeting(path: PanLPath, start: number): Promise<void> {
    return this.calender.endMeeting(path, start);
  }

  public cancelMeeting(path: PanLPath, start: number): Promise<void> {
    return this.calender.cancelMeeting(path, start);
  }

  public cancelUnclaimedMeeting(
    path: PanLPath, start: number): Promise<void> {
    return this.calender.cancelUnclaimedMeeting(path, start);
  }

  public onChangeNotification(
    path: PanLPath, previous: number, now: ITimelineEntry): void {
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
          this.calender = new EWSCalender(this, this.cache, config);
          break;
        case CalenderType.GOOGLE:
          throw new Error("Method not implemented.");
        case CalenderType.MOCKUP:
          this.calender = new MockupCalender(this, this.cache);
          break;
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
