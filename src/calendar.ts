import {Cache} from "./cache";
import {Database} from "./database";
import {EWSCalendar} from "./ews";
import {log} from "./log";
import {MockupCalendar} from "./mockup";
import {PanLPath} from "./path";
import {CalendarType, Persist} from "./persist";
import {ICalendarEvent} from "./service";

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
  onExtendNotification(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void>;
  onAddNotification(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void>;
  onDeleteNotification(path: PanLPath, id: ITimePoint): Promise<void>;
  onUpdateNotification(path: PanLPath, id: ITimePoint): Promise<void>;
}

export class CalendarManager implements ICalendarNotification {
  private calendar: ICalendar;
  private isConnected: boolean;

  constructor(private cache: Cache, private event: ICalendarEvent) {
    if (this.event === undefined || this.cache === undefined) {
      throw(new Error("Invalid parameter"));
    }
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[]> {
    await this.cache.setDayOffset(path, req.id.dayOffset);
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

  public async onAddNotification(path: PanLPath, id: ITimePoint,
                                 duration: number): Promise<void> {
    await this.cache.setTimelineEntry(path, id, duration);
    await this.event.onAdd(path, id, duration);
  }

  public async onExtendNotification(path: PanLPath, id: ITimePoint,
                                    duration: number): Promise<void> {
    await this.cache.setTimelineEntry(path, id, duration);
    await this.event.onExtend(path, id, duration);
  }

  public async onDeleteNotification(path: PanLPath, id: ITimePoint):
  Promise<void> {
    await Promise.all([
      this.cache.removeTimelineEntry(path, id),
      this.cache.removeMeetingInfo(path, id),
    ]);
    await this.event.onDelete(path, id);
  }

  public async onUpdateNotification(path: PanLPath, id: ITimePoint):
  Promise<void> {
    await this.event.onUpdate(path, id);
  }

  public async connect(): Promise<void> {
    log.info("Start Calendar Manager...");

    try {
      const db = await Database.getInstance();
      const [config, configHub] = await Promise.all([
        Persist.getCalendarConfig(),
        Persist.getHubConfig()]);
      await db.stop();

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
      await this.event.onCalMgrError(err);
      return;
    }
    this.isConnected = true;
    await this.event.onCalMgrReady();
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
}
