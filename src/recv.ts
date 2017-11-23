import ref = require("ref");
import StructType = require("ref-struct");
import {ITimelineRequest, ITimePoint} from "./calendar";
import {log} from "./log";
import {PanLPath} from "./path";
import {IAgentEvent, IPanLEvent} from "./service";

enum Incoming {
  REPORT_AGENT_ID, // 8
  REPORT_UUID, // 8
  REPORT_PANL_STATUS, // 1
  REPORT_DEVICE_CHANGE,
  REQUEST_FIRMWARE,
  AUTH_BY_PASSCODE, // 4
  AUTH_BY_RFID,
  GET_LOCAL_TIME,
  SET_ADDRESS, // 1
  GET_TIMELINE, // 4
  GET_MEETING_BODY,
  GET_MEETING_INFO, // 2
  EXTEND_MEETING, // 4
  CANCEL_MEETING, // 2
  END_MEETING, // 2
  CANCEL_UNCLAIM_MEETING, // 2
  CREATE_BOOKING, // 4
  CHECK_CLAIM_MEETING,
}

const StructAuthByPasscode = StructType({
  passcode : ref.types.uint32,
}, {packed: true});

const StructTimeline = StructType({
  offset: ref.types.int8,
  time: ref.types.int16,
  count: ref.types.uint8,
}, {packed: true});

const StructGetMeetingInfo = StructType({
  minutes: ref.types.uint16,
}, {packed: true});

const StructTime = StructType({
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
}, {packed: true});

const StructTimespan = StructType({
  dayOffset: ref.types.int8,
  minutesOfDay: ref.types.uint16,
  duration: ref.types.uint16,
}, {packed: true});

const StructReportAgent = StructType({
  id: ref.types.uint8,
  uid: ref.types.uint64,
}, {packed: true});

export class MessageParser {
  public static async parseAgentID(buffer: Buffer): Promise<Buffer> {
    const buf = StructReportAgent(buffer);
    if (buffer.length !== StructReportAgent.size ||
      buf.id !== Incoming.REPORT_AGENT_ID) {
      throw new Error("Invalid client");
    }
    return buffer.slice(1);
  }

  private static verifyLength(buffer: Buffer, min: number): Buffer {
    if (buffer.length >= min) {
      return buffer.slice(min);
    }
    // TODO: concat to next buffer
    throw new Error(`Invalid message length, expect at least ${min}, ` +
      `but only got ${buffer.length}`);
  }

  private path: PanLPath;
  private getBody = false;

  constructor(private agentEvt: IAgentEvent, private panlEvt: IPanLEvent,
              public id: number) {
    log.silly(`Create MessageParser for agent ${this.id}`);
    this.agentEvt.onAgentConnected(id);
  }

  public async onData(buffer: Buffer): Promise<void> {
    while (buffer.byteLength) {
      const id = buffer[0];
      let next = buffer = buffer.slice(1);

      switch (id) {
        case Incoming.REQUEST_FIRMWARE:
          await this.panlEvt.onRequestFirmware(this.path);
          break;
        case Incoming.AUTH_BY_PASSCODE:
          next = MessageParser.verifyLength(buffer, StructAuthByPasscode.size);
          await this.panlEvt.onPasscode(this.path,
            StructAuthByPasscode(buffer).passcode);
          break;
        case Incoming.AUTH_BY_RFID:
          throw new Error("Method not implemented.");
        case Incoming.SET_ADDRESS:
          next = MessageParser.verifyLength(buffer, 1);
          this.path = new PanLPath(this.id, buffer[0]);
          break;
        case Incoming.REPORT_UUID:
          next = MessageParser.verifyLength(buffer, 8);
          this.panlEvt.onReportUUID(this.path, buffer.slice(0, 8));
          break;
        case Incoming.REPORT_DEVICE_CHANGE:
          await this.agentEvt.onDeviceChange(this.id);
          break;
        case Incoming.REPORT_PANL_STATUS:
          next = MessageParser.verifyLength(buffer, 1);
          await this.panlEvt.onStatus(this.path, buffer[0]);
          break;
        case Incoming.GET_LOCAL_TIME:
          this.panlEvt.onGetTime(this.path);
          break;
        case Incoming.GET_TIMELINE: {
          next = MessageParser.verifyLength(buffer, StructTimeline.size);
          const tl = StructTimeline(buffer);
          const req: ITimelineRequest = {
            id: {dayOffset: tl.offset, minutesOfDay: Math.abs(tl.time)},
            lookForward: tl.time >= 0,
            maxCount: tl.count,
          };
          await this.panlEvt.onGetTimeline(this.path, req);
          break;
        }
        case Incoming.GET_MEETING_BODY:
          this.getBody = true;
          break;
        case Incoming.GET_MEETING_INFO: {
          next = MessageParser.verifyLength(buffer, StructGetMeetingInfo.size);
          this.panlEvt.onGetMeetingInfo(this.path,
            StructGetMeetingInfo(buffer).minutes, this.getBody);
          this.getBody = false;
          break;
        }
        case Incoming.EXTEND_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTimespan.size);
          const span = StructTimespan(buffer);
          const point: ITimePoint = {
            dayOffset: span.dayOffset,
            minutesOfDay: span.minutesOfDay,
          };
          await this.panlEvt.onExtendMeeting(this.path, point, span.duration);
          break;
        }
        case Incoming.CREATE_BOOKING: {
          next = MessageParser.verifyLength(buffer, StructTimespan.size);
          const span = StructTimespan(buffer);
          const point: ITimePoint = {
            dayOffset: span.dayOffset,
            minutesOfDay: span.minutesOfDay,
          };
          await this.panlEvt.onCreateBooking(this.path, point, span.duration);
          break;
        }
        case Incoming.CANCEL_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          const when = StructTime(buffer);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onCancelMeeting(this.path, point);
          break;
        }
        case Incoming.END_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          const when = StructTime(buffer);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onEndMeeting(this.path, point);
          break;
        }
        case Incoming.CANCEL_UNCLAIM_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          const when = StructTime(buffer);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onCancelUnclaimedMeeting(this.path, point);
          break;
        }
        case Incoming.CHECK_CLAIM_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          const when = StructTime(buffer);
          const point: ITimePoint = {
            dayOffset: when.dayOffset,
            minutesOfDay: when.minutesOfDay,
          };
          await this.panlEvt.onCheckClaimMeeting(this.path, point);
          break;
        }
        default:
          throw new Error("Unknown Incoming ID.");
      }
      buffer = next;
    }
  }
}
