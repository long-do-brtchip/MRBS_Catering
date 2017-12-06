import moment = require("moment");
import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {Database} from "./database";
import {EWSCalendar} from "./ews";
import {ICalendarEvent, ICalendarManagerEvent} from "./interface";
import {log} from "./log";
import {MockupCalendar} from "./mockup";
import {PanLPath} from "./path";
import {CalendarType, IHubConfig, IPanlConfig, Persist} from "./persist";

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
  getTimeline(room: string, id: number): Promise<ITimelineEntry[]>;
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
  disconnect?(): Promise<void>;
  init?(): Promise<void>;
}

export class CalendarManager implements ICalendarEvent<string> {
  private event?: ICalendarEvent<PanLPath>;
  private calendar: ICalendar;
  private isConnected: boolean;

  constructor(private cache: Cache, private hubConfig: IHubConfig,
              private panlConfig: IPanlConfig) {
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[]> {
    const room = await this.cache.getRoomAddress(path);
    let entries = await this.cache.getTimeline(room, req);
    if (entries === undefined) {
      entries = await this.calendar.getTimeline(room, req.id);
      log.silly(`Save ${entries.length} entries for ` +
        moment(req.id).startOf("day").calendar());
      for (const entry of entries) {
        log.silly("entry starts: " + moment(entry.start).calendar() +
         ", ends: " + moment(entry.end).calendar());
      }
      await this.cache.setTimeline(room, req.id, entries);
      entries = await this.cache.getTimeline(room, req);
      if (entries === undefined) {
        return [];
      }
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
        return ErrorCode.ERROR_ACCESS_DENIED;
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
        return ErrorCode.ERROR_ACCESS_DENIED;
      }
    }
    if (id > moment().add(-1, "minutes").valueOf()) {
      log.silly(`${room}'s meeting ${moment(id).calendar()} hasn't started ` +
        "yet, cancel the meeting instead");
      return this.calendar.cancelMeeting(room, id, email);
    } else {
      log.silly(`End ${room}'s meeting ${moment(id).calendar()}`);
      return this.calendar.endMeeting(room, id, email);
    }
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
        return ErrorCode.ERROR_ACCESS_DENIED;
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
        return ErrorCode.ERROR_ACCESS_DENIED;
      }
    }
    return ErrorCode.ERROR_SUCCESS;
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: number):
  Promise<ErrorCode> {
    return this.calendar.cancelUnclaimedMeeting(
      await this.cache.getRoomAddress(path), id);
  }

  public async onAdd(room: string, entry: ITimelineEntry) {
    if (!this.event) {
      return;
    }
    if (entry.end <= entry.start) {
      log.debug("New meeting ends before started");
      return;
    }
    log.debug(`${room} new meeting starts from ` + moment(entry.start).
      calendar() + ` ends ${moment(entry.end).calendar()}`);
    await this.cache.setTimelineEntry(room, entry);
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onAdd(path, entry);
    }
  }

  public async onEndTimeChange(room: string, entry: ITimelineEntry) {
    // Start time no change
    if (!this.event) {
      return;
    }
    const end = await this.cache.getTimelineEntryEndTime(room, entry.start);
    if (end !== undefined) {
      if (entry.end > end) {
        entry.end = end;
      }
    }
    if (entry.end < entry.start) {
      log.debug("meeting ends before started");
      entry.end = entry.start;
    }
    log.debug(`${room}'s meeting starts from ${moment(entry.start).calendar()}`
      + ` ends ${moment(entry.end).calendar()}`);
    await this.cache.setTimelineEntry(room, entry);
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onEndTimeChange(path, entry);
    }
  }

  public async onDelete(room: string, id: number) {
    if (!this.event) {
      return;
    }
    log.debug(`${room}'s meeting starts from ${moment(id).calendar()} `
      + " is deleted.");
    await this.cache.removeTimelineEntry(room, id);
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onDelete(path, id);
    }
  }

  public async onMeetingUpdate(room: string, id: number) {
    if (!this.event) {
      return;
    }
    // Start and end time no change
    log.debug(`${room}'s meeting starts from ${moment(id).calendar()} `
      + " is updated.");
    const paths = await this.cache.getRoomPanLs(room);
    for (const path of paths) {
      this.event.onMeetingUpdate(path, id);
    }
  }

  public async connect(event: ICalendarEvent<PanLPath>,
                       calMgrEvent?: ICalendarManagerEvent) {
    log.info("Start Calendar Manager...");
    this.event = event;

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
      if (calMgrEvent) {
        await calMgrEvent.onCalMgrError(err);
      }
      return;
    }
    if (this.calendar.init) {
      await this.calendar.init();
    }
    this.isConnected = true;
    if (calMgrEvent) {
      try {
          await calMgrEvent.onCalMgrReady();
      } catch (Error) {
        log.debug("PanLService stopped already");
      }
    }
  }

  public async disconnect(): Promise<void> {
    delete this.event;
    if (this.calendar.disconnect) {
      await this.calendar.disconnect();
    }
    this.isConnected = false;
    delete this.calendar;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
