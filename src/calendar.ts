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
  // epoch time
  start: number;
  end: number;
}

export interface IMeetingInfo {
  subject: string;
  organizer: string;
}

export interface ITimelineRequest {
  // epoch time
  id: number;
  lookForward: boolean;
  maxCount: number;
}

export interface ICalendar {
  getTimeline(room: string, id: number): Promise<boolean>;
  createBooking(room: string, entry: ITimelineEntry, email: string):
  Promise<ErrorCode>;
  extendMeeting(room: string, entry: ITimelineEntry, email: string):
  Promise<ErrorCode>;
  endMeeting(room: string, id: number, email: string): Promise<ErrorCode>;
  cancelMeeting(room: string, id: number, email: string):
  Promise<ErrorCode>;
  cancelUnclaimedMeeting(room: string, id: number): Promise<ErrorCode>;
  isAttendeeInMeeting(room: string, id: number, email: string):
  Promise<boolean>;
  disconnect(): Promise<void>;
}

export interface ICalendarNotification {
  onEndTimeChangeNotification(room: string, entry: ITimelineEntry):
  Promise<void>;
  onAddNotification(room: string, entry: ITimelineEntry):
  Promise<void>;
  onDeleteNotification(room: string, id: number): Promise<void>;
  onMeetingUpdateNotification(room: string, id: number): Promise<void>;
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
    const room = await this.cache.getRoomAddress(path);
    let entries = await this.cache.getTimeline(room, req);
    if (entries === undefined) {
      const isHave = await this.calendar.getTimeline(room, req.id);
      entries = isHave ? (await this.cache.getTimeline(room, req) || []) : [];
    }
    return entries;
  }

  public async getMeetingInfo(path: PanLPath, id: number):
  Promise<IMeetingInfo> {
    return this.cache.getMeetingInfo(
      await this.cache.getRoomAddress(path), id);
  }

  public async createBooking(path: PanLPath, entry: ITimelineEntry):
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
    return this.calendar.createBooking(await this.cache.getRoomAddress(path),
      entry, email);
  }

  public async extendMeeting(path: PanLPath, entry: ITimelineEntry):
  Promise<ErrorCode> {
    const room = await this.cache.getRoomAddress(path);
    if (this.panlConfig.featureDisabled.extendMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.panlConfig.authAllowPasscode.extendMeeting ||
        this.panlConfig.authAllowRFID.extendMeeting) {
      if (!email) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
      if (!await this.calendar.isAttendeeInMeeting(room, entry.start, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.extendMeeting(room, entry, email);
  }

  public async endMeeting(path: PanLPath, id: number): Promise<ErrorCode> {
    const room = await this.cache.getRoomAddress(path);
    if (this.panlConfig.featureDisabled.endMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.panlConfig.authAllowPasscode.endMeeting ||
        this.panlConfig.authAllowRFID.endMeeting) {
      if (!email) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
      if (!await this.calendar.isAttendeeInMeeting(room, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.endMeeting(room, id, email);
  }

  public async cancelMeeting(path: PanLPath, id: number):
  Promise<ErrorCode> {
    const room = await this.cache.getRoomAddress(path);
    if (this.panlConfig.featureDisabled.cancelMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    const email = await this.cache.getAuth(path);
    if (this.panlConfig.authAllowPasscode.cancelMeeting ||
        this.panlConfig.authAllowRFID.cancelMeeting) {
      if (!email) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
      if (!await this.calendar.isAttendeeInMeeting(room, id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return this.calendar.cancelMeeting(room, id, email);
  }

  public async checkClaimMeeting(path: PanLPath, id: number):
  Promise<ErrorCode> {
    if (this.panlConfig.featureDisabled.claimMeeting) {
      return ErrorCode.ERROR_FEATURE_DISABLED;
    }
    if (this.panlConfig.authAllowPasscode.claimMeeting ||
        this.panlConfig.authAllowRFID.claimMeeting) {
      const email = await this.cache.getAuth(path);
      if (!email) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
      if (!await this.calendar.isAttendeeInMeeting(
            await this.cache.getRoomAddress(path), id, email)) {
        return ErrorCode.ERROR_AUTH_ERROR;
      }
    }
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: number):
  Promise<ErrorCode> {
    return this.calendar.cancelUnclaimedMeeting(
      await this.cache.getRoomAddress(path), id);
  }

  public async onAddNotification(room: string, entry: ITimelineEntry):
  Promise<void> {
    await this.cache.setTimelineEntry(room, entry);
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onAdd(path, entry);
    }
  }

  public async onEndTimeChangeNotification(
    room: string, entry: ITimelineEntry): Promise<void> {
    // Start time no change
    await this.cache.setTimelineEntry(room, entry);
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onEndTimeChanged(path, entry);
    }
  }

  public async onDeleteNotification(room: string, id: number):
  Promise<void> {
    // Call onDeleteNotification and onAddNotification if start time changed
    await this.cache.removeTimelineEntry(room, id);
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onDelete(path, id);
    }
  }

  public async onMeetingUpdateNotification(room: string, id: number):
  Promise<void> {
    // Start and end time no change
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onUpdate(path, id);
    }
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
    await this.calendar.disconnect();
    this.isConnected = false;
    delete this.calendar;
  }
}
