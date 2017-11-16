import * as moment from "moment";
import {ITimelineEntry, ITimelineRequest} from "./calender";

export interface IHourMinute {
  hour: number;
  minute: number;
}

export class Time {
  public static dayOffsetToString(dayOffset: number, format?: string): string {
    const day: moment.Moment = moment().add(dayOffset, "day");
    return day.format(format || "YYYYMMDD");
  }

  public static isToday(timestamp: number): boolean {
    return moment().diff(timestamp, "days") === 0;
  }

  public static isDayOffSet(dayOffset: number, timestamp: number): boolean {
    const day: moment.Moment = moment().add(dayOffset, "day");
    return day.diff(timestamp, "days") === 0;
  }

  public static restDaySeconds(): number {
    const now: moment.Moment = moment();
    const midnight: moment.Moment = moment().endOf("day");
    return midnight.diff(now, "seconds");
  }

  public static getMiliseconds(dayOffset: number, minuteOfDay: number): number {
    const {hour, minute} = this.convertToHourMinute(minuteOfDay);

    const day: moment.Moment = moment()
      .set({
        hour,
        minute,
        second: 0,
        millisecond: 0,
      })
      .add(dayOffset, "day");

    return day.valueOf();
  }

  public static extendTime(ms: number, duration: number): number {
    return ms + duration * 60000; // 60s * 1000 ms
  }

  public static convertToHourMinute(duration: number): IHourMinute {
    const hour: number = Math.floor(duration / 60);
    const minute: number = duration - (hour * 60);

    return {hour, minute};
  }

  public static filterTimeLineKeys(src: string[], req: ITimelineRequest):
  string[] {
    function customSort(key1: string, key2: string) {
      const start1 = parseInt(key1.split(":")[3], 10);
      const start2 = parseInt(key2.split(":")[3], 10);
      return (start1 !== start2) ? (start1 < start2 ? -1 : 1) : 0;
    }

    let result: string[] = [];
    // find at point to before, else is reverser
    if (!req.lookForward) {
      result = src.filter((key) =>
        parseInt(key.split(":")[3], 10) <= req.id.minutesOfDay)
        .sort(customSort);

      const len: number = result.length;
      if (len && len > req.maxCount) {
        // drop at point to end
        result = result.slice(len - req.maxCount);
      }
    } else {
      result = src.filter((key) =>
      parseInt(key.split(":")[3], 10) > req.id.minutesOfDay)
          .sort(customSort)
          .slice(0, req.maxCount);
    }

    return result;
  }

}
