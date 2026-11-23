export const DAY = 86400000;
export const addDays = (date: Date, n: number) => new Date(date.getTime() + n * DAY);
