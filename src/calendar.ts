import {EventEmitter} from "events";
import {Cache} from "./cache";
import {EWSCalendar} from "./ews";
import {log} from "./log";
import {MockupCalendar} from "./mockup";
import {PanLPath} from "./path";
import {CalendarType, Persist} from "./persist";

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

export interface ICalendar {
  getTimeline(path: PanLPath, dayOffset: number): Promise<boolean>;
  createBooking(path: PanLPath, id: ITimePoint, duration: number):
    Promise<void>;
  extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
    Promise<void>;
  endMeeting(path: PanLPath, id: ITimePoint): Promise<void>;
  cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void>;
  cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint): Promise<void>;
}

export interface ICalendarNotification {
  onExtendNotification(path: PanLPath, id: ITimePoint, duration: number): void;
  onAddNotification(path: PanLPath, id: ITimePoint, duration: number): void;
  onDeleteNotification(path: PanLPath, id: ITimePoint): void;
  onUpdateNotification(path: PanLPath, id: ITimePoint): void;
}

export class CalendarManager implements ICalendarNotification {
  private calendar: ICalendar;
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

  public async getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[]> {
    this.cache.setDayOffset(path, req.id.dayOffset);
    let entries = await this.cache.getTimeline(path, req);
    if (entries === undefined) {
      // get timeline from External server and cached
      const isHave = await this.calendar.getTimeline(path, req.id.dayOffset);
      // get in cache again
      entries = isHave ? (await this.cache.getTimeline(path, req) || []) : [];
    }

    return entries;
  }

  public async getMeetingInfo(path: PanLPath, minutesOfDay: number):
  Promise<IMeetingInfo> {
    const dayOffset: number = await this.cache.getDayOffset(path);
    const id: ITimePoint = { dayOffset, minutesOfDay };
    return this.cache.getMeetingInfo(path, id);
  }

  public createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    return this.calendar.createBooking(path, id, duration);
  }

  public extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void> {
    return this.calendar.extendMeeting(path, id, duration);
  }

  public endMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    return this.calendar.endMeeting(path, id);
  }

  public cancelMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    return this.calendar.cancelMeeting(path, id);
  }

  public cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint): Promise<void> {
    return this.calendar.cancelUnclaimedMeeting(path, id);
  }

  public onAddNotification(path: PanLPath, id: ITimePoint, duration: number):
  void {
    this.cache.setTimelineEntry(path, id, duration);
    this.event.emit("add", path, id, duration);
  }

  public onExtendNotification(path: PanLPath, id: ITimePoint, duration: number):
  void {
    this.cache.setTimelineEntry(path, id, duration);
    this.event.emit("extend", path, id, duration);
  }

  public onDeleteNotification(path: PanLPath, id: ITimePoint): void {
    this.cache.removeTimelineEntry(path, id);
    this.cache.removeMeetingInfo(path, id);
    this.event.emit("delete", path, id);
  }

  public onUpdateNotification(path: PanLPath, id: ITimePoint): void {
    this.event.emit("update", path, id);
  }

  public async connect(): Promise<void> {
    log.info("Start Calendar Manager...");

    try {
      const config = await this.persist.getCalendarConfig();
      const configHub = await this.persist.getHubConfig();

      switch (config.type) {
        case CalendarType.UNCONFIGURED:
          log.info("Calendar is not configured.");
          return;
        case CalendarType.EXCHANGE:
        case CalendarType.OFFICE365:
          this.calendar = new EWSCalendar(this, this.cache, config, configHub);
          break;
        case CalendarType.GOOGLE:
          throw new Error("Method not implemented.");
        case CalendarType.MOCKUP:
          this.calendar = new MockupCalendar(this, this.cache);
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
