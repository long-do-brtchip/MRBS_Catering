import moment = require("moment");
import ref = require("ref");
import StructType = require("ref-struct");
import {IMeetingInfo, ITimelineEntry} from "./calendar";
import {log} from "./log";
import {IHubConfig, IPanlConfig, LANG_ID} from "./persist";

interface ITimePoint {
  dayOffset: number;
  minutesOfDay: number;
}

export enum ErrorCode {
  ERROR_SUCCESS,
  ERROR_UNKNOWN,
  ERROR_AUTH_ERROR,
  ERROR_FEATURE_DISABLED,
  ERROR_CERTIFICATE,
  ERROR_NETWORK,
  ERROR_CACHE_ROOMNAME_NOT_FOUND,
  ERROR_CACHE_MEETINGID_NOT_FOUND,
  ERROR_MALFORMED_DATA,
  ERROR_OBJECT_NOT_FOUND,
  ERROR_ENDDATE_EARLIER_STARTDATE,
  ERROR_ACCESS_DENIED,
  ERROR_REQUIRED_RECIPIENT,
  ERROR_SET_ACTION_INVALID_FOR_PROPERTY,
  ERROR_MUST_ORGANIZER,
}

enum Outgoing {
  SET_ADDRESS,
  SET_POWER_OFF,
  SET_TIMEOUT,
  SET_LOCAL_TIME,
  SET_TIME_FORMAT,
  SET_EXPECTED_FIRMWARE_VERSION,
  WRITE_ASSERTS,
  WRITE_FIRMWARE,
  SET_LANGID,
  SET_ROOM_SIZE,
  SET_ROOM_EQUIPMENTS,
  SET_ACCESS_RIGHT,
  SET_HARDWARE_FEATURE,
  SET_BACKLIGHT,
  SET_ROOM_NAME,
  SET_TIMELINE,
  ON_MEETING_END_TIME_CHANGED,
  ON_ADD_MEETING,
  ON_DEL_MEETING,
  ON_UPDATE_MEETING,
  SET_MEETING_INFO,
  SET_MEETING_BODY,
  SET_ERROR_CODE,
  GET_UUID,
  SET_UNCONFIGURED_ID,
}

const StructSetAddress = StructType({
  cmd : ref.types.uint8,
  addr : ref.types.uint8,
  length : ref.types.uint16,
}, {packed: true});

/* bitmap for power control.
* currently we will only disable the port power once all bits are set */
const StructSetPowerOff = StructType({
  cmd: ref.types.uint8,
  bitmap: ref.types.uint8,
}, {packed: true});

const StructSetTimeout = StructType({
  cmd: ref.types.uint8,
  seconds: ref.types.uint8,
}, {packed: true});

const StructWriteAssertsHdr = StructType({
  cmd: ref.types.uint8,
  pathLen: ref.types.uint8,
  dataLen: ref.types.uint8,
}, {packed: true});

const StructWriteFirmwareHdr = StructType({
  cmd: ref.types.uint8,
  dataLen: ref.types.uint8,
}, {packed: true});

const StructSetRoomSize = StructType({
  cmd: ref.types.uint8,
  maxPeople: ref.types.uint16,
}, {packed: true});

const StructSetRoomEquipments = StructType({
  cmd: ref.types.uint8,
  bitmap: ref.types.uint8,
}, {packed: true});

const StructAccessRight = StructType({
  cmd: ref.types.uint8,
  featureDisabled: ref.types.uint8,
  authAllowPasscode : ref.types.uint8,
  authAllowRFID : ref.types.uint8,
}, {packed: true});

const StructHardwareFeature = StructType({
  cmd: ref.types.uint8,
  bitmap: ref.types.uint8,
}, {packed: true});

const StructBacklight = StructType({
  cmd: ref.types.uint8,
  on: ref.types.bool,
}, {packed: true});

const StructSetRoomNameHdr = StructType({
  cmd: ref.types.uint8,
  len: ref.types.uint8,
}, {packed: true});

const StructFirmwareVersion = StructType({
  cmd : ref.types.uint8,
  version: ref.types.uint16,
}, {packed: true});

const StructGetUUID = StructType({
  cmd : ref.types.uint8,
}, {packed: true});

const StructSetLang = StructType({
  cmd : ref.types.uint8,
  lang : ref.types.uint8,
}, {packed: true});

