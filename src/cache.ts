import * as redis from "ioredis";
import {
  IMeetingInfo, ITimelineEntry,
  ITimelineRequest, ITimePoint,
} from "./calendar";
import {Database} from "./database";
import {Room} from "./entity/hub/room";
import {log} from "./log";
import {PanLPath} from "./path";
import {Persist} from "./persist";
import {Time} from "./time";

declare type PendingHandler = (path: PanLPath) => void;

export class Cache {
  public static async getInstance(): Promise<Cache> {
    if (Cache.instance !== undefined) {
      Cache.instance.addRef();
      return Cache.instance;
    }

    return new Promise<Cache>((resolve, reject) => {
      const client = new redis();
      client.on("ready", async () => {
        log.verbose("Redis connection creted");
        client.set(Cache.SEQUENCE_KEY, 0);
        const db = await Database.getInstance();
        const config = await Persist.getHubConfig();
        await db.stop();

        const observer = new redis();
        observer.on("ready", async () => {
          await observer.config("SET", "notify-keyspace-events", "Ex");
          await observer.psubscribe("__keyevent@0__:expired");
          Cache.instance = new Cache(client, observer);
          Cache.instance.setExpiry(config.expiry);
          resolve(Cache.instance);
        });
        observer.on("error", (error) => {
          log.silly("Redis observer error");
          client.quit();
          reject(error);
        });
      });
      client.on("error", (error) => {
        log.silly("Redis error");
        reject(error);
      });
    });
  }

  private static instance: Cache | undefined;

  private static readonly SEQUENCE_KEY: string = "sequence";
  private static readonly PENDING_KEY: string = "pending";
  private static readonly SHADOW_PREFIX = "shadow:";
  private static readonly TIMELINE_PREFIX = "timeline";
  private static readonly MEETING_PREFIX = "meeting";
  private static readonly MEETINGID_PREFIX = "meeting_id";

  private static pathToIdKey(path: PanLPath): string {
    return `path-id:${path.uid}`;
  }

  private static idToUuidKey(idx: number): string {
    return `id-uuid:${idx}`;
  }

  private static idToPathKey(idx: number): string {
    return `id-path:${idx}`;
  }

  private static addressKey(path: PanLPath): string {
    return `address:${path.uid}`;
  }

  private static nameKey(path: PanLPath): string {
    return `name:${path.uid}`;
  }

  private static agentKey(agent: number): string {
    return `agent:${agent}`;
  }

  private static dayOffsetKey(path: PanLPath): string {
    return `day_offset:${path.uid}`;
  }

  private static authKey(path: PanLPath): string {
    return `auth:${path}`;
  }

  private static meetingUID(path: PanLPath, id: ITimePoint): string {
    const dateStr = Time.dayOffsetToString(id.dayOffset);
    return `:${path.uid}:${dateStr}:${id.minutesOfDay}`;
  }

  private static hashMeetingKey(path: PanLPath, id: ITimePoint):
  string {
    return Cache.MEETING_PREFIX + Cache.meetingUID(path, id);
  }

  private static hashMeetingIdKey(path: PanLPath, id: ITimePoint):
  string {
    return Cache.MEETINGID_PREFIX + Cache.meetingUID(path, id);
  }

  private static hashTimelineKey(path: PanLPath, id: ITimePoint):
  string {
    return Cache.TIMELINE_PREFIX + Cache.meetingUID(path, id);
  }

  private expiry = 0;

