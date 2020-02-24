import log from 'sistemium-telegram/services/log';
import { whilstAsync, eachSeriesAsync } from 'sistemium-telegram/services/async';
// import fpFilter from 'lodash/fp/filter';
import lo from 'lodash';
import ContractArticle from '../models/ContractArticle';
import ContractPriceGroup from '../models/ContractPriceGroup';
import PartnerArticle from '../models/PartnerArticle';
import PartnerPriceGroup from '../models/PartnerPriceGroup';

const { debug } = log('import:discount');

const upsertDiscounts = ({ discount }) => !!discount;
const byContractMatch = $exists => ({ 'receivers.contractId': { $exists } });

function latterPriority({ documentDate: newDate }, { documentDate: oldDate }) {
  return !oldDate || newDate > oldDate;
}

export default async function (model) {

  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  await mergeModel(...[
    date,
    model,
    ContractArticle,
    byContractMatch(true),
    'contractId',
    'articles',
    'articleId',
  ]);

  await mergeModel(...[
    date,
    model,
    ContractPriceGroup,
    byContractMatch(true),
    'contractId',
    'priceGroups',
    'priceGroupId',
  ]);

  await mergeModel(...[
    date,
    model,
    PartnerArticle,
    byContractMatch(false),
    'partnerId',
    'articles',
    'articleId',
  ]);

  await mergeModel(...[
    date,
    model,
    PartnerPriceGroup,
    byContractMatch(false),
    'partnerId',
    'priceGroups',
    'priceGroupId',
  ]);

}

async function mergeModel(date, modelFrom, modelTo, match, receiverKey, targetField, targetKey) {

  debug('mergeModel', date);

  const $limit = 250;

  const $match = {
    [targetField]: { $exists: true },
    ...match,
    $or: [{ dateE: { $gte: date } }, { dateE: null }],
    dateB: { $lte: date },
    isDeleted: false,
    isProcessed: true,
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

  debug('mergeModel:finished', totalRaw);

}