const StructSetTimeFormat = StructType({
  cmd : ref.types.uint8,
  militaryFormat : ref.types.bool,
}, {packed: true});

const StructSetLocalTime = StructType({
  cmd : ref.types.uint8,
  time : ref.types.uint32,
}, {packed: true});

const StructUnconfiguredID = StructType({
  cmd : ref.types.uint8,
  id: ref.types.uint16,
}, {packed: true});

const StructSetTimelineHdr = StructType({
  cmd : ref.types.uint8,
  dayOffset : ref.types.int8,
  count : ref.types.uint8,
}, {packed: true});

const StructTimelineEntry = StructType({
  startTime: ref.types.uint16,
  endTime: ref.types.uint16,
}, {packed: true});

const StructDuration = StructType({
  cmd : ref.types.uint8,
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
  duration: ref.types.uint16,
}, {packed: true});

const StructTimepoint = StructType({
  cmd : ref.types.uint8,
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
}, {packed: true});

const StructSetMeetingInfoHdr = StructType({
  cmd: ref.types.uint8,
  subjectLen: ref.types.uint8,
  organizerLen: ref.types.uint8,
}, {packed: true});

const StructSetMeetingBodyHdr = StructType({
  cmd: ref.types.uint8,
  len: ref.types.uint8,
}, {packed: true});

const StructSetErrorCode = StructType({
  cmd: ref.types.uint8,
  id: ref.types.uint8,
}, {packed: true});

export class MessageBuilder {
  public static readonly BROADCAST_ADDR = 0xFF;

  public static buildBroadcastTarget(payload: number): Buffer {
    return MessageBuilder.buildTarget(MessageBuilder.BROADCAST_ADDR, payload);
  }

  public static buildTarget(dest: number, payload: number): Buffer {
    return new StructSetAddress({
      cmd : Outgoing.SET_ADDRESS,
      addr : dest,
      length : payload,
    }).ref();
  }

  public static buildRoomName(name: string): Buffer[] {
    const utf8 = Buffer.from(name);
    const len = utf8.byteLength > 255 ? 255 : utf8.byteLength;
    return [new StructSetRoomNameHdr({cmd: Outgoing.SET_ROOM_NAME, len}).ref(),
      utf8];
  }

  public static buildExpectedFirmwareVersion(): Buffer {
    return new StructFirmwareVersion({
      cmd: Outgoing.SET_EXPECTED_FIRMWARE_VERSION,
      major: 0,
      minor: 1,
    }).ref();
  }

  public static buildTimeFormat(militaryFormat: boolean): Buffer {
    return new StructSetTimeFormat({
      cmd: Outgoing.SET_TIME_FORMAT,
      militaryFormat,
    }).ref();
  }

  public static buildLangID(lang: LANG_ID): Buffer {
    return new StructSetLang({
      cmd: Outgoing.SET_LANGID,
      lang,
    }).ref();
  }

  public static buildTime(): Buffer {
    const date = new Date();
    const YEAR_OFFSET: number = 2017;
    const year: number = date.getFullYear() - YEAR_OFFSET;
    if (year > 2080) {
      throw(new Error("Year beyond 2080 is not supported"));
    }
    const month: number  = date.getMonth();
    const day: number = date.getDate();
    const seconds: number = date.getSeconds() +
      date.getMinutes() * 60 +
      date.getHours() * 60 * 60;
    const now: number = (day << 17) | (month << 22) | (year << 26) | seconds;

    return new StructSetLocalTime({
      cmd: Outgoing.SET_LOCAL_TIME,
      time: now,
    }).ref();
  }

  public static buildUUID(): Buffer {
    return new StructGetUUID({
      cmd: Outgoing.GET_UUID,
    }).ref();
  }

  public static buildUnconfiguredID(id: number): Buffer {
    return new StructUnconfiguredID({
      cmd: Outgoing.SET_UNCONFIGURED_ID,
      id,
    }).ref();
  }

