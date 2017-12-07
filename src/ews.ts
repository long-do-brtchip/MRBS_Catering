import {
  Appointment, AppointmentSchema, AutodiscoverService, CalendarView,
  ConflictResolutionMode, ConnectingIdType, DateTime, EmailAddress,
  EventType, EwsLogging, ExchangeService, ExchangeVersion, Folder, FolderId,
  ImpersonatedUserId, Item, ItemEvent, ItemId, Mailbox, NotificationEventArgs,
  PropertySet, ResolveNameSearchLocation, SendInvitationsMode,
  SendInvitationsOrCancellationsMode,
  StreamingSubscriptionConnection, SubscriptionErrorEventArgs, Uri,
  UserSettingName, WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import moment = require("moment");
import {ErrorCode} from "./builder";
import {Cache, IRoomStatusChange} from "./cache";
import { ICalendar, IMeetingInfo, ITimelineEntry,
  ITimelineRequest} from "./calendar";
import {ICalendarEvent} from "./interface";
import {log} from "./log";
import {CalendarType, ICalendarConfig, IHubConfig} from "./persist";

export interface IRoomDetails {
  name: string;
  location: string;
  country: string;
  email: string;
}

export interface IRoomList {
  name: string;
  rooms: IRoomDetails[];
}

export class EWSCalendar implements ICalendar, IRoomStatusChange {
  public static schemaToVersion(schema: string): ExchangeVersion {
    switch (schema) {
    case "Exchange2007":
    case "Exchange2007_SP1":
      return ExchangeVersion.Exchange2007_SP1;
    case "Exchange2010":
      return ExchangeVersion.Exchange2010;
    case "Exchange2010_SP1":
      return ExchangeVersion.Exchange2010_SP1;
    case "Exchange2010_SP2":
      return ExchangeVersion.Exchange2010_SP2;
    case "Exchange2013":
      return ExchangeVersion.Exchange2013;
    case "Exchange2013_SP1":
      return ExchangeVersion.Exchange2013_SP1;
    case "Exchange2015":
      return ExchangeVersion.Exchange2015;
    case "Exchange2016":
      return ExchangeVersion.Exchange2016;
    default:
      throw(new Error("Unsupported exchange version " + schema));
    }
  }

  public static async utoDiscoverUrl(user: string, pass: string) {
    const service = new ExchangeService();
    service.Credentials = new WebCredentials(user, pass);
    await service.AutodiscoverUrl(user, () => true);
    return service.Url.toString();
  }

  private static minuteBased(x: number): number {
     return moment(x).second(0).millisecond(0).valueOf();
  }

  private static getDomain(url: string): string {
    let hostname = (url.indexOf("://") > -1) ?
      url.split("/")[2] : url.split("/")[0];
    hostname = hostname.split(":")[0];
    return hostname.split("?")[0];
  }

  private static parseEWSErrorCode(code: number): ErrorCode {
    switch (code) {
      case 1:
        return ErrorCode.ERROR_ACCESS_DENIED;
      case 24:
        return ErrorCode.ERROR_ENDDATE_EARLIER_STARTDATE;
      case 41:
        return ErrorCode.ERROR_MUST_ORGANIZER;
      case 161:
        return ErrorCode.ERROR_MALFORMED_DATA;
      case 203:
        return ErrorCode.ERROR_SET_ACTION_INVALID_FOR_PROPERTY;
      case 208:
        return ErrorCode.ERROR_REQUIRED_RECIPIENT;
      case 249:
        return ErrorCode.ERROR_OBJECT_NOT_FOUND;
      default:
        return ErrorCode.ERROR_UNKNOWN;
    }
  }

  private stopped = false;
  private service: ExchangeService;
  private subMap = new Map<string, StreamingSubscriptionConnection>();

  constructor(private notify: ICalendarEvent<string>,
              private cache: Cache, private config: ICalendarConfig,
              private configHub: IHubConfig) {
    EwsLogging.DebugLogEnabled = false;
  }

  public async init() {
    this.service = new ExchangeService(await this.discoverVersion());
    this.service.Credentials = new WebCredentials(
      this.config.username, this.config.password);
    this.service.Url = new Uri(this.config.address);
    await this.cache.subscribeRoomStatusChange(this);
  }

  public async getTimeline(room: string, id: number):
  Promise<ITimelineEntry[]> {
    const result: ITimelineEntry[] = [];
    const from = new DateTime(moment(id).startOf("day").valueOf());
    const view = new CalendarView(from, from.AddDays(1));

    this.impersonationSupport(room);
    const meetingResponse = await this.service.FindAppointments(
      WellKnownFolderName.Calendar, view);

    if (!meetingResponse || !meetingResponse.Items.length) {
      return result;
    }

    const task: any[] = [];
    for (const meeting of meetingResponse.Items) {
      const start: number =
        EWSCalendar.minuteBased(meeting.Start.TotalMilliSeconds);
      const end: number =
        EWSCalendar.minuteBased(meeting.End.TotalMilliSeconds);
      result.push({start, end});
      task.push(this.cache.setMeetingInfo(room, start,
        {subject: meeting.Subject, organizer: meeting.Organizer.Name}));
      task.push(this.cache.setMeetingUid(room, start, meeting.Id.UniqueId));
    }
    await Promise.all(task);
    return result;
  }

  public async createBooking(room: string, entry: ITimelineEntry,
                             email: string):
  Promise<ErrorCode> {
    this.impersonationSupport(room);
    try {
      // Create the appointment.
      const appointment = new Appointment(this.service);

      // Set properties on the appointment.
      try {
        appointment.Location = await this.cache.getRoomName(room);
      } catch (err) {
        return ErrorCode.ERROR_CACHE_ROOMNAME_NOT_FOUND;
      }
      appointment.Subject = this.configHub.meetingSubject;
      appointment.Start = new DateTime(entry.start);
      appointment.End = new DateTime(entry.end);
      // cancel meeting required
      appointment.RequiredAttendees.Add(room);

      // Save the meeting to the Calendar folder and send the meeting request.
      await appointment.Save(SendInvitationsMode.SendToNone);
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.info("EWSCalendar.createBooking()::", error.message);
      return EWSCalendar.parseEWSErrorCode(error.ErrorCode);
    }
  }

  public async extendMeeting(room: string, entry: ITimelineEntry,
                             email: string): Promise<ErrorCode> {
    return this.updateAppointment(room, entry.start, (appt) => {
      appt.End = new DateTime(entry.end);
    });
  }

  public async endMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    return this.updateAppointment(room, id, (appt) => {
      const now = DateTime.Now;
      appt.End = now < appt.Start ? appt.Start : now;
    });
  }

  public async cancelMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    return this.modifyAppointment(room, id, async (appt) => {
      await appt.CancelMeeting();
    });
  }

  public async cancelUnclaimedMeeting(room: string, id: number):
  Promise<ErrorCode> {
    return this.cancelMeeting(room, id, "");
  }

  public async isAttendeeInMeeting(room: string, id: number, email: string):
  Promise<boolean> {
    let appt;
    try {
      appt = await Appointment.Bind(this.service,
        new ItemId(await this.cache.getMeetingUid(room, id)));
    } catch (err) {
      return false;
    }

    email = email.toLowerCase();
    const attendees = appt.RequiredAttendees.GetEnumerator().concat(
      appt.OptionalAttendees.GetEnumerator());
    for (const attendee of attendees) {
      if (attendee.Address.toLowerCase() === email) {
        return true;
      }
      try {
        const emailGroup = await this.service.ExpandGroup(attendee.Address);
        for (const member of emailGroup.Members) {
          if (member.Address.toLowerCase() === email) {
            return true;
          }
        }
      } catch (error) {
        log.info("EWSCalendar.isAttendeeInMeeting()::", error.message);
      }
    }

    return false;
  }

  public async deinit(): Promise<void> {
    this.stopped = true;
    this.cache.unsubscribeRoomStatusChange(this);
    for (const sub of this.subMap.values()) {
      sub.Close();
    }
    this.subMap.clear();
  }

  public async onRoomOnline(room: string): Promise<void> {
    return this.streamNotification(room);
  }

  public async onRoomOffline(room: string): Promise<void> {
    const sub = this.subMap.get(room);
    if (sub) {
      this.subMap.delete(room);
      sub.Close();
    }
  }

  public async addAttendee(room: string, id: number, attendeeAddress: string):
  Promise<ErrorCode> {
    return this.updateAppointment(room, id,
      (appt) => appt.RequiredAttendees.Add(attendeeAddress));
  }

  public async updateSubject(room: string, id: number, subject: string):
  Promise<ErrorCode> {
    return this.updateAppointment(room, id, (appt) => appt.Subject = subject);
  }

  public async updateStartTime(room: string, id: number, time: number):
  Promise<ErrorCode> {
    return this.updateAppointment(room, id,
      (appt) => appt.Start = new DateTime(time));
  }

  public async resolveName(room: string): Promise<IRoomDetails | undefined> {
    const name = await this.service.ResolveName(room,
      ResolveNameSearchLocation.DirectoryOnly, true);
    if (name.Count === 0) {
      return undefined;
    }
    const contact = name._getItem(0).Contact;
    const country = contact.PhysicalAddresses ?
      contact.PhysicalAddresses._getItem(0).CountryOrRegion : "";
    return {
      name: contact.DisplayName,
      email: room,
      location: contact.OfficeLocation,
      country,
    };
  }

  public async discoverRooms(): Promise<IRoomList[]> {
    const list: IRoomList[] = [];
    const lists = await this.service.GetRoomLists();
    for (const elem of lists.GetEnumerator()) {
      const rooms = await this.service.GetRooms(new EmailAddress(elem.Address));
      const ret = await Promise.all(
        rooms.map((r) => this.resolveName(r.Address)));
      list.push({
        name: elem.Name,
        rooms: ret.filter((n) => n !== undefined) as IRoomDetails[],
      });
    }
    return list;
  }

  private async discoverVersion(): Promise<ExchangeVersion> {
    const ad = new AutodiscoverService(
      EWSCalendar.getDomain(this.config.address));
    ad.Credentials = new WebCredentials(
      this.config.username, this.config.password);
    ad.RedirectionUrlValidationCallback = () => true;
    const settings = [
      UserSettingName.EwsSupportedSchemas,
    ];
    const response = await ad.GetUserSettings(this.config.username, settings);
    const schemas = response.Settings[UserSettingName.EwsSupportedSchemas];
    if (!schemas) {
      throw(new Error("Not able to get supported EWS schema"));
    }
    const schema = schemas.split(", ").pop();
    log.debug("Schema", schema, "will be used");
    return EWSCalendar.schemaToVersion(schema);
  }

  private async modifyAppointment(room: string, id: number,
                                  cb: (appt: Appointment) => Promise<void>):
  Promise<ErrorCode> {
    this.impersonationSupport(room);
    try {
      let apptId;
      try {
        apptId = new ItemId(await this.cache.getMeetingUid(room, id));
      } catch (err) {
        return ErrorCode.ERROR_CACHE_MEETINGID_NOT_FOUND;
      }
      const appt = await Appointment.Bind(this.service, apptId);
      await cb(appt);
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.info("EWS::modifyAppointment() error:", error.message);
      return EWSCalendar.parseEWSErrorCode(error.ErrorCode);
    }
  }

  private async updateAppointment(room: string, id: number,
                                  cb: (appt: Appointment) => void):
  Promise<ErrorCode> {
    return this.modifyAppointment(room, id, async (appt) => {
      const mode = appt.IsMeeting ?
        SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy :
        SendInvitationsOrCancellationsMode.SendToNone;
      cb(appt);
      await appt.Update(ConflictResolutionMode.AlwaysOverwrite, mode);
    });
  }

  private async handleNotification(room: string, uid: string, type: EventType):
  Promise<void> {
    let appt;
    try {
      appt = await Appointment.Bind(this.service, new ItemId(uid));
    } catch (err) {
      if (err.ErrorCode === 249) {
        const start = await this.cache.getMeetingStartFromUid(room, uid);
        this.notify.onDelete(room, start);
      }
      return;
    }

    const info = {
      subject: appt.Subject,
      organizer: appt.Organizer.Name,
    };
    const entry = {
      start: EWSCalendar.minuteBased(appt.Start.TotalMilliSeconds),
      end: EWSCalendar.minuteBased(appt.End.TotalMilliSeconds),
    };

    if (!await this.cache.isTimelineCachedForDay(room, entry.start)) {
      // No PanL is interested with this new meeting
      return;
    }

    if (type === EventType.Created) {
      Promise.all([
        this.cache.setMeetingInfo(room, entry.start, info),
        this.cache.setMeetingUid(room, entry.start, uid),
      ]);
      this.notify.onAdd(room, entry);
    } else if (type === EventType.Modified) {
      const start = await this.cache.getMeetingStartFromUid(room, uid);
      if (start === 0) {
        // No PanL is interested with this modification
        return;
      }
      if (start === entry.start) {
        const end = await this.cache.getTimelineEntryEndTime(room, start);
        await this.cache.setMeetingInfo(room, start, info);
        if (end === entry.end) {
          await this.notify.onMeetingUpdate(room, start);
        } else {
          await this.notify.onEndTimeChange(room, entry);
        }
      } else {
        await this.notify.onDelete(room, start);
        await Promise.all([
          this.cache.setMeetingInfo(room, entry.start, info),
          this.cache.setMeetingUid(room, entry.start, uid),
        ]);
        await this.notify.onAdd(room, entry);
      }
    } else {
      log.verbose("[notify] unhandled notification type:", type);
    }
  }

  private async streamNotification(room: string): Promise<void> {
    log.verbose(`Start EWS StreamSubscription for room ${room}...`);
    this.impersonationSupport(room);
    const folderId: FolderId[] = [new FolderId(
      WellKnownFolderName.Calendar, new Mailbox(room))];
    const stream = await this.service.SubscribeToStreamingNotifications(
      folderId, EventType.Created, EventType.Modified, EventType.Deleted,
      EventType.Moved);

    // Subscribe to streaming notifications in the Inbox.
    const sub = new StreamingSubscriptionConnection(this.service, 1);

    sub.AddSubscription(stream);
    // Delegate event handlers.
    sub.OnNotificationEvent.push((conn, args) => {
      this.onEvent(conn, args, room, this);
    });
    // Error handler
    sub.OnSubscriptionError.push((conn, args) => {
      log.info(`EWS stream notification for room ${room} error`,
        args.Exception.Message);
    });
    // Auto reconnect
    sub.OnDisconnect.push((conn) => {
      if (!this.stopped && this.subMap.has(room)) {
        conn.Open();
        log.verbose("EWS StreamSubscription re-open: ", room);
      } else {
        this.subMap.delete(room);
        log.verbose("EWS StreamSubscription close: ", room);
      }
    });
    // Open connected
    if (!this.stopped) {
      sub.Open();
      this.subMap.set(room, sub);
      if (this.stopped) {
        this.subMap.delete(room);
        sub.Close();
      }
    }
  }

  private onEvent(connection: StreamingSubscriptionConnection,
                  args: NotificationEventArgs,
                  room: string, ews: EWSCalendar): void {
    const subscription = args.Subscription;

    const tmpSet = new Set();
    // Loop through all item-related events.
    for (const notification of args.Events) {
      // prevent duplicate notification
      const event: ItemEvent = notification as ItemEvent;
      if (tmpSet.has(event.ItemId.UniqueId)) {
        continue;
      }
      log.silly("EWS notification:", EventType[notification.EventType],
        "UID:", event.ItemId.UniqueId);
      tmpSet.add(event.ItemId.UniqueId);
      try {
        ews.handleNotification(room, event.ItemId.UniqueId,
          notification.EventType);
      } catch (error) {
        continue;
      }
    }
  }

  private impersonationSupport(room: string) {
    this.service.ImpersonatedUserId =
      new ImpersonatedUserId(ConnectingIdType.SmtpAddress, room);
  }
}
