import * as redis from "ioredis";
import {
  IMeetingInfo, ITimelineEntry, ITimelineRequest, ITimePoint,
} from "./calender";
import {log} from "./log";
import {PanLPath} from "./path";
import {IRoom} from "./persist";

declare type PendingHandler = (path: PanLPath) => void;

export class Cache {
  public static async getInstance(): Promise<Cache> {
    if (Cache.instance !== undefined) {
      Cache.instance.addRef();
      return Cache.instance;
    }
    return new Promise<Cache>((resolve, reject) => {
      const client = new redis();
      client.on("ready", () => {
        client.set(Cache.SEQUENCE_KEY, 0);
        Cache.instance = new Cache(client);
        resolve(Cache.instance);
      });
      client.on("error", (error) => {
        reject(error);
      });
    });
  }

  private static instance: Cache | undefined;

  private static readonly SEQUENCE_KEY: string = "sequence";
  private static readonly PENDING_KEY: string = "pending";

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

  private constructor(private client: redis.Redis, private refCnt = 1) {
  }

  public async stop(): Promise<void> {
    if (--this.refCnt === 0) {
      log.silly("Close redis connection");
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

  public async addConfigured(path: PanLPath, room: IRoom): Promise<void> {
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
      this.client.set(Cache.idToUuidKey(id), uuid);
      return this.client.get(Cache.pathToIdKey(path));
    }
    const idx = await this.client.incr(Cache.SEQUENCE_KEY) as number;
    this.client.set(Cache.idToUuidKey(idx), uuid);
    this.client.set(Cache.idToPathKey(idx), path);
    this.client.set(Cache.pathToIdKey(path), idx);
    return idx;
  }

  public async getUnconfigured(idx: number):
  Promise<[PanLPath, Buffer] | undefined> {
    const [path, buf] = await Promise.all([
      this.client.get(Cache.idToPathKey(idx)),
      this.client.getBuffer(Cache.idToUuidKey(idx)),
    ]);
    if (path == null || buf == null) {
      return undefined;
    } else {
      return [path, buf];
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
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async getDayOffset(path: PanLPath): Promise<number> {
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async setTimeline(path: PanLPath, dayOffset: number,
                           entries: ITimelineEntry[]): Promise<void> {
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async getTimeline(path: PanLPath, req: ITimelineRequest):
  Promise<ITimelineEntry[] | undefined> {
    // TODO: return undefined is never been cached
    // return zero length array if no meeting
    this.updateTimelineExpiryTime(path, req.id.dayOffset);
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async setTimelineEntry(path: PanLPath, id: ITimePoint,
                                duration: number) {
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async removeTimelineEntry(path: PanLPath, id: ITimePoint) {
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async setMeetingInfo(path: PanLPath, id: ITimePoint,
                              info: IMeetingInfo): Promise<void> {
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async removeMeetingInfo(path: PanLPath, id: ITimePoint):
  Promise<void> {
    throw(new Error("TODO: Meothod not implemented"));
  }

  public async getMeetingInfo(path: PanLPath, id: ITimePoint):
  Promise<IMeetingInfo> {
    throw(new Error("TODO: Meothod not implemented"));
  }

  private async updateTimelineExpiryTime(path: PanLPath, dayOffset: number):
  Promise<void> {
    // TODO: Meetings corresponding to a timeline shall be purged out
    // once the timeline is expired.
    throw(new Error("TODO: Meothod not implemented"));
  }

  private addRef(): void {
    this.refCnt++;
  }
}
