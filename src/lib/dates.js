import dayjs from 'dayjs';

export function toDateString(date, days = 0) {
  return dayjs(date)
    .add(days, 'day')
    .format('YYYY-MM-DD');
}

export function humanDate(date, days = 0) {
  return dayjs(date)
    .add(days, 'day')
    .format('DD/MM');
}
