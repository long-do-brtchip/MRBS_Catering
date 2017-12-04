import * as redis from "ioredis";
import moment = require("moment");
import {IMeetingInfo, ITimelineEntry, ITimelineRequest} from "./calendar";
import {Database} from "./database";
import {Room} from "./entity/hub/room";
import {log} from "./log";
import {PanLPath} from "./path";
import {Persist} from "./persist";

declare type PendingHandler = (path: PanLPath) => void;

export interface IRoomStatusChange {
  onRoomOnline(room: string): Promise<void>;
  onRoomOffline(room: string): Promise<void>;
}

export class Cache {
  public static async getInstance(): Promise<Cache> {
    if (Cache.instance) {
      Cache.instance.addRef();
      return Cache.instance;
    }

    return new Promise<Cache>((resolve, reject) => {
      const client = new redis();
      client.on("ready", async () => {
        log.verbose("Redis connection created");
        client.set(Cache.SEQUENCE_KEY, 0);
        const db = await Database.getInstance();
        const config = await Persist.getHubConfig();
        await db.stop();

        const observer = new redis();
        observer.on("ready", async () => {
          await observer.config("SET", "notify-keyspace-events", "Kgx");
          await observer.psubscribe(
            `${Cache.KEYSPACE0_PREFIX}${Cache.SHADOW_PREFIX}*`,
            `${Cache.KEYSPACE0_PREFIX}${Cache.PANLS_PREFIX}*`);
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

  private static instance: Cache;

  private static readonly SEQUENCE_KEY = "sequence";
  private static readonly PENDING_KEY = "pending";
  private static readonly MEETINGUID_KEY = "meetingid";
  private static readonly ROOMNAME_KEY = "roomname:";
  private static readonly PANLS_PREFIX = "panls:";
  private static readonly SHADOW_PREFIX = "shadow:";
  private static readonly TIMELINE_PREFIX = "timeline:";
  private static readonly MEETING_PREFIX = "meeting:";
  private static readonly KEYSPACE0_PREFIX = `__keyspace@0__:`;

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

  private static agentKey(agent: number): string {
    return `agent:${agent}`;
  }

  private static authKey(path: PanLPath): string {
    return `auth:${path.uid}`;
  }

  private static roomDateKey(addr: string, id: number): string {
    const mmt = moment(id);
    const date = mmt.format("YYYYMMDD");
    return `${addr}:${date}`;
  }

  private roomSubsribers: IRoomStatusChange[] = [];

  private constructor(private client: redis.Redis,
                      private observer: redis.Redis,
                      private refCnt = 1,
                      private expiry = 0) {
    this.keyspaceNotificationProcess();
  }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      log.silly("Close redis connection");
      await this.observer.quit();
      await this.client.quit();
      delete Cache.instance;
    }
  }

  public setExpiry(val: number): void {
    this.expiry = val;
  }

  public async addPending(path: PanLPath): Promise<void> {
    await this.client.sadd(Cache.PENDING_KEY, JSON.stringify(path));
  }

  public async consumePending(callback: PendingHandler): Promise<void> {
    const pending = await this.client.smembers(Cache.PENDING_KEY);
    if (!pending) {
      return;
    }
    const list = pending.map((i: string) => {
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
      const id = Number(await this.client.get(Cache.pathToIdKey(path)));
      this.client.del(Cache.pathToIdKey(path));
      this.client.del(Cache.idToPathKey(id));
      this.client.del(Cache.idToUuidKey(id));
    }
    if (!await this.client.exists(Cache.PANLS_PREFIX + room.address)) {
      for (const subscriber of this.roomSubsribers) {
        subscriber.onRoomOnline(room.address);
      }
    }
    await Promise.all([
      this.client.set(Cache.ROOMNAME_KEY + room.address, room.name),
      this.client.set(Cache.addressKey(path), room.address),
      this.client.sadd(Cache.agentKey(path.agent), path.dest),
      this.client.sadd(Cache.PANLS_PREFIX + room.address, JSON.stringify(path)),
    ]);
  }

  public async addUnconfigured(path: PanLPath, uuid: Buffer): Promise<number> {
    if (await this.client.exists(Cache.pathToIdKey(path))) {
      const id = Number(await this.client.get(Cache.pathToIdKey(path)));
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
    const pipeline: redis.Pipeline = this.client.pipeline();
    const m = await this.client.smembers(Cache.agentKey(agent));
    for (const v of m) {
      const path = new PanLPath(agent, Number(v));
      const room = await this.getRoomAddress(path);
      pipeline.srem(Cache.PANLS_PREFIX + room, JSON.stringify(path));
      pipeline.srem(Cache.PENDING_KEY, path);
      pipeline.del(Cache.ROOMNAME_KEY + await this.getRoomAddress(path));
      pipeline.del(Cache.addressKey(path));
    }
    await pipeline.del(Cache.agentKey(agent)).exec();
  }

  public async getRoomName(room: string): Promise<string> {
    const val = await this.client.get(Cache.ROOMNAME_KEY + room);
    if (val === null) {
      throw(new Error(`Can't find room name for ${room}`));
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

  public async getRoomPanLs(room: string): Promise<PanLPath[]> {
    const panls = await this.client.smembers(Cache.PANLS_PREFIX + room);
    const paths: PanLPath[] = [];
    for (const panl of panls) {
      const t = JSON.parse(panl);
      paths.push(new PanLPath(t.agentID, t.mstpAddress));
    }
    return paths;
  }

  public async getOnlineRooms(): Promise<string[]> {
    const panlRooms = await this.client.keys(Cache.PANLS_PREFIX + "*");

    const rooms = [];
    for (const room of panlRooms) {
      rooms.push(room.slice(Cache.PANLS_PREFIX.length));
    }
    return rooms;
  }

  public async subscribeRoomStatusChange(sub: IRoomStatusChange):
  Promise<void> {
    this.roomSubsribers.push(sub);
    const rooms = await this.getOnlineRooms();
    for (const room of rooms) {
      sub.onRoomOnline(room);
    }
  }

  public unsubscribeRoomStatusChange(sub: IRoomStatusChange) {
    this.roomSubsribers.splice(this.roomSubsribers.indexOf(sub), 1);
  }

  public async setTimeline(room: string, id: number,
                           entries: ITimelineEntry[]):
  Promise<void> {
    const key = Cache.TIMELINE_PREFIX + Cache.roomDateKey(room, id);

    const pipeline: redis.Pipeline = this.client.pipeline();
    pipeline.del(key);
    for (const entry of entries) {
      pipeline.zadd(key, entry.start.toString(), entry.end.toString());
    }
    await Promise.all([
      pipeline.exec(),
      this.setShadowKey(room, id),
    ]);
  }

  public async getTimeline(room: string, req: ITimelineRequest):
  Promise<ITimelineEntry[] | undefined> {
    // return undefined is never been cached
    // return zero length array if no meeting
    const entries: ITimelineEntry[] = [];
    const roomDate = Cache.roomDateKey(room, req.id);
    const key = Cache.TIMELINE_PREFIX + roomDate;
    const shadowKey = Cache.SHADOW_PREFIX + roomDate;

    if (req.maxCount === 0) {
      req.maxCount = 255;
    }
    if (!await this.client.exists(shadowKey)) {
      return undefined;
    }
    if (req.lookForward) {
      const ret = await this.client.zrangebyscore(key, req.id, "+inf",
        "WITHSCORES", "LIMIT", "0", req.maxCount.toString());
      for (let i = 0; i < ret.length; i += 2) {
        entries.push({start: Number(ret[i + 1]), end: Number(ret[i])});
      }
    } else {
      const ret = await this.client.zrevrangebyscore(key, `(${req.id}`, "-inf",
        "WITHSCORES", "LIMIT", "0", req.maxCount.toString());
      for (let i = 0; i < ret.length; i += 2) {
        entries.unshift({start: Number(ret[i + 1]), end: Number(ret[i])});
      }
    }

    this.setShadowKey(room, req.id);
    return entries;
  }

  public async isTimelineCachedForDay(room: string, id: number):
  Promise<boolean> {
    const roomDate = Cache.roomDateKey(room, id);
    const shadowKey = Cache.SHADOW_PREFIX + roomDate;
    return this.client.exists(shadowKey);
  }

  public async setTimelineEntry(room: string, entry: ITimelineEntry) {
    const pipeline: redis.Pipeline = this.client.pipeline();
    const key = Cache.TIMELINE_PREFIX + Cache.roomDateKey(room, entry.start);
    const del = pipeline.zremrangebyscore(key, entry.start, entry.start);
    await pipeline.zadd(key, entry.start.toString(),
                        entry.end.toString()).exec();
  }

  public async getTimelineEntryEndTime(room: string, id: number):
  Promise<number | undefined> {
    const roomDate = Cache.roomDateKey(room, id);
    const key = Cache.TIMELINE_PREFIX + roomDate;
    const ret = await this.client.zrangebyscore(key, id, id);
    return ret.length ? Number(ret[0]) : undefined;
  }

  public async removeTimelineEntry(room: string, id: number):
  Promise<void> {
    const roomDateKey = Cache.roomDateKey(room, id);
    // Remove for timeline
    const key = Cache.TIMELINE_PREFIX + roomDateKey;
    this.client.zremrangebyscore(key, id, id);
    // Remove meeting info
    this.client.hdel(Cache.MEETING_PREFIX + roomDateKey, id.toString());
    // Remove meeting UID
    try {
      const uid = await this.getMeetingUid(room, id);
      await this.client.zrem(Cache.MEETINGUID_KEY, uid);
      await this.client.zrem(`${Cache.MEETINGUID_KEY}:${room}`, uid);
    } catch (err) {
      log.debug(`Not able to find UID for ${roomDateKey}`);
    }
  }

  public async setMeetingInfo(room: string, id: number, info: IMeetingInfo):
  Promise<void> {
    const key = Cache.MEETING_PREFIX + Cache.roomDateKey(room, id);
    await this.client.hset(key, id.toString(), JSON.stringify(info));
  }

  public async getMeetingInfo(room: string, id: number):
  Promise<IMeetingInfo> {
    const key = Cache.MEETING_PREFIX + Cache.roomDateKey(room, id);
    const val = await this.client.hget(key, id.toString());
    if (!val) {
      throw new Error("Meeting info not found");
    }
    return JSON.parse(val);
  }

  public async setMeetingUid(room: string, id: number, meetingId: string):
  Promise<void> {
    const pipeline: redis.Pipeline = this.client.pipeline();
    // For getMeetingUid
    const key = `${Cache.MEETINGUID_KEY}:${room}`;
    pipeline.zadd(key, id.toString(), meetingId);
    await pipeline.exec();
  }

  public async getMeetingUid(room: string, id: number): Promise<string> {
    const key = `${Cache.MEETINGUID_KEY}:${room}`;
    const ret = await this.client.zrangebyscore(key, id, id, "LIMIT", "0", "1");
    if (ret.length === 0) {
      throw(new Error("Meeting Id not found"));
    }
    return ret[0];
  }

  public async getMeetingStartFromUid(room: string, uid: string):
  Promise<number> {
    return Number(
      await this.client.zscore(`${Cache.MEETINGUID_KEY}:${room}`, uid));
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

  private keyspaceNotificationProcess() {
    const startsShadow = Cache.KEYSPACE0_PREFIX + Cache.SHADOW_PREFIX;
    const startsPanls = Cache.KEYSPACE0_PREFIX + Cache.PANLS_PREFIX;

    this.observer.on("pmessage",  (pattern, key, action) => {
      if (action === "expired") {
        if (key.startsWith(startsShadow)) {
          const roomDate = key.slice(startsShadow.length);
          if (!roomDate) {
            return;
          }
          log.debug("expired: " + roomDate);
          this.removeTimelineEntriesAndRelatedInfo(roomDate);
        }
      } else if (action === "del") {
        if (key.startsWith(startsPanls)) {
          const room = key.slice(startsPanls.length);
          if (!room) {
            return;
          }
          log.debug(room + " offline");
          for (const subscriber of this.roomSubsribers) {
            subscriber.onRoomOffline(room);
          }
        }
      }
    });
  }

  private async removeTimelineEntriesAndRelatedInfo(roomDateKey: string):
  Promise<void> {
    const pipeline: redis.Pipeline = this.client.pipeline();
    // Remove timeline
    pipeline.del(Cache.TIMELINE_PREFIX + roomDateKey);
    // Remove meeting info
    const keys = await this.client.keys(
      Cache.MEETING_PREFIX + roomDateKey + "*");
    for (const i of keys) {
      pipeline.del(i);
    }
    // Remove meeting UID
    const [room, date] = roomDateKey.split(":");
    const start = moment(date);
    const uids = await this.client.zremrangebyscore(
      `${Cache.MEETINGUID_KEY}:${room}`,
      start.valueOf(), start.endOf("day").valueOf());
    if (uids) {
      for (const uid of uids) {
        pipeline.zrem(Cache.MEETINGUID_KEY, uid);
      }
    }
    pipeline.del(`${Cache.MEETINGUID_KEY}:${roomDateKey}`);
    await pipeline.exec();
  }

  private async setShadowKey(room: string, id: number): Promise<void> {
    const req = moment(id);
    const now = moment();
    const expiry = req.isSame(now, "day") ?
      now.clone().endOf("day").diff(now, "seconds") : this.expiry;
    const shadowKey = Cache.SHADOW_PREFIX + `${Cache.roomDateKey(room, id)}`;
    await this.client.pipeline().set(shadowKey, "").
      expire(shadowKey, expiry).exec();
  }

  private addRef(): void {
    this.refCnt++;
  }
}
