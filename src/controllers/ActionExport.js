import log from 'sistemium-debug';
import lo from 'lodash';
import * as util from 'sistemium-mongo/lib/util';
import { OFFSET_HEADER } from 'sistemium-mongo/lib/api';

import Action from '../models/marketing/Action';

const { debug } = log('ActionExport');
const PAGE_SIZE_HEADER = 'x-page-size';

export async function getHandler(ctx) {

  const { path } = ctx;
  const pageSize = queryOrHeader(ctx, PAGE_SIZE_HEADER) || '10';
  const offset = queryOrHeader(ctx, OFFSET_HEADER);

  const $match = {};

  if (offset && offset !== '*') {
    try {
      $match.ts = { $gt: util.offsetToTimestamp(offset) };
    } catch (e) {
      ctx.throw(400, e);
    }
  }

  debug('GET', path, $match);

  const $addFields = {
    ts: { $toDate: { $dateToString: { date: '$ts' } } },
    'x-offset': '$ts',
  };

  const pipeline = [
    { $match },
    { $sort: { ts: offset ? 1 : -1 } },
    { $limit: parseInt(pageSize, 0) },
    { $addFields },
  ];

  const data = await Action.aggregate(pipeline);

  if (offset && data.length) {
    const lastTs = lo.last(data)[OFFSET_HEADER];
    const newOffset = util.timestampToOffset(lastTs);
    debug('offsets:', offset, newOffset);
    ctx.set(OFFSET_HEADER, newOffset);
    lo.forEach(data, acc => delete acc[OFFSET_HEADER]);
  }

  if (!data.length) {
    ctx.status = 204;
  } else {
    ctx.body = data;
  }

}

function queryOrHeader(ctx, headerName) {
  return ctx.query[`${headerName}:`] || ctx.header[headerName];
}
