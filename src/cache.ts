import * as redis from "ioredis";
import {PanLPath} from "./path";
import {IRoom} from "./persist";

declare type PendingHandler = (path: PanLPath) => void;

export class Cache {
  public static async getInstance(): Promise<Cache> {
    if (Cache.instance !== undefined) {
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

  private static unconfiguredKey(path: PanLPath): string {
    return `init:${path.uid}`;
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

  private constructor(private client: redis.Redis) {
  }

  public async stop(): Promise<void> {
    await this.client.quit();
    Cache.instance = undefined;
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
    if (await this.client.exists(Cache.unconfiguredKey(path))) {
      await this.client.del(Cache.unconfiguredKey(path));
    }
    await Promise.all([
      this.client.set(Cache.nameKey(path), room.name),
      this.client.set(Cache.addressKey(path), room.address),
      this.client.sadd(Cache.agentKey(path.agent), path.dest),
    ]);
  }

  public async addUnconfigured(path: PanLPath): Promise<number> {
    if (await this.client.exists(Cache.unconfiguredKey(path))) {
      return this.client.get(Cache.unconfiguredKey(path));
    }
    const idx = await this.client.incr(Cache.SEQUENCE_KEY) as number;
    this.client.set(Cache.unconfiguredKey(path), idx);
    return idx;
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
      throw(new Error(`Can't find room name for path ${path.uid}`));
    }
    return val;
  }

  public async getRoomAddress(path: PanLPath): Promise<string> {
    const val = await this.client.get(Cache.addressKey(path));
    if (val === null) {
      throw(new Error(`Can't find room address for path ${path.uid}`));
    }
    return val;
  }

  public async flush(): Promise<void> {
    this.client.flushdb();
  }
}
