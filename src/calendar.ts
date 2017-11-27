import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {Database} from "./database";
import {EWSCalendar} from "./ews";
import {log} from "./log";
import {MockupCalendar} from "./mockup";
import {PanLPath} from "./path";
import {CalendarType, IHubConfig, IPanlConfig, Persist} from "./persist";
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
  isAttendeeInMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<boolean>;
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
              private hubConfig: IHubConfig, private panlConfig: IPanlConfig) {
    if (event === undefined || cache === undefined ||
        hubConfig === undefined || panlConfig === undefined) {
      throw(new Error("Invalid parameter"));
    }
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[]> {
    let entries = await this.cache.getTimeline(path, req);
    if (entries === undefined) {
      // get timeline from External server and cached
      const isHave = await this.calendar.getTimeline(path, req.id.dayOffset);
      // get in cache again
      entries = isHave ? (await this.cache.getTimeline(path, req) || []) : [];
    }

    return entries;
  }

  public async getMeetingInfo(path: PanLPath, id: ITimePoint):
  Promise<IMeetingInfo> {
    return this.cache.getMeetingInfo(path, id);
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number):
  Promise<ErrorCode> {
    if (this.panlConfig.featureDisabled.onSpotBooking) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if ((this.panlConfig.authAllowRFID.onSpotBooking ||
         this.panlConfig.authAllowPasscode) &&
        email.length === 0) {
      return ErrorCode.ERROR_AUTH_ERROR;
    }
    return this.calendar.createBooking(path, id, duration, email);
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number):
  Promise<ErrorCode> {
    if (this.panlConfig.featureDisabled.extendMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.panlConfig.authAllowPasscode.extendMeeting ||
        this.panlConfig.authAllowRFID.extendMeeting) {
      if (!await this.calendar.isAttendeeInMeeting(path, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.extendMeeting(path, id, duration, email);
  }

  public async endMeeting(path: PanLPath, id: ITimePoint): Promise<ErrorCode> {
    if (this.panlConfig.featureDisabled.endMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.panlConfig.authAllowPasscode.endMeeting ||
        this.panlConfig.authAllowRFID.endMeeting) {
      if (!await this.calendar.isAttendeeInMeeting(path, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.endMeeting(path, id, email);
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    if (this.panlConfig.featureDisabled.cancelMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.panlConfig.authAllowPasscode.cancelMeeting ||
        this.panlConfig.authAllowRFID.cancelMeeting) {
      if (!await this.calendar.isAttendeeInMeeting(path, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.cancelMeeting(path, id, email);
  }

  public async checkClaimMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    if (this.panlConfig.featureDisabled.claimMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    if (this.panlConfig.authAllowPasscode.claimMeeting ||
        this.panlConfig.authAllowRFID.claimMeeting) {
      if (!await this.calendar.isAttendeeInMeeting(path, id,
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
          this.calendar = new MockupCalendar(this, this.cache, this.hubConfig);
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
