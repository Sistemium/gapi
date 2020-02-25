import lo from 'lodash';
import log from 'sistemium-telegram/services/log';
import { whilstAsync, eachSeriesAsync } from 'sistemium-telegram/services/async';

import Importing from '../models/Importing';

import ContractArticle from '../models/ContractArticle';
import ContractPriceGroup from '../models/ContractPriceGroup';
import PartnerArticle from '../models/PartnerArticle';
import PartnerPriceGroup from '../models/PartnerPriceGroup';

const { debug, error } = log('import:discount');

const upsertDiscounts = ({ discount }) => !!discount;

function latterPriority({ documentDate: newDate }, { documentDate: oldDate }) {
  return !oldDate || newDate > oldDate;
}

let busy = false;

export default async function (model) {

  if (busy) {
    debug('busy');
    return;
  }

  busy = true;

  try {
    await main(model);
    busy = false;
  } catch (e) {
    error(e);
    busy = false;
  }

}

async function main(model) {

  const name = 'Discount';

  const lastImport = await Importing.findOne({ name });
  const [max] = await model.find({}).sort({ timestamp: -1 }).limit(1);
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

  const $set = { timestamp: maxTimestamp };

  await Importing.updateOne({ name }, { $set, $currentDate: { ts: true } }, { upsert: true });

  debug('finish:all');

}

async function mergeModel(modelFrom, modelTo, match, receiverKey, targetField, targetKey) {

  debug('mergeModel', receiverKey, targetField);

  const $limit = 250;

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
        documentDate: '$date',
        receivers: '$receivers',
        targetId: `$${targetField}.${targetKey}`,
        articleDiscount: `$${targetField}.discount`,
      },
    },
  ];

  let skip = 0;
  let totalRaw = 0;

  await whilstAsync(() => skip >= 0, async () => {

    const raw = await modelFrom.aggregate(pipeline(skip));

    debug('mergeModel:source', raw.length, 'skipped', skip);

    let mergedTotal = 0;
    // debug(JSON.stringify(raw[0]));

    const items = lo.flatten(lo.map(raw, item => {

      const { targetId, documentId, documentDate } = item;
      let discount = item.articleDiscount || item.discount;

      if (item.isDeleted || !item.isProcessed) {
        discount = 0;
      }

      return lo.filter(lo.map(item.receivers, ({ [receiverKey]: receiverId }) => ({
        [targetKey]: targetId,
        [receiverKey]: receiverId,
        discount,
        documentId,
        documentDate,
      })), receiverKey);

    }));

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

  });

  debug('mergeModel:finished', receiverKey, targetField, totalRaw);

}