  private constructor(private client: redis.Redis,
                      private observer: redis.Redis,
                      private refCnt = 1) {
    this.setOnKeyExpired();
  }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      log.silly("Close redis connection");
      await this.observer.quit();
      await this.client.quit();
      Cache.instance = undefined;
    }
  }

  public async addPending(path: PanLPath): Promise<void> {
    await this.client.sadd(Cache.PENDING_KEY, JSON.stringify(path));
  }

  public async consumePending(callback: PendingHandler): Promise<void> {
    const list = await this.client.smembers(
      Cache.PENDING_KEY).map((i: string) => {
      const t = JSON.parse(i);
      return new PanLPath(t.agentID, t.mstpAddress);
    });

    for (const path of list) {
      callback(path);
    }
    this.client.del(Cache.PENDING_KEY);
  }

  public async addConfigured(path: PanLPath, room: Room): Promise<void> {
    if (await this.client.exists(Cache.pathToIdKey(path))) {
      const id = await this.client.get(Cache.pathToIdKey(path));
      this.client.del(Cache.pathToIdKey(path));
      this.client.del(Cache.idToPathKey(id));
      this.client.del(Cache.idToUuidKey(id));
    }
    await Promise.all([
      this.client.set(Cache.nameKey(path), room.name),
      this.client.set(Cache.addressKey(path), room.address),
      this.client.sadd(Cache.agentKey(path.agent), path.dest),
    ]);
  }

  public async addUnconfigured(path: PanLPath, uuid: Buffer): Promise<number> {
    if (await this.client.exists(Cache.pathToIdKey(path))) {
      const id = await this.client.get(Cache.pathToIdKey(path));
      await this.client.set(Cache.idToUuidKey(id), uuid);
      return id;
    }
    const idx = await this.client.incr(Cache.SEQUENCE_KEY) as number;
    await Promise.all([
      this.client.set(Cache.idToUuidKey(idx), uuid),
      this.client.set(Cache.idToPathKey(idx), JSON.stringify(path)),
      this.client.set(Cache.pathToIdKey(path), idx),
    ]);
    return idx;
  }

  public async getUnconfigured(idx: number):
  Promise<[PanLPath, Buffer] | undefined> {
    const [pathStr, buf] = await Promise.all([
      this.client.get(Cache.idToPathKey(idx)),
      this.client.getBuffer(Cache.idToUuidKey(idx)),
    ]);
    if (pathStr == null || buf == null) {
      return undefined;
    } else {
      const path = JSON.parse(pathStr);
      return [new PanLPath(path.agentID, path.mstpAddress), buf];
    }
  }

  public async removeAgent(agent: number): Promise<void> {
    const m = await this.client.smembers(Cache.agentKey(agent));
    await Promise.all(m.map(async (v: string) => {
      const path = new PanLPath(agent, Number(v));
      await Promise.all([
        this.client.srem(Cache.PENDING_KEY, path),
        this.client.del(Cache.nameKey(path)),
        this.client.del(Cache.addressKey(path)),
      ]);
    }));
    await this.client.del(Cache.agentKey(agent));
  }

  public async getRoomName(path: PanLPath): Promise<string> {
    const val = await this.client.get(Cache.nameKey(path));
    if (val === null) {
      throw(new Error(`Can't find room name for ${path}`));
    }
    return val;
  }

  public async getRoomAddress(path: PanLPath): Promise<string> {
    const val = await this.client.get(Cache.addressKey(path));
    if (val === null) {
      throw(new Error(`Can't find room address for ${path}`));
    }
    return val;
  }

  public async flush(): Promise<void> {
    this.client.flushdb();
  }

  public async setDayOffset(path: PanLPath, dayOffset: number): Promise<void> {
    await this.client.set(Cache.dayOffsetKey(path), dayOffset);
  }

  public async getDayOffset(path: PanLPath): Promise<number> {
    const val = this.client.get(Cache.dayOffsetKey(path));
    if (val === null) {
      return 0;
    }
    return Number(val);
  }

  public async setTimeline(path: PanLPath, dayOffset: number,
                           entries: ITimelineEntry[] | any[]): Promise<void> {
    const pipeline: redis.Pipeline = this.client.pipeline();
    const expiry: number = (dayOffset === 0) ?
      Time.restDaySeconds() : this.expiry;

    for (const entry of entries) {
      // create pattern key
      const point: ITimePoint = {
        dayOffset,
        minutesOfDay: entry.start,
      };
      const timelineKeys = Cache.hashTimelineKey(path, point);
      const shadowKey = Cache.SHADOW_PREFIX + timelineKeys;
      // save hash timeline
      pipeline.hmset(timelineKeys, entry);
      pipeline.set(shadowKey, "");
      pipeline.expire(shadowKey, expiry);
    }

    // execute all command async
    await pipeline.exec();
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[] | undefined> {
    // return undefined is never been cached
    // return zero length array if no meeting
    let result: ITimelineEntry[] = [];
    const dayStr: string = Time.dayOffsetToString(req.id.dayOffset);
    const keyFullDay: string[] = await this.scan(
      `${Cache.TIMELINE_PREFIX}:${path.uid}:${dayStr}:*`);

    if (!keyFullDay || !keyFullDay.length) {
      return;
    }

    const keys: string[] = Time.filterTimeLineKeys(keyFullDay, req);
    if (!keys || !keys.length) {
      return result;
    }

    const pipeline: redis.Pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    // [[error, ITimelineEntry], [error, ITimelineEntry]]
    const response: any[][] = await pipeline.exec();

    result = response.map((val) => {
      return {
        start: parseInt(val[1].start, 10),
        end: parseInt(val[1].end, 10),
      };
    });

    // update expiry time of full day
    this.updateTimelineExpiryTime(path, req.id.dayOffset);

    return result;
  }

  public async setTimelineEntry(path: PanLPath, id: ITimePoint,
                                duration: number) {
    const key: string = Cache.hashTimelineKey(path, id);
    const shadowKey: string = Cache.SHADOW_PREFIX + key;

    const timelineEntry = {
      start: id.minutesOfDay,
      end: id.minutesOfDay + duration,
    };

    const expiry = id.dayOffset === 0 ? Time.restDaySeconds() : this.expiry;
    await Promise.all([
      this.client.hmset(key, timelineEntry),
      this.client.set(shadowKey, ""),
      this.client.expire(shadowKey, expiry),
    ]);
  }

  public async removeTimelineEntry(path: PanLPath, id: ITimePoint):
  Promise<void> {
    const uid = Cache.meetingUID(path, id);
    await this.removeTimelineEntryAndRelatedInfo(uid);
  }

  public async setMeetingInfo(path: PanLPath, id: ITimePoint,
                              info: IMeetingInfo): Promise<void> {
    const key: string = Cache.hashMeetingKey(path, id);
    await this.client.hmset(key, info);
  }

  public async getMeetingInfo(path: PanLPath, id: ITimePoint):
  Promise<IMeetingInfo> {
    const key = Cache.hashMeetingKey(path, id);
    const result: IMeetingInfo = await this.client.hgetall(key);
    if (!result || Object.keys(result).length === 0) {
      throw new Error("Meeting info not found");
    }

    return result;
  }

  public async getMeetingId(path: PanLPath, id: ITimePoint):
  Promise<string> {
    const key = Cache.hashMeetingIdKey(path, id);
    const result: string = await this.client.get(key);
    if (!result) {
      throw(new Error("Meeting Id not found"));
    }

    return result;
  }

  public async setMeetingId(path: PanLPath, id: ITimePoint, meetingId: string):
  Promise<void> {
    const key = Cache.hashMeetingIdKey(path, id);
    await this.client.set(key, meetingId);
  }

  public setExpiry(val: number): void {
    this.expiry = val;
  }

  public async setAuthSuccess(path: PanLPath, email: string): Promise<void> {
    await this.client.set(Cache.authKey(path), email, "ex", 3);
  }

  public async getAuth(path: PanLPath): Promise<string> {
    const key = Cache.authKey(path);
    if (await this.client.exists(key)) {
      const email = await this.client.get(key);
      await this.client.del(key);
      return email;
    } else {
      return "";
    }
  }

  private scan(pattern: string): Promise<string[]> {
    const self = this.client;
    return new Promise((resolve) => {
      const stream = self.scanStream({
        // only returns keys following the pattern of `user:*`
        match: pattern,
        // returns approximately 100 elements per call2
        count: 100,
      });

      const keys: string[] = [];
      stream.on("data", (resultKeys) => {
        // `resultKeys` is an array of strings representing key names
        for (const val of resultKeys) {
          keys.push(val);
        }
      });

      stream.on("end", () => {
        resolve(keys);
      });
    });
  }

  private async updateTimelineExpiryTime(path: PanLPath, dayOffset: number):
  Promise<void> {
    // not today will update cache
    if (dayOffset === 0) {
      return;
    }
    const dayStr: string = Time.dayOffsetToString(dayOffset);
    // Meetings corresponding to a timeline shall be purged out
    const shadowKey: string[] = await this.scan(Cache.SHADOW_PREFIX +
      `${Cache.TIMELINE_PREFIX}:${path.uid}:${dayStr}:*`);

    const pipeline: redis.Pipeline = this.client.pipeline();
    if (shadowKey && shadowKey.length) {
      for (const key of shadowKey) {
        pipeline.expire(key, this.expiry);
      }
    }

    // execute all command
    await pipeline.exec();
  }

  private setOnKeyExpired() {
    const starts = (Cache.SHADOW_PREFIX + Cache.TIMELINE_PREFIX).length;
    this.observer.on("pmessage",  (pattern, channel, key) => {
      const uid = key.slice(starts);
      if (!uid) {
        return;
      }
      log.debug("expired: ", uid);
      this.removeTimelineEntryAndRelatedInfo(uid);
    });
  }

  private async removeTimelineEntryAndRelatedInfo(uid: string): Promise<void> {
    await Promise.all([
      this.client.del(Cache.MEETINGID_PREFIX + uid),
      this.client.del(Cache.MEETING_PREFIX + uid),
      this.client.del(Cache.TIMELINE_PREFIX + uid),
    ]);
  }

  private addRef(): void {
    this.refCnt++;
  }
}
