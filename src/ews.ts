import {
  Appointment, AppointmentSchema, AutodiscoverService,
  CalendarView, ConflictResolutionMode, ConnectingIdType, DateTime,
  EventType, EwsLogging, ExchangeService, ExchangeVersion, Folder, FolderId,
  ImpersonatedUserId, Item, ItemEvent, ItemId, NotificationEventArgs,
  PropertySet, SendInvitationsMode, SendInvitationsOrCancellationsMode,
  StreamingSubscriptionConnection, SubscriptionErrorEventArgs, Uri,
  WebCredentials, WellKnownFolderName,
} from "ews-javascript-api";
import * as moment from "moment";
import {ErrorCode} from "./builder";
import {Cache} from "./cache";
import {
  ICalendar, ICalendarNotification, IMeetingInfo,
  ITimelineEntry, ITimelineRequest, ITimePoint,
} from "./calendar";
import {log} from "./log";
import {PanLPath} from "./path";
import {ICalendarConfig, IHubConfig} from "./persist";
import {Time} from "./time";

export interface IEwsCache {
  dayOffsetStr: string;
  minutesOfDay: number;
  agentID: number;
  mstpAddress: number;
}

export class EWSCalendar implements ICalendar {
  private service: ExchangeService;

  constructor(private notify: ICalendarNotification,
              private cache: Cache, config: ICalendarConfig,
              private configHub: IHubConfig) {
    EwsLogging.DebugLogEnabled = false;
    // TODO: auto detect exchange server version

    this.service = new ExchangeService(ExchangeVersion.Exchange2013);
    this.service.Credentials = new WebCredentials(
      config.username, config.password);
    this.service.Url = new Uri(config.address);

    this.streamNotification();
  }

  public async getTimeline(path: PanLPath, dayOffset: number):
  Promise<boolean> {
    const result: ITimelineEntry[] = [];
    // Cannot find timeline from cache, get from server

    const from = DateTime.Now.Date.AddDays(dayOffset); // midnight of dayOffset
    const to = from.AddDays(1);
    const view = new CalendarView(from, to);

    await this.impersonationSupport(path);

    const meetingResponse = await this.service.FindAppointments(
      WellKnownFolderName.Calendar, view);

    if (!meetingResponse || !meetingResponse.Items.length) {
      return false;
    }

    const task: any[] = [];
    // extract meeting info
    for (const meeting of meetingResponse.Items) {
      const timelineEntry =
        this.parseToTimelineEntry(meeting.Start, meeting.End);
      result.push(timelineEntry);
      // save meetingInfo
      task.push(this.cache.setMeetingInfo(path,
        {dayOffset, minutesOfDay: timelineEntry.start},
        {subject: meeting.Subject, organizer: meeting.Organizer.Name}));
      // save meetingId
      task.push(this.cache.setMeetingId(path,
        {dayOffset, minutesOfDay: timelineEntry.start},
        meeting.Id.UniqueId));
    }
    task.push(this.cache.setTimeline(path, dayOffset, result));
    await Promise.all(task);

    // cache timeline and cache meeting, async job

    return true;
  }

  public async createBooking(path: PanLPath, id: ITimePoint, duration: number,
                             email: string): Promise<ErrorCode> {
    await this.impersonationSupport(path);

    try {
      // Create the appointment.
      const appointment = new Appointment(this.service);
      const roomName = await this.cache.getRoomName(path);
      const roomAddress = await this.cache.getRoomAddress(path);
      const msStart = Time.getMiliseconds(id.dayOffset, id.minutesOfDay);

      // Set properties on the appointment.
      appointment.Subject = this.configHub.meetingSubject;
      appointment.Start = new DateTime(msStart);
      appointment.End = new DateTime(Time.extendTime(msStart, duration));
      appointment.Location = roomName;
      // cancel meeting required
      appointment.RequiredAttendees.Add(roomAddress);

      // Save the meeting to the Calendar folder and send the meeting request.
      await appointment.Save(SendInvitationsMode.SendToNone);

      // Verify that the meeting was created.
      // let item = await Item.Bind(this.service, appointment.Id, new
      // PropertySet(ItemSchema.Subject));
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.error("EWSCalendar.createBooking():: ", error.message);
      return this.parseErrorCode(error);
    }
  }

  public async extendMeeting(path: PanLPath, id: ITimePoint, duration: number,
                             email: string): Promise<ErrorCode> {
    try {
      await this.impersonationSupport(path);

      const meetingId = await this.cache.getMeetingId(path, id);
      const appointmentId = new ItemId(meetingId);
      // Instantiate an meeting object by binding to it by using the ItemId.
      const appointment = await Appointment.Bind(this.service, appointmentId);

      const originMs = appointment.End.TotalMilliSeconds;
      appointment.End = new DateTime(Time.extendTime(originMs, duration));

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
      log.error("EWSCalendar.extendMeeting():: ", error.message);
      return this.parseErrorCode(error);
    }
  }

