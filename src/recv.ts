import {EventEmitter} from "events";
import ref = require("ref");
import StructType = require("ref-struct");
import {ITimelineRequest} from "./calender";
import {PanLPath} from "./path";

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
}

const StructAuthByPasscode = StructType({
  passcode : ref.types.uint32,
}, {packed: true});

const StructTimeline = StructType({
  offset: ref.types.int8,
  time: ref.types.int16,
  count: ref.types.uint8,
}, {packed: true});

const StructTime = StructType({
  minutes: ref.types.uint16,
}, {packed: true});

const StructTimespan = StructType({
  start: ref.types.uint16,
  end: ref.types.uint16,
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
    throw new Error(`Invalid message length, expect at least ${min}, ` +
      `but only got ${buffer.length}`);
  }

  public path: PanLPath;

  constructor(private event: EventEmitter, id: number) {
    this.path = new PanLPath(id, 0);
    this.notify("agentConnected");
  }

  public notify(evt: string, ...args: any[]): void {
    this.event.emit(evt, this.path, ...args);
  }

  public onData(buffer: Buffer): void {
    let next = MessageParser.verifyLength(buffer, 1);
    let getBody = false;

    do {
      const id = buffer[0];

      switch (id) {
        case Incoming.REQUEST_FIRMWARE:
          this.notify("requestFirmware");
          break;
        case Incoming.AUTH_BY_PASSCODE:
          next = MessageParser.verifyLength(buffer, StructAuthByPasscode.size);
          this.notify("auth", StructAuthByPasscode(buffer).passcode);
          break;
        case Incoming.AUTH_BY_RFID:
          throw new Error("Method not implemented.");
        case Incoming.SET_ADDRESS:
          next = MessageParser.verifyLength(buffer, 1);
          this.path.dest = buffer[0];
          break;
        case Incoming.REPORT_UUID:
          next = MessageParser.verifyLength(buffer, 8);
          this.notify("uuid", next);
          break;
        case Incoming.REPORT_DEVICE_CHANGE:
          this.notify("deviceChange");
          break;
        case Incoming.REPORT_PANL_STATUS:
          next = MessageParser.verifyLength(buffer, 1);
          this.notify("status", buffer[0]);
          break;
        case Incoming.GET_LOCAL_TIME:
          this.notify("gettime");
          break;
        case Incoming.GET_TIMELINE: {
          next = MessageParser.verifyLength(buffer, StructTimeline.size);
          const tl = StructTimeline(buffer);
          const req: ITimelineRequest = {
            dayOffset: tl.offset,
            lookForward: tl.time >= 0,
            maxCount: tl.count,
            startTime: Math.abs(tl.time),
          };
          this.notify("getTimeline", req);
          break;
        }
        case Incoming.GET_MEETING_BODY:
          getBody = true;
          break;
        case Incoming.GET_MEETING_INFO: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          this.notify("getMeetingInfo", StructTime(buffer).minutes, getBody);
          getBody = false;
          break;
        }
        case Incoming.EXTEND_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTimespan.size);
          const span = StructTimespan(buffer);
          this.notify("extendMeeting", span.start, span.end);
          break;
        }
        case Incoming.CANCEL_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          this.notify("cancelMeeting", StructTime(buffer).minutes);
          break;
        }
        case Incoming.END_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          this.notify("endMeeting", StructTime(buffer).minutes);
          break;
        }
        case Incoming.CANCEL_UNCLAIM_MEETING: {
          next = MessageParser.verifyLength(buffer, StructTime.size);
          this.notify("cancelUnclaimedMeeting", StructTime(buffer).minutes);
          break;
        }
        case Incoming.CREATE_BOOKING: {
          next = MessageParser.verifyLength(buffer, StructTimespan.size);
          const span = StructTimespan(buffer);
          this.notify("createBooking", span.start, span.end);
          break;
        }
        default:
          throw new Error("Unknown Incoming ID.");
      }
      buffer = next;
    } while (buffer.length);
  }
}
