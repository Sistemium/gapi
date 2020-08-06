import dayjs from 'dayjs';


export function toDateString(date, days = 0) { // eslint-disable-line import/prefer-default-export
  return dayjs(date)
    .add(days, 'day')
    .format('YYYY-MM-DD');
}
