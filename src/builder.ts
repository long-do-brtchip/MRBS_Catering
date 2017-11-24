import ref = require("ref");
import StructType = require("ref-struct");
import {IMeetingInfo, ITimelineEntry, ITimePoint} from "./calendar";
import {IHubConfig, IPanlConfig} from "./persist";

export enum ErrorCode {
  ERROR_SUCCESS,
  ERROR_AUTH_ERROR,
  ERROR_FEATURE_DISABLED,
  ERROR_CERTIFICATE,
  ERROR_NETWORK,
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
  ON_EXTEND_MEETING,
  ON_ADD_MEETING,
  ON_DEL_MEETING,
  ON_UPDATE_MEETING,
  SET_MEETING_INFO,
  SET_MEETING_BODY,
  SET_ERROR_CODE,
  GET_UUID,
  SET_UNCONFIGURED_ID,
}

enum LANG_ID {
  EN,
  CN,
  JP,
  KR,
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

const StructAddMeeting = StructType({
  cmd : ref.types.uint8,
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
  duration: ref.types.uint16,
}, {packed: true});

const StructExtendMeeting = StructType({
  cmd : ref.types.uint8,
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
  newDuration: ref.types.uint16,
}, {packed: true});

const StructDeleteMeeting = StructType({
  cmd : ref.types.uint8,
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
}, {packed: true});

const StructUpdateMeeting = StructType({
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
    return [new StructSetRoomNameHdr({
        cmd: Outgoing.SET_ROOM_NAME,
        len: utf8.byteLength,
      }).ref(),
      utf8];
  }

  public static buildExpectedFirmwareVersion(): Buffer {
    return new StructFirmwareVersion({
      cmd: Outgoing.SET_EXPECTED_FIRMWARE_VERSION,
      major: 1,
      minor: 1,
    }).ref();
  }

  public static buildTimeFormat(): Buffer {
    return new StructSetTimeFormat({
      cmd: Outgoing.SET_TIME_FORMAT,
      militaryFormat: false,
    }).ref();
  }

  public static buildLangID(): Buffer {
    return new StructSetLang({
      cmd: Outgoing.SET_LANGID,
      lang: LANG_ID.EN,
    }).ref();
  }

  public static buildTime(): Buffer {
    const date = new Date();
    const YEAR_OFFSET: number = 2017;
    const year: number = date.getFullYear() - YEAR_OFFSET;
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

  public static buildTimeline(entries: ITimelineEntry[], dayOffset: number):
  Buffer[] {
    return [new StructSetTimelineHdr({
        cmd: Outgoing.SET_TIMELINE,
        dayOffset,
        count: entries.length,
      }).ref(),
      ...entries.map((i) => {
        return new StructTimelineEntry({
          startTime: i.start,
          endTime: i.end,
        }).ref();
      }),
    ];
  }

  public static buildMeetingInfo(info: IMeetingInfo): Buffer[] {
    const subject = Buffer.from(info.subject);
    const organizer = Buffer.from(info.organizer);

    return [new StructSetMeetingInfoHdr({
        cmd: Outgoing.SET_MEETING_INFO,
        subjectLen: subject.byteLength,
        organizerLen: organizer.byteLength,
      }).ref(),
      subject, organizer];
  }

  public static buildAddMeeting(id: ITimePoint, duration: number): Buffer {
    return new StructAddMeeting({
      cmd: Outgoing.ON_ADD_MEETING,
      dayOffset: id.dayOffset,
      minutesOfDay: id.minutesOfDay,
      duration,
    }).ref();
  }

  public static buildExtendMeeting(id: ITimePoint, newDuration: number):
  Buffer {
    return new StructExtendMeeting({
      cmd: Outgoing.ON_EXTEND_MEETING,
      dayOffset: id.dayOffset,
      minutesOfDay: id.minutesOfDay,
      newDuration,
    }).ref();
  }

  public static buildDeleteMeeting(id: ITimePoint): Buffer {
    return new StructDeleteMeeting({
      cmd: Outgoing.ON_DEL_MEETING,
      dayOffset: id.dayOffset,
      minutesOfDay: id.minutesOfDay,
    }).ref();
  }

  public static buildUpdateMeeting(id: ITimePoint): Buffer {
    return new StructUpdateMeeting({
      cmd: Outgoing.ON_UPDATE_MEETING,
      dayOffset: id.dayOffset,
      minutesOfDay: id.minutesOfDay,
    }).ref();
  }

  public static buildErrorCode(id: ErrorCode): Buffer {
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
}
