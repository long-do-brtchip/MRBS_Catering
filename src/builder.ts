import ref = require("ref");
import StructType = require("ref-struct");
import {IMeetingInfo, ITimeline, ITimelineEntry} from "./calender";

enum Outgoing {
  SET_ADDRESS, // 3
  SET_POWER_OFF, // 1
  SET_TIMEOUT, // 1
  SET_LOCAL_TIME, // 4
  SET_TIME_FORMAT, // 1
  SET_EXPECTED_FIRMWARE_VERSION, // 2
  WRITE_ASSERTS, // [6, )
  WRITE_FIRMWARE, // [4, )
  SET_LANGID, // 1
  SET_ROOM_SIZE, // 2
  SET_ROOM_EQUIPMENTS, // 1
  SET_ACCESS_RIGHT, // 1
  SET_HARDWARE_FEATURE, // 1
  SET_BACKLIGHT, // 1
  SET_ROOM_NAME, // [1, )
  SET_TIMELINE, // [2, )
  UPDATE_TIMELINE, // 6
  SET_MEETING_INFO, // [2, )
  SET_MEETING_BODY, // [1, )
  SET_ERROR_CODE, // 1
  GET_UUID,
  SET_UNCONFIGURED_ID, // 2
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

const StructFirmwareVersion = StructType({
  cmd : ref.types.uint8,
  major: ref.types.uint8,
  minor: ref.types.uint8,
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

const StructSetTime = StructType({
  cmd : ref.types.uint8,
  time : ref.types.uint32,
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

  public static buildRoomName(name: string): Buffer {
    throw new Error("Method not implemented.");
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

    return new StructSetTime({
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
    throw new Error("Method not implemented.");
  }

  public static buildTimeline(timeline: ITimeline): Buffer {
    throw new Error("Method not implemented.");
  }

  public static buildMeetingInfo(info: IMeetingInfo): Buffer {
    throw new Error("Method not implemented.");
  }

  public static buildUpdateTimeline(
    preivous: number, now: ITimelineEntry): Buffer {
    throw new Error("Method not implemented.");
  }
}
