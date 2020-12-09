import * as mongoose from 'sistemium-mongo/lib/mongoose';
import log from 'sistemium-debug';
import lo from 'lodash';
import { lastImportedFilter, saveOffset } from '../models/Importing';
import Archive from '../models/etc/Archive';

import assert from '../lib/assert';
import exporter from '../lib/exporter';

import * as sql from './sql/exportEntityRemoved';

const { debug } = log('export:archive');

export default async function () {

  const { MONGO_URL } = process.env;

  assert(MONGO_URL, 'MONGO_URL must be set');

  await mongoose.connect(MONGO_URL);

  const $match = await lastImportedFilter('Archive');

  debug('filter', $match);

  const archived = await Archive.aggregate([{ $match }]);
  const { length } = archived;

  debug('archived', length);

  if (length) {
    const lastTs = await exportToAnywhere(archived);
    debug('lastTs', lastTs);
    await saveOffset('Archive', lastTs);
  }

  await mongoose.disconnect();

}


async function exportToAnywhere(data) {

  const values = data.map(({ name, id }) => [name, id]);

  if (!data.length) {
    return null;
  }

  await exporter({
    ...sql,
    values,
  });

  const { ts: nextTimeStamp } = lo.last(data);

  return nextTimeStamp;

}
