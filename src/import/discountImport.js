import lo from 'lodash';
import log from 'sistemium-telegram/services/log';
import { whilstAsync, eachSeriesAsync } from 'sistemium-telegram/services/async';
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

  await whilstAsync(() => lastImported !== null, async () => {
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

  const date = new Date();
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

  await nullifyMissing();

  const $set = { timestamp: maxTimestamp };

  await Importing.updateOne({ name }, { $set, $currentDate: { ts: true } }, { upsert: true });

  debug('finish:all');

}


async function nullifyMissing() {
  // const docs = await findAllDocs();
}


async function mergeModel(modelFrom, modelTo, match, receiverKey, targetField, targetKey) {

  debug('mergeModel', receiverKey, targetField);

  const $limit = 200;
  const today = new Date().setUTCHours(0, 0, 0, 0);

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

  await whilstAsync(() => skip >= 0, importSkipPage);

  /*
  Functions
   */

  async function importSkipPage() {

    const raw = await modelFrom.aggregate(pipeline(skip));

    debug('mergeModel:source', raw.length, 'skipped', skip);

    let mergedTotal = 0;
    // debug(JSON.stringify(raw[0]));

    const items = lo.flatten(lo.map(raw, item => {

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

    }));

    debug(items[0]);

    await eachSeriesAsync(lo.chunk(items, $limit * 3), async chunk => {
      const merged = await modelTo.mergeIfNotMatched(chunk, upsertDiscounts, latterPriority);
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

  function latterPriority(newData, oldData) {
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
      || (newE >= today && oldE < today)
      || (newDate > oldDate && newE >= today)
      || newId === oldId;
  }

  debug('mergeModel:finished', receiverKey, targetField, totalRaw);

}
