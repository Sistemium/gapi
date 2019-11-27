import dayjs from 'dayjs';


export function toDateString(date) { // eslint-disable-line import/prefer-default-export
  return dayjs(date)
    .format('YYYY-MM-DD');
}
