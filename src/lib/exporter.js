import log from 'sistemium-telegram/services/log';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';

import lo from 'lodash';
import Anywhere from 'sistemium-sqlanywhere';

const { debug } = log('exporter');

const EXPORT_CHUNK = parseInt(process.env.EXPORT_CHUNK, 0) || 750;

export default async function (config) {

  const {
    declare,
    insert,
    values,
    nullify,
    merge,
    postProcess,
  } = config;

  const conn = new Anywhere();

  await conn.connect();

  try {

    await conn.execImmediate(declare);

    debug('declared', values.length);

    const chunks = lo.chunk(values, EXPORT_CHUNK);

    await eachSeriesAsync(chunks, async chunk => {
      await conn.execImmediate(insert, chunk);
      debug('inserted', chunk.length);
    });

    const merged = await conn.execImmediate(merge);
    debug('merged', merged || 0, 'of', values.length);

    if (nullify) {
      const nullified = await conn.execImmediate(nullify, []);
      debug('nullified', nullified || 0);
    }

    if (postProcess) {
      await conn.execImmediate(postProcess, []);
    }

    await conn.commit();
    await conn.disconnect();

  } catch (e) {
    await conn.rollback();
    await conn.disconnect();
    throw e;
  }

}
