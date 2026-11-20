declare module 'suncalc' {
  export interface SunTimes {
    sunrise: Date | null;
    sunset: Date | null;
    solarNoon: Date;
    nadir: Date;
    dawn: Date | null;
    dusk: Date | null;
    alwaysUp?: boolean;
    alwaysDown?: boolean;
  }

  export function getTimes(
    date: Date,
    latitude: number,
    longitude: number,
    height?: number,
    utcOffset?: number
  ): SunTimes;
}
