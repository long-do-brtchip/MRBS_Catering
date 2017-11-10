import * as moment from "moment";
import {ITimelineRequest} from "./calender";

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

    const day: moment.Moment = moment.utc()
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
    /* firstly get hour and minute of day,
     * then plus to duration and convert to hour minute again
     */

    //  init date as ms
    const tmpDay = moment.utc(ms);
    const hourOfDay: number = tmpDay.hour();
    const minuteOfDay: number = tmpDay.minute();

    const {hour, minute} = this.convertToHourMinute(
      duration + (hourOfDay * 60) + minuteOfDay);

    const day: moment.Moment = moment.utc(ms)
      .add(hour, "hour")
      .set({
        minute,
        second: 0,
        millisecond: 0,
      });

    return day.valueOf();
  }

  public static convertToHourMinute(duration: number): IHourMinute {
    const hour: number = Math.floor(duration / 60);
    const minute: number = duration - (hour * 60);

    return {hour, minute};
  }

  public static filterTimeLineKeys(src: string[], req: ITimelineRequest):
  string[] {
    let result: string[] = [];
    // find at point to before, else is reverser
    if (!req.lookForward) {
      result = src.filter((key) =>
      parseInt(key.split(":")[3], 10) <= req.id.minutesOfDay);

      const len: number = result.length;
      if (len && len > req.maxCount) {
        // drop at point to end
        result = result.slice(len - req.maxCount);
      }
    } else {
      result = src.filter((key) =>
      parseInt(key.split(":")[3], 10) > req.id.minutesOfDay)
          .slice(0, req.maxCount);
    }

    return result.sort();
  }

}
