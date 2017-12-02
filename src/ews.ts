import {
  Appointment, AppointmentSchema, AutodiscoverService,
  CalendarView, ConflictResolutionMode, ConnectingIdType, DateTime,
  EventType, EwsLogging, ExchangeService, ExchangeVersion, Folder, FolderId,
  ImpersonatedUserId, Item, ItemEvent, ItemId, Mailbox, NotificationEventArgs,
  PropertySet, SendInvitationsMode, SendInvitationsOrCancellationsMode,
  StreamingSubscriptionConnection, SubscriptionErrorEventArgs, Uri,
  WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import moment = require("moment");
import {ErrorCode} from "./builder";
import {Cache, IRoomStatusChange} from "./cache";
import {
ICalendar, ICalendarNotification, IMeetingInfo,
ITimelineEntry, ITimelineRequest,
} from "./calendar";
import {log} from "./log";
import {CalendarType, ICalendarConfig, IHubConfig} from "./persist";

export class EWSCalendar implements ICalendar, IRoomStatusChange {
  private static minuteBased(x: number): number {
     return moment(x).second(0).millisecond(0).valueOf();
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

  constructor(private notify: ICalendarNotification,
              private cache: Cache, config: ICalendarConfig,
              private configHub: IHubConfig) {
    EwsLogging.DebugLogEnabled = false;
    // TODO: auto detect exchange server version
    this.service = new ExchangeService(ExchangeVersion.Exchange2013);
    this.service.Credentials = new WebCredentials(
      config.username, config.password);
    this.service.Url = new Uri(config.address);
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
      log.error("EWSCalendar.createBooking()::", error.message);
      return EWSCalendar.parseEWSErrorCode(error.ErrorCode);
    }
  }

  public async extendMeeting(room: string, entry: ITimelineEntry,
                             email: string): Promise<ErrorCode> {
    this.impersonationSupport(room);
    try {
      let apptId;
      try {
        apptId = new ItemId(await this.cache.getMeetingUid(room, entry.start));
      } catch (err) {
        return ErrorCode.ERROR_CACHE_MEETINGID_NOT_FOUND;
      }
      const appointment = await Appointment.Bind(this.service, apptId);
      appointment.End = new DateTime(entry.end);

      // Unless explicitly specified, the default is to use SendToAllAndSave..
      // This can convert an appointment into a meeting. To avoid this,
      // explicitly set SendToNone on non-meetings.
      const mode = appointment.IsMeeting ?
        SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
        : SendInvitationsOrCancellationsMode.SendToNone;

      // Send the update request to the Exchange server.
      await appointment.Update(ConflictResolutionMode.AlwaysOverwrite, mode);
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.error("EWSCalendar.extendMeeting()::", error.message);
      return EWSCalendar.parseEWSErrorCode(error.ErrorCode);
    }
  }

  public async endMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    this.impersonationSupport(room);
    try {
      let apptId;
      try {
        apptId = new ItemId(await this.cache.getMeetingUid(room, id));
      } catch (err) {
        return ErrorCode.ERROR_CACHE_MEETINGID_NOT_FOUND;
      }
      const appointment = await Appointment.Bind(this.service, apptId);

      appointment.End = DateTime.Now;
      // Unless explicitly specified, the default is to use SendToAllAndSave..
      // This can convert an appointment into a meeting. To avoid this,
      // explicitly set SendToNone on non-meetings.
      const mode = appointment.IsMeeting ?
        SendInvitationsOrCancellationsMode.SendToAllAndSaveCopy
        : SendInvitationsOrCancellationsMode.SendToNone;

      // Send the update request to the Exchange server.
      await appointment.Update(ConflictResolutionMode.AlwaysOverwrite, mode);
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.error("EWSCalendar.endMeeting()::", error.message);
      return EWSCalendar.parseEWSErrorCode(error.ErrorCode);
    }
  }

  public async cancelMeeting(room: string, id: number, email: string):
  Promise<ErrorCode> {
    this.impersonationSupport(room);
    try {
      let apptId;
      try {
        apptId = new ItemId(await this.cache.getMeetingUid(room, id));
      } catch (err) {
        return ErrorCode.ERROR_CACHE_MEETINGID_NOT_FOUND;
      }
      const meeting = await Appointment.Bind(this.service, apptId);

      // Delete the meeting by using the CancelMeeting method.
      await meeting.CancelMeeting();
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.error("EWSCalendar.cancelMeeting()::", error.message);
      return EWSCalendar.parseEWSErrorCode(error.ErrorCode);
    }
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
    }
    return false;
  }

  public async disconnect(): Promise<void> {
    this.stopped = true;
    for (const sub of this.subMap.values()) {
      if (sub) {
        sub.Close();
      }
    }
    // clear map
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

  private async handleNotification(room: string, uid: string, type: EventType):
  Promise<void> {
    let appt;
    try {
      appt = await Appointment.Bind(this.service, new ItemId(uid));
    } catch (err) {
      if (err.ErrorCode === 249) {
        const start = await this.cache.getMeetingStartFromUid(room, uid);
        this.notify.onDeleteNotification(room, start);
        log.debug("[notify] meeting deleted");
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

    if (await !this.cache.isTimelineCachedForDay(room, entry.start)) {
      // No PanL is interested with this new meeting
      return;
    }

    if (type === EventType.Created) {
      log.error("TODO: get meeting room address");
      Promise.all([
        this.cache.setMeetingInfo(room, entry.start, info),
        this.cache.setMeetingUid(room, entry.start, uid),
      ]);
      this.notify.onAddNotification(room, entry);
      log.silly("[notify] create new meeting");
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
          await this.notify.onMeetingUpdateNotification(room, start);
        } else {
          await this.notify.onEndTimeChangeNotification(room, entry);
        }
      } else {
        await this.notify.onDeleteNotification(room, start);
        await Promise.all([
          this.cache.setMeetingInfo(room, entry.start, info),
          this.cache.setMeetingUid(room, entry.start, uid),
        ]);
        await this.notify.onAddNotification(room, entry);
      }
    } else {
      log.debug("[notify] unhandled notification type:", type);
    }
  }

  private async streamNotification(room: string): Promise<void> {
    const folderId: FolderId[] = [new FolderId(
      WellKnownFolderName.Calendar, new Mailbox(room))];
    const stream = await this.service.SubscribeToStreamingNotifications(
      folderId,
      EventType.Created,
      EventType.Modified);

    // Subscribe to streaming notifications in the Inbox.
    const sub = new StreamingSubscriptionConnection(this.service, 1);

    sub.AddSubscription(stream);
    // Delegate event handlers.
    sub.OnNotificationEvent.push((conn, args) => {
      this.onEvent(conn, args, room, this);
    });
    // Error handler
    sub.OnSubscriptionError.push((conn, args) => {
      log.error("EWS stream notification:::", args.Exception.Message);
    });
    // Auto reconnect
    sub.OnDisconnect.push((conn) => {
      if (!this.stopped) {
        conn.Open();
        this.subMap.set(room, conn);
      } else {
        this.subMap.delete(room);
      }
    });
    // Open connected
    if (!this.stopped) {
      sub.Open();
      this.subMap.set(room, sub);
      log.debug("Start EWS StreamSubscription Event...");
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
      log.debug("EWS response:",
        notification.EventType, event.ItemId.UniqueId);
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
