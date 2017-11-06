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

export interface IMeetingInfo {
  subject: string;
  organizer: string;
}

export interface ITimePoint {
  dayOffset: number;
  minutesOfDay: number;
}

export interface ITimelineRequest {
  id: ITimePoint;
  lookForward: boolean;
  maxCount: number;
}

export interface ICalender {
  getTimeline(path: PanLPath, req: ITimelineRequest): Promise<ITimelineEntry[]>;
  getMeetingInfo(path: PanLPath, id: ITimePoint): Promise<IMeetingInfo>;
  createBooking(path: PanLPath, id: ITimePoint, duration: number):
    Promise<void>;
  extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
    Promise<void>;
  endMeeting(path: PanLPath, id: ITimePoint): Promise<void>;
  cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void>;
  cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint): Promise<void>;
}

export interface ICalenderNotification {
  onExtendNotification(path: PanLPath, id: ITimePoint, duration: number): void;
  onAddNotification(path: PanLPath, id: ITimePoint, duration: number): void;
  onDeleteNotification(path: PanLPath, id: ITimePoint): void;
  onUpdateNotification(path: PanLPath, id: ITimePoint): void;
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

  public getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[]> {
    this.cache.setDayOffset(path, req.id.dayOffset);
    return this.calender.getTimeline(path, req);
  }

  public async getMeetingInfo(path: PanLPath, minutesOfDay: number):
  Promise<IMeetingInfo> {
    const dayOffset: number = await this.cache.getDayOffset(path);
    return this.calender.getMeetingInfo(path, { dayOffset, minutesOfDay });
  }

  public createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    return this.calender.createBooking(path, id, duration);
  }

  public extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    return this.calender.extendMeeting(path, id, duration);
  }

  public endMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    return this.calender.endMeeting(path, id);
  }

  public cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    return this.calender.cancelMeeting(path, id);
  }

  public cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    return this.calender.cancelUnclaimedMeeting(path, id);
  }

  public onAddNotification(path: PanLPath, id: ITimePoint, duration: number):
  void {
    this.event.emit("add", path, id, duration);
  }

  public onExtendNotification(path: PanLPath, id: ITimePoint, duration: number):
  void {
    this.event.emit("extend", path, id, duration);
  }

  public onDeleteNotification(path: PanLPath, id: ITimePoint): void {
    this.event.emit("delete", path, id);
  }

  public onUpdateNotification(path: PanLPath, id: ITimePoint): void {
    this.event.emit("update", path, id);
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
