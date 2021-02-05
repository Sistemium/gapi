import lo from 'lodash';
import log from 'sistemium-debug';
import { whilst as whilstAsync, eachSeries, mapSeries } from 'async';
import exporter from '../lib/exporter';
import * as caSQL from './sql/exportContractArticleSQL';
import * as cpgSQL from './sql/exportContractPriceGroupSQL';
import * as paSQL from './sql/exportPartnerArticleSQL';
import * as ppgSQL from './sql/exportPartnerPriceGroupSQL';

import Importing from '../models/Importing';

import ContractArticle from '../models/ContractArticle';
import ContractPriceGroup from '../models/ContractPriceGroup';
import PartnerArticle from '../models/PartnerArticle';
import PartnerPriceGroup from '../models/PartnerPriceGroup';

const { debug, error } = log('import:discount');

const CHUNK_SIZE = 200;
const CHUNK_SIZE_LARGE = 100000;

const upsertDiscounts = ({ discount }) => !!discount;

let busy = false;

export default async function (model) {

  if (busy) {
    debug('busy');
    return;
  }

  busy = true;

  try {
    await importToMongo(model);
    await exportToAnywhere('ContractArticle', ContractArticle, caPick, caSQL);
    await exportToAnywhere('ContractPriceGroup', ContractPriceGroup, cpgPick, cpgSQL);
    await exportToAnywhere('PartnerArticle', PartnerArticle, paPick, paSQL);
    await exportToAnywhere('PartnerPriceGroup', PartnerPriceGroup, ppgPick, ppgSQL);
    busy = false;
  } catch (e) {
    error(e);
    busy = false;
  }

}

function paPick(item) {
  const {
    partnerId,
    articleId,
    discount,
    discountCategoryId,
  } = item;
  return [partnerId, articleId, discount, discountCategoryId];
}

function ppgPick(item) {
  const {
    partnerId,
    priceGroupId,
    discount,
    discountCategoryId,
  } = item;
  return [partnerId, priceGroupId, discount, discountCategoryId];
}

function caPick(item) {
  const {
    contractId,
    articleId,
    discount,
    discountCategoryId,
  } = item;
  return [contractId, articleId, discount, discountCategoryId];
}

function cpgPick(item) {
  const {
    contractId,
    priceGroupId,
    discount,
    discountCategoryId,
  } = item;
  return [contractId, priceGroupId, discount, discountCategoryId];
}

async function exportToAnywhere(name, model, picker, sql) {

  const importFilter = { name };
  const lastImport = await Importing.findOne(importFilter);
  let { params: { offset: lastImported } } = lastImport || { params: {} };

  debug('exportToAnywhere:start', name, lastImported);

  await whilstAsync(async () => lastImported !== null, async () => {
    lastImported = await exportToAnywherePage(lastImported, model, picker, sql);
    if (lastImported) {
      debug('exportToAnywhere:lastImported', lastImported);
      const $set = { 'params.offset': lastImported };
      const $currentDate = { ts: true };
      await Importing.updateOne(importFilter, { $set, $currentDate }, { upsert: true });
    }
  });

  debug('exportToAnywhere:finish', name);

}