  public static buildTimeline(entries: ITimelineEntry[], id: number):
  Buffer[] {
    const now = moment();
    const pm = Number(now.format("HH")) >= 12;
    const dayStart = moment(id).startOf("day");
    const dayOffset = dayStart.diff(now.startOf("day"), "days");
    const getMinutes =
      (epoch: number) => moment(epoch).diff(dayStart, "minutes");
    if (dayOffset < -128 || dayOffset > 127) {
      throw(new Error("Wrong dayOffset:" + dayOffset));
    }

    return [new StructSetTimelineHdr({
        cmd: Outgoing.SET_TIMELINE,
        dayOffset,
        count: entries.length,
      }).ref(),
      ...entries.map((i) => {
        return new StructTimelineEntry({
          startTime: getMinutes(i.start) | (pm ? (1 << 11) : 0),
          endTime: getMinutes(i.end),
        }).ref();
      }),
    ];
  }

  public static buildMeetingInfo(info: IMeetingInfo): Buffer[] {
    const subject = Buffer.from(info.subject);
    const organizer = Buffer.from(info.organizer);
    const subjectLen = subject.byteLength > 255 ? 255 : subject.byteLength;
    const organizerLen =
      organizer.byteLength > 255 ? 255 : organizer.byteLength;

    return [new StructSetMeetingInfoHdr({
        cmd: Outgoing.SET_MEETING_INFO,
        subjectLen,
        organizerLen,
      }).ref(),
      subject, organizer];
  }

  public static buildAddMeeting(entry: ITimelineEntry): Buffer {
    return MessageBuilder.buildDuration(Outgoing.ON_ADD_MEETING, entry);
  }

  public static buildMeetingEndTimeChanged(entry: ITimelineEntry): Buffer {
    return MessageBuilder.buildDuration(
      Outgoing.ON_MEETING_END_TIME_CHANGED, entry);
  }

  public static buildDeleteMeeting(id: number): Buffer {
    return MessageBuilder.buildTimepoint(Outgoing.ON_DEL_MEETING, id);
  }

  public static buildUpdateMeeting(id: number): Buffer {
    return MessageBuilder.buildTimepoint(Outgoing.ON_UPDATE_MEETING, id);
  }

  public static buildErrorCode(id: ErrorCode): Buffer {
    log.silly(`Build errorcode ${id.toString(16)}: ${ErrorCode[id]}`);
    return new StructSetErrorCode({
      cmd: Outgoing.SET_ERROR_CODE,
      id,
    }).ref();
  }

  public static buildAccessRight(panl: IPanlConfig): Buffer {
    return new StructAccessRight({
      cmd: Outgoing.SET_ACCESS_RIGHT,
      featureDisabled: MessageBuilder.convertBitArray(panl.featureDisabled),
      authAllowPasscode: MessageBuilder.convertBitArray(panl.authAllowPasscode),
      authAllowRFID: MessageBuilder.convertBitArray(panl.authAllowRFID),
    }).ref();
  }

  private static buildDuration(cmd: Outgoing, entry: ITimelineEntry): Buffer {
    const tp = MessageBuilder.epochToOffset(entry.start);
    let duration = moment(entry.end).diff(moment(entry.start), "minutes");
    if (duration > 65535) {
      duration = 65535;
    }
    return new StructDuration({
      cmd,
      dayOffset: tp.dayOffset,
      minutesOfDay: tp.minutesOfDay,
      duration,
    }).ref();
  }

  private static buildTimepoint(cmd: Outgoing, id: number): Buffer {
    const tp = MessageBuilder.epochToOffset(id);
    return new StructTimepoint({
      cmd,
      dayOffset: tp.dayOffset,
      minutesOfDay: tp.minutesOfDay,
    }).ref();
  }

  private static convertBitArray<T>(obj: any): number {
    let i = 0;
    let val = 0;
    for (const key of Object.keys(obj)) {
      if (obj[key]) {
        val += 1 << i;
      }
      i++;
    }
    return val;
  }

  private static epochToOffset(id: number): ITimePoint {
    const ts = moment(id);
    const now = moment();
    const dayOffset = ts.startOf("day").diff(now.startOf("day"), "days");
    if (dayOffset < -128 || dayOffset > 127) {
      throw(new Error("Invalid dayOffset " + dayOffset));
    }
    let minutesOfDay = ts.diff(ts.clone().startOf("day"), "minutes");
    if (minutesOfDay >= 24 * 60) {
      throw(new Error(`minutesOfDay ${minutesOfDay} not within today`));
    }
    if (Number(now.format("HH")) >= 12) {
      minutesOfDay |= 1 << 11;
    }
    return {dayOffset, minutesOfDay};
  }
}