  public async endMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode> {
    try {
      await this.impersonationSupport(path);

      const meetingId = await this.cache.getMeetingId(path, id);
      const appointmentId = new ItemId(meetingId);
      // Instantiate an meeting object by binding to it by using the ItemId.
      const appointment = await Appointment.Bind(this.service, appointmentId);

      appointment.End = DateTime.Now.Date.AddHours(-1);

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
      log.error("EWSCalendar.endMeeting():: ", error.message);
      return this.parseErrorCode(error);
    }
  }

  public async cancelMeeting(path: PanLPath, id: ITimePoint, email: string):
  Promise<ErrorCode> {
    try {
      await this.impersonationSupport(path);

      const meetingId = await this.cache.getMeetingId(path, id);
      const appointmentId = new ItemId(meetingId);
      // Instantiate an appointment object by binding to it using the ItemId.
      const meeting = await Appointment.Bind(this.service, appointmentId);

      // Delete the meeting by using the CancelMeeting method.
      await meeting.CancelMeeting();
      return ErrorCode.ERROR_SUCCESS;
    } catch (error) {
      log.error("EWSCalendar.cancelMeeting():: ", error.message);
      return this.parseErrorCode(error);
    }
  }

  public async cancelUnclaimedMeeting(path: PanLPath, id: ITimePoint):
  Promise<ErrorCode> {
    return this.cancelMeeting(path, id, "");
  }

  public async isAttendeeInMeeting(path: PanLPath, id: ITimePoint,
                                   email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    try {
      const meetingId = await this.cache.getMeetingId(path, id);
      const appointmentId = new ItemId(meetingId);
      // Instantiate an appointment object by binding to it using the ItemId.
      const meeting = await Appointment.Bind(this.service, appointmentId);

      let attendees = meeting.RequiredAttendees.GetEnumerator();
      for (const attendee of attendees) {
        if (attendee.Address.toLowerCase() === email.toLowerCase()) {
          return true;
        }
      }
      attendees = meeting.OptionalAttendees.GetEnumerator();
      for (const attendee of attendees) {
        if (attendee.Address.toLowerCase() === email.toLowerCase()) {
          return true;
        }
      }
    } catch (error) {
      log.error("EWSCalendar.isAttendeeInMeeting():: ", error.message);
    }

    // return false;
    return true;
  }