async function exportToAnywherePage(lastImported, model, picker, sql) {

  const data = await model.aggregate([{
    $match: { ts: lastImported ? { $gt: lastImported } : { $ne: null } },
  }])
    .sort({ ts: 1 })
    .limit(10000);

  const values = data.map(picker);

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

async function importToMongo(model) {

  const name = 'Discount';

  const lastImport = await Importing.findOne({ name });
  const [max] = await model.find({}).sort({ timestamp: -1 }).limit(1);

  if (!max) {
    debug('importToMongo:empty');
    return;
  }

  const { timestamp: maxTimestamp } = max.toObject();
  const { timestamp: lastImported } = lastImport || {};

  const date = clientDate();
  date.setUTCHours(0, 0, 0, 0);

  if (!maxTimestamp) {
    throw new Error('empty maxTimestamp');
  }

  debug('start', date, lastImported, maxTimestamp);

  if (lastImported && lastImported.getTime() === maxTimestamp.getTime()) {
    debug('exiting');
    return;
  }

  const byContractMatch = $exists => ({
    'receivers.contractId': { $exists },
    timestamp: lastImported ? { $gt: lastImported } : { $exists: true },
    $or: [{ dateE: { $gte: date } }, { dateE: null }],
    dateB: { $lte: date },
    isDeleted: false,
    isProcessed: true,
  });

  await mergeModel(...[
    model,
    ContractArticle,
    byContractMatch(true),
    'contractId',
    'articles',
    'articleId',
  ]);

  await mergeModel(...[
    model,
    ContractPriceGroup,
    byContractMatch(true),
    'contractId',
    'priceGroups',
    'priceGroupId',
  ]);

  await mergeModel(...[
    model,
    PartnerArticle,
    byContractMatch(false),
    'partnerId',
    'articles',
    'articleId',
  ]);

  await mergeModel(...[
    model,
    PartnerPriceGroup,
    byContractMatch(false),
    'partnerId',
    'priceGroups',
    'priceGroupId',
  ]);

  await nullifyAllMissing(model, date);

  const $set = { timestamp: maxTimestamp };

  await Importing.updateOne({ name }, { $set, $currentDate: { ts: true } }, { upsert: true });

  debug('finish:all');

}


export async function nullifyAllMissing(rawModel, today) {

  const configs = [
    [ContractPriceGroup, 'contractId', 'priceGroups', 'priceGroupId'],
    [PartnerPriceGroup, 'partnerId', 'priceGroups', 'priceGroupId'],
    [ContractArticle, 'contractId', 'articles', 'articleId'],
    [PartnerArticle, 'partnerId', 'articles', 'articleId'],
  ];

  await eachSeries(configs, async config => {
    await nullifyMissing(rawModel, today, ...config);
  });

}

export async function nullifyMissing(rawModel, today, model, receiverKey, targetField, targetKey) {

  const expired = await filterExpired(rawModel, today, model, receiverKey, targetField, targetKey);

  debug('nullifyMissing:', model.modelName, expired.length);

  await deleteDiscounts(model, expired);

}


async function deleteDiscounts(model, expired) {

  await eachSeries(lo.chunk(expired, CHUNK_SIZE), async chunk => {

    const opsChunks = chunk.map(({ documentId, expiredKeys }) => expiredKeys.map(keys => ({
      updateOne: {
        filter: { documentId, ...keys },
        update: {
          $set: { discount: 0, dateE: null, documentDate: null },
          $currentDate: { ts: { $type: 'timestamp' } },
        },
      },
    })));

    const ops = lo.flatten(opsChunks);

    debug('nullifyChunked:', model.modelName, ops.length, lo.get(ops[0], 'filter'));

    if (ops.length) {
      await model.bulkWrite(ops, { ordered: false });
    }

  });

}


export async function removeExpiredNulls(
  rawModel, today, model, receiverKey, targetField, targetKey,
) {
  const expired = await filterExpired(
    rawModel, today, model, receiverKey, targetField, targetKey, false,
  );
  debug('removeExpiredNulls:', model.modelName, expired.length);
  await deleteDiscounts(model, expired);
}

async function filterExpired(
  rawModel, today, model, receiverKey, targetField, targetKey, discount = true,
) {

  let $skip = 0;
  let $continue = true;
  const result = [];
  const $limit = CHUNK_SIZE_LARGE;

  await whilstAsync(async () => $continue, async () => {

    const pipeline = actualDataPipeline(receiverKey, targetKey, $limit, $skip, discount);
    const actualData = await model.aggregate(pipeline);
    const chunks = lo.chunk(actualData, CHUNK_SIZE);

    const chunked = await mapSeries(chunks, async chunk => {

      const $match = { _id: { $in: lo.map(chunk, 'documentId') } };
      const discounts = await rawModel.aggregate([{ $match }]);

      return matchExpiredDiscounts(chunk, discounts, today, receiverKey, targetField, targetKey);

    });

    const res = lo.flatten(chunked);

    debug('filterExpired:', model.modelName, $skip, actualData.length, res.length);

    if (!actualData.length) {
      $continue = false;
    }

    if (res.length) {
      result.push(...res);
    }

    $skip += $limit;

  });

  debug('filterExpired:result', model.modelName, result.length);

  return result;

}


/**
 *
 * @param discounts
 * @param data
 * @param today
 * @param receiverKey
 * @param targetField
 * @param targetKey
 * @returns {Array<Object>}
 */

export function matchExpiredDiscounts(data, discounts, today, receiverKey, targetField, targetKey) {

  const discountsById = new Map(discounts.map(d => [lo.get(d, '_id'), d]));

  const result = data.map(({ documentId, keys }) => {

    const discount = discountsById.get(documentId);

    const { dateE, isDeleted = true } = discount || {};

    if (isDeleted || (dateE && dateE < today)) {
      return { documentId, expiredKeys: keys };
    }

    const expiredKeys = lo.filter(keys, key => {
      const receiver = lo.find(discount.receivers, { [receiverKey]: key[receiverKey] });
      const target = lo.find(discount[targetField], { [targetKey]: key[targetKey] });
      return !receiver || !target;
    });

    return expiredKeys.length && { documentId, expiredKeys };

  });

  return lo.filter(result);

}


export function actualDataPipeline(receiverKey, targetKey, $limit = 0, $skip = 0, discount = true) {

  const $match = discount ? { discount: { $ne: 0 } } : { discount: 0, documentDate: { $ne: null } };

  return lo.filter([
    { $sort: { _id: 1 } },
    { $match },
    $skip && { $skip },
    $limit && { $limit },
    {
      $group: {
        _id: '$documentId',
        keys: {
          $addToSet: {
            [receiverKey]: `$${receiverKey}`,
            [targetKey]: `$${targetKey}`,
          },
        },
      },
    },
    { $project: { _id: false, documentId: '$_id', keys: true } },
  ]);

}


async function mergeModel(modelFrom, modelTo, match, receiverKey, targetField, targetKey) {

  debug('mergeModel', receiverKey, targetField);

  const $limit = CHUNK_SIZE;
  const today = new Date().setUTCHours(0, 0, 0, 0);
  const priority = latterPriority(today);

  const $match = {
    [targetField]: { $exists: true },
    ...match,
  };

  const pipeline = $skip => [
    { $sort: { ts: 1 } },
    { $match },
    { $skip },
    { $limit },
    { $unwind: `$${targetField}` },
    {
      $project: {
        _id: false,
        documentId: '$_id',
        discount: true,
        isDeleted: true,
        isProcessed: true,
        dateE: true,
        discountCategoryId: true,
        documentDate: '$dateB',
        receivers: '$receivers',
        targetId: `$${targetField}.${targetKey}`,
        articleDiscount: `$${targetField}.discount`,
      },
    },
  ];

  let skip = 0;
  let totalRaw = 0;

  await removeExpiredNulls(modelFrom, today, modelTo, receiverKey, targetField, targetKey);

  await whilstAsync(async () => skip >= 0, importSkipPage);

  debug('mergeModel:finished', receiverKey, targetField, totalRaw);

  /*
  Functions
   */

  async function importSkipPage() {

    const raw = await modelFrom.aggregate(pipeline(skip));

    debug('mergeModel:source', raw.length, 'skipped', skip);

    let mergedTotal = 0;
    // debug(JSON.stringify(raw[0]));

    const items = lo.flatten(lo.map(raw, discountPipelineMap(receiverKey, targetKey)));

    debug(items[0]);

    await eachSeries(lo.chunk(items, $limit * 3), async chunk => {
      const merged = await modelTo.mergeIfNotMatched(chunk, upsertDiscounts, priority);
      mergedTotal += merged.length;
    });

    debug('mergeModel:merged', mergedTotal);

    if (raw.length) {
      skip += $limit;
    } else {
      skip = -1;
    }

    totalRaw += raw.length;

  }

}

export function discountPipelineMap(receiverKey, targetKey) {
  return item => {

    const { targetId, documentId, documentDate } = item;
    const { discountCategoryId, dateE = null } = item;
    let discount = item.articleDiscount || item.discount;

    if (item.isDeleted || !item.isProcessed) {
      discount = 0;
    }

    return lo.filter(lo.map(item.receivers, ({ [receiverKey]: receiverId }) => ({
      [targetKey]: targetId,
      [receiverKey]: receiverId,
      discount,
      dateE,
      documentId,
      documentDate,
      discountCategoryId,
    })), receiverKey);

  };
}

export function latterPriority(today) {
  return (newData, oldData) => {
    const {
      documentId: oldId,
      documentDate: oldDate,
      dateE: oldE = '',
      // discount: oldDiscount,
    } = oldData;
    const {
      documentId: newId,
      documentDate: newDate,
      dateE: newE = '',
      // discount: newDiscount,
    } = newData;
    return !oldDate
      || newId === oldId
      || (newE >= today && !(oldE && oldE >= today))
      || (newDate > oldDate && newE >= today);
  };
}

export function clientDate(date = new Date()) {
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
