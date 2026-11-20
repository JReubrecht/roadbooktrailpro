declare module 'suncalc' {
  export interface SunTimes {
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
    nadir: Date;
    dawn: Date;
    dusk: Date;
  }

  export function getTimes(date: Date, latitude: number, longitude: number): SunTimes;
}
