import * as mongo from 'sistemium-mongo/lib/mongoose';
import log from 'sistemium-debug';
import lo from 'lodash';
import assert, { assertVar } from '../src/lib/assert';
import Assortment from '../src/models/marketing/Assortment';
import PerfectShop from '../src/models/marketing/PerfectShop';
import { toDateString } from '../src/lib/dates';

const { debug, error } = log('import');

const { MONGO_URL_1C, MONGO_URL, NAME_PREFIX } = process.env;

assert(MONGO_URL_1C, 'MONGO_URL_1C must be set');
assert(MONGO_URL, 'MONGO_URL must be set');
assertVar('NAME_PREFIX');

const { GOLD_ID, BRONZE_ID, SILVER_ID } = process.env;

const LEVELS = [
  { name: 'BRONZE', id: BRONZE_ID, prize: 500 },
  { name: 'SILVER', id: SILVER_ID, prize: 1000 },
  { name: 'GOLD', id: GOLD_ID, prize: 1500 },
];

assertVar('GOLD_ID');

main()
  .catch(error);

async function main() {

  debug('start');

  await mongo.connect(MONGO_URL);

  const mongo1C = await mongo.connection(MONGO_URL_1C)
  const Campaign1C = mongo1C.model('Campaign', { _id: String }, 'Campaign');

  const $match = { _id: { $in: [GOLD_ID, BRONZE_ID, SILVER_ID] } };

  const campaigns = await Campaign1C.aggregate([{ $match }]);

  debug('campaigns', campaigns.length);

  const blockCampaign = lo.find(campaigns, { _id: GOLD_ID });

  const newAssortments = assortmentFromCampaign(blockCampaign);

  debug('newAssortments', lo.map(newAssortments, 'name'));

  const mergedAssortments = await updateAssortments(newAssortments);

  const ps = psFromCampaign(campaigns, mergedAssortments);

  debug(JSON.stringify(ps, null, 2));

  await mergePS(ps);

  await mongo1C.close();
  await mongo.disconnect();
  debug('finish');

}

function conditionsFromCampaign({ variants: [{ conditions }] }) {
  return conditions;
}

function assortmentFromCampaign(campaign) {

  const conditions = conditionsFromCampaign(campaign);
  const assortmentConditions = lo.filter(conditions, ({ sum, name }) => !sum || name.match(/тихие вина/));

  return lo.map(assortmentConditions, ({ name, articles }) => ({
    name: `${NAME_PREFIX} ${lo.replace(name, /^[^а-я]*/i, '')}`,
    code: name,
    articleIds: lo.map(articles, 'articleId'),
  }));

}

function blocksFromCampaign(campaign, mergedAssortments) {

  const conditions = conditionsFromCampaign(campaign);
  const allCodes = lo.map(mergedAssortments, 'code');
  const assortmentsMap = lo.mapValues(lo.keyBy(mergedAssortments, 'code'), ({ id }) => id);

  return lo.map(lo.filter(conditions, 'sum'), ({ name }) => {

    const ordString = name.match(/^\d+/);
    const assortmentCodes = lo.filter(allCodes, code => lo.startsWith(code, ordString));
    return {
      name: blockName(name),
      code: name,
      ord: parseInt(ordString, 0),
      assortmentIds: lo.map(assortmentCodes, code => assortmentsMap[code]),
    };

  });

}

function blockName(conditionName) {
  const res = `${lo.replace(conditionName, /^[^а-я]*/i, '')}`;
  if (res.match(/тихие вина/)) {
    return 'Вино';
  }
  return res;
}


async function updateAssortments(newAssortments) {

  const $project = { id: true, name: true };
  const oldAssortments = await Assortment.aggregate([{ $project }]);
  const assortmentsByName = lo.mapValues(lo.keyBy(oldAssortments, 'name'), ({ id }) => id);
  const updateAssortments = lo.map(newAssortments, assortment => ({
    ...assortment,
    id: assortmentsByName[assortment.name],
  }))

  const mergedAssortmentIds = await Assortment.merge(updateAssortments);
  debug('mergedAssortments', mergedAssortmentIds.length);

  return Assortment.find({ id: { $in: mergedAssortmentIds } });

}

async function mergePS(perfectShop) {

  const { dateB, dateE } = perfectShop;
  const instance = { ...perfectShop };

  const existing = await PerfectShop.findOne({ dateB, dateE });

  if (existing) {
    instance.id = existing.id;
  }

  const [mergedId] = await PerfectShop.merge([instance]);

  return mergedId;

}

function psFromCampaign(campaigns, assortment) {

  const blockCampaign = lo.find(campaigns, { _id: GOLD_ID });

  const { dateB, dateE } = blockCampaign;
  const blocks = blocksFromCampaign(blockCampaign, assortment);

  return {
    dateE: toDateString(dateE),
    dateB: toDateString(dateB),
    blocks,
    levels: levelsFromCampaigns(campaigns, blocks),
  }

}

const LEVEL_REQ_MAP = new Map([
  ['country', 'countryCnt'],
  ['brand', 'brandCnt'],
  ['skuCount', 'skuCnt'],
  ['qty', 'pieceCnt'],
  ['volume', 'litreCnt'],
]);

function levelsFromCampaigns(campaigns, blocks) {

  return LEVELS.map(({ id, name, prize }) => {

    const campaign = lo.find(campaigns, { _id: id });

    return {
      name,
      prize,
      blockRequirements: levelBlockRequirementsFromCampaign(campaign, blocks),
      requirements: [],
    };

  });

}

function levelBlockRequirementsFromCampaign(campaign, blocks) {
  return blocks.map(({ code, name }) => ({
    name,
    shipmentCost: lo.find(conditionsFromCampaign(campaign), { name: code }).sum,
  }))
}

//
// function blockNames(assortments) {
//   const blocks = lo.filter(assortments, ({ articleIds }) => {
//     return !lo.find(assortments, ({ articleIds: otherIds }) => {
//       return lo.intersection(articleIds, otherIds).length && otherIds.length > articleIds.length;
//     });
//   });
//   return lo.map(blocks, ({ name, articleIds, id }) => {
//     const innerAssortments = lo.filter(assortments, ({ articleIds: otherIds }) => {
//       return lo.intersection(articleIds, otherIds).length && otherIds.length < articleIds.length;
//     });
//     return {
//       name,
//       assortmentIds: innerAssortments.length ? lo.map(innerAssortments, 'id') : [id],
//     };
//   });
// }