  public async handleNotification(meetingId: string, type: EventType):
  Promise<void> {
    const appointmentId = new ItemId(meetingId);
    let path: PanLPath = new PanLPath(0, 0);
    let newTimePoint = {dayOffset: -1, minutesOfDay: -1};
    let ewsCache = {
      dayOffsetStr: "",
      minutesOfDay: -1,
      agentID: -1,
      mstpAddress: -1,
    };
    let newMeeting = {subject: "", organizer: ""};
    let duration = -1;

    try {
      // path throw exception if not existed
      ewsCache = await this.cache.getEwsCacheByMeetingId(meetingId);
      path = new PanLPath(ewsCache.agentID, ewsCache.mstpAddress);
      // Instantiate an appointment object by binding to it using the ItemId.
      const meeting = await Appointment.Bind(this.service, appointmentId);
      const {start, end} =
        this.parseToTimelineEntry(meeting.Start, meeting.End);
      const dayOffset = this.countDayOffset(meeting.Start);
      newTimePoint = {dayOffset, minutesOfDay: start};
      duration = meeting.Duration.TotalMinutes;
      const newOrganizer = meeting.Organizer.Name;
      newMeeting = {
        subject: meeting.Subject,
        organizer: newOrganizer,
      };
      if (type === EventType.Created) {
        // save in cache without timeline entry and call add notification
        Promise.all([
          this.cache.setMeetingInfo(path,
            {dayOffset, minutesOfDay: start},
            {subject: meeting.Subject, organizer: meeting.Organizer.Name}),
          // save meetingId
          this.cache.setMeetingId(path, newTimePoint, meetingId),
        ]);

        // notification to client
        this.notify.onAddNotification(path,
          {dayOffset, minutesOfDay: start}, duration);

        log.debug("[notify] create new meeting");
      } else if (type === EventType.Modified) {
        // get meeting Info
        const timelineEntry =
          await this.cache.getTimelineEntry(path, newTimePoint);

        log.debug("[notify] timelineEntry", timelineEntry);
        const originMeeting =
          await this.cache.getMeetingInfo(path, newTimePoint);
        if (timelineEntry.end !== end) {
          this.notify.onEndTimeChangeNofication(path, newTimePoint, duration);
          log.debug("[notify] modified end time");
        }
        if (originMeeting.subject !== meeting.Subject
          || originMeeting.organizer !== newOrganizer) {
          await this.cache.setMeetingInfo(path, newTimePoint, newMeeting);
          // notify to client
          this.notify.onMeetingUpdateNotification(path, newTimePoint);
          log.debug("[notify] modified meeting info");
        }
      }
    } catch (error) {
      log.warn("[notify] have error: ", error.message);
      if (error.code === ErrorCode.ERROR_CACHE_TIMELINE_ENTRY_NOT_FOUND) {
        /*  Difficult to happen, because timeline entry and ewscache will
            will expired same time

            startTime update, remove old by timePointStr, add new by timePoint
         */
        const oldTimePoint = {
          dayOffset: Time.convertToDayOffset(ewsCache.dayOffsetStr),
          minutesOfDay: ewsCache.minutesOfDay,
        };

        // remove timeline entry and related
        this.notify.onDeleteNotification(path, oldTimePoint);
        // notify to client
        this.notify.onAddNotification(path, newTimePoint, duration);

        await Promise.all([
          this.cache.setMeetingInfo(path, newTimePoint, newMeeting),
          this.cache.setMeetingId(path, newTimePoint, meetingId),
        ]);

        log.debug("[notify] modified start time");
      } else if (error.ErrorCode === 249 && ewsCache && ewsCache.dayOffsetStr) {
        // remove cancel meeting
        const oldTimePoint = {
          dayOffset: Time.convertToDayOffset(ewsCache.dayOffsetStr),
          minutesOfDay: ewsCache.minutesOfDay,
        };
        this.notify.onDeleteNotification(path, oldTimePoint);
        log.debug("[notify] remove cancel meeting from cache");
      } else {
        log.debug("[notify] un-handle");
      }
    }
  }

  public async streamNotification(): Promise<void> {
    const folderId: FolderId[] = [new FolderId(
      WellKnownFolderName.Calendar)];
    const stream = await this.service.SubscribeToStreamingNotifications(
      folderId,
      EventType.Created,
      EventType.Modified);

    // Subscribe to streaming notifications in the Inbox.
    const connection = new StreamingSubscriptionConnection(this.service, 1);

    connection.AddSubscription(stream);
    // Delegate event handlers.
    connection.OnNotificationEvent.push((conn, args) => {
      this.onEvent(conn, args, this);
    });
    // Error handler
    connection.OnSubscriptionError.push((conn, args) => {
      log.error("EWS stream notification:::", args.Exception.Message);
    });
    // Auto reconnect
    connection.OnDisconnect.push((conn) => conn.Open());
    // Open connected
    connection.Open();

    log.info("Start EWS StreamSubscription Event...");
  }

  public onEvent(connection: StreamingSubscriptionConnection,
                 args: NotificationEventArgs, ews: EWSCalendar): void {
    const subscription = args.Subscription;

    const tmpSet = new Set();
    // Loop through all item-related events.
    for (const notification of args.Events) {
      // prevent duplicate notification
      const event: ItemEvent = notification as ItemEvent;
      if (tmpSet.has(event.ItemId.UniqueId)) {
        continue;
      }
      log.debug("EWS response: ",
        notification.EventType, event.ItemId.UniqueId);
      tmpSet.add(event.ItemId.UniqueId);
      ews.handleNotification(event.ItemId.UniqueId, notification.EventType);
    }
  }

  private async impersonationSupport(path: PanLPath) {
    this.service.ImpersonatedUserId =
      new ImpersonatedUserId(ConnectingIdType.SmtpAddress,
        await this.cache.getRoomAddress(path));
  }

  private countDayOffset(dateTime: DateTime)
  : number {
    const day: moment.Moment = moment(dateTime.TotalMilliSeconds);
    return day.diff(moment().startOf("day"), "days");
  }

  private parseToTimelineEntry(start: DateTime, end: DateTime)
  : ITimelineEntry {
    return {
      start: start.Hour * 60 + start.Minute,
      end: end.Hour * 60 + end.Minute,
    };
  }

  private parseErrorCode(error: any): ErrorCode {
    if (error.code) {
      return error.code;
    }

    switch (error.ErrorCode) {
      case 1:
        return ErrorCode.ERROR_ACCESS_DENIED;
      case 24:
        return ErrorCode.ERROR_ENDDATE_EARLIER_STARTDATA;
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
}
