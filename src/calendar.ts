import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {Database} from "./database";
import {EWSCalendar} from "./ews";
import {log} from "./log";
import {MockupCalendar} from "./mockup";
import {PanLPath} from "./path";
import {CalendarType, IHubConfig, Persist} from "./persist";
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
  createBooking(path: PanLPath, id: ITimePoint, duration: number,
                email: string): Promise<ErrorCode>;
  extendMeeting(path: PanLPath, id: ITimePoint, duration: number,
                email: string): Promise<ErrorCode>;
  endMeeting(path: PanLPath, id: ITimePoint, email: string): Promise<ErrorCode>;
  cancelMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode>;
  cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint): Promise<ErrorCode>;
}

export interface ICalendarNotification {
  onEndTimeChangeNofication(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void>;
  onAddNotification(path: PanLPath, id: ITimePoint, duration: number):
  Promise<void>;
  onDeleteNotification(path: PanLPath, id: ITimePoint): Promise<void>;
  onMeetingUpdateNotification(path: PanLPath, id: ITimePoint): Promise<void>;
}

export class CalendarManager implements ICalendarNotification {
  private calendar: ICalendar;
  private isConnected: boolean;

  constructor(private cache: Cache, private event: ICalendarEvent,
              private hubConfig: IHubConfig) {
    if (this.event === undefined || this.cache === undefined ||
        hubConfig === undefined) {
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

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<ErrorCode> {
    if (this.hubConfig.featureDisabled.onSpotBooking) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.hubConfig.requireAuthentication.onSpotBooking &&
        email.length === 0) {
      return ErrorCode.ERROR_AUTH_ERROR;
    }
    return this.calendar.createBooking(path, id, duration, email);
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<ErrorCode> {
    if (this.hubConfig.featureDisabled.extendMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.hubConfig.requireAuthentication.extendMeeting) {
      if (!await this.cache.validateAttendee(path, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.extendMeeting(path, id, duration, email);
  }

  public async endMeeting(path: PanLPath, id: ITimePoint): Promise<ErrorCode> {
    if (this.hubConfig.featureDisabled.endMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.hubConfig.requireAuthentication.endMeeting) {
      if (!await this.cache.validateAttendee(path, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.endMeeting(path, id, email);
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    if (this.hubConfig.featureDisabled.cancelMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.hubConfig.requireAuthentication.cancelMeeting) {
      if (!await this.cache.validateAttendee(path, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.cancelMeeting(path, id, email);
  }

  public async checkClaimMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    if (this.hubConfig.featureDisabled.claimMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    if (this.hubConfig.requireAuthentication.claimMeeting) {
      if (!await this.cache.validateAttendee(path, id,
        await this.cache.getAuth(path))) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return ErrorCode.ERROR_SUCCESS;
  }

  public cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    return this.calendar.cancelUnclaimedMeeting(path, id);
  }

  public async onAddNotification(path: PanLPath, id: ITimePoint,
                                 duration: number): Promise<void> {
    await this.cache.setTimelineEntry(path, id, duration);
    await this.event.onAdd(path, id, duration);
  }

  public async onEndTimeChangeNofication(
    path: PanLPath, id: ITimePoint, duration: number): Promise<void> {
    // Start time no change
    await this.cache.setTimelineEntry(path, id, duration);
    await this.event.onExtend(path, id, duration);
  }

  public async onDeleteNotification(path: PanLPath, id: ITimePoint):
  Promise<void> {
    // Call onDeleteNotification and onAddNotification if start time changed
    await this.cache.removeTimelineEntry(path, id);
    await this.event.onDelete(path, id);
  }

  public async onMeetingUpdateNotification(path: PanLPath, id: ITimePoint):
  Promise<void> {
    // Start and end time no change
    await this.event.onUpdate(path, id);
  }

  public async connect(): Promise<void> {
    log.info("Start Calendar Manager...");

    try {
      const db = await Database.getInstance();
      const config = await Persist.getCalendarConfig();
      await db.stop();

      switch (config.type) {
        case CalendarType.UNCONFIGURED:
          log.info("Calendar is not configured.");
          return;
        case CalendarType.EXCHANGE:
        case CalendarType.OFFICE365:
          this.calendar = new EWSCalendar(this, this.cache, config,
                                          this.hubConfig);
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
