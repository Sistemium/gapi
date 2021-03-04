import * as mongo from 'sistemium-mongo/lib/mongoose';
import log from 'sistemium-debug';
import lo from 'lodash';
import assert, { assertVar } from '../lib/assert';
import Assortment from '../models/marketing/Assortment';
import PerfectShop from '../models/marketing/PerfectShop';
import { toDateString } from '../lib/dates';

const { debug, error } = log('import');

const { MONGO_URL_1C, MONGO_URL, NAME_PREFIX } = process.env;

const { DATE_B, DATE_E } = process.env;

assertVar('MONGO_URL_1C');
assertVar('MONGO_URL');
assertVar('DATE_B');
assertVar('DATE_E');

const { GOLD_ID, BRONZE_ID, SILVER_ID } = process.env;

const LEVELS = [
  { name: 'BRONZE', id: BRONZE_ID, prize: 500 },
  { name: 'SILVER', id: SILVER_ID, prize: 1000 },
  { name: 'GOLD', id: GOLD_ID, prize: 1500 },
];

assertVar('GOLD_ID');

export default async function () {

  debug('start');

  await mongo.connect(MONGO_URL);

  const mongo1C = await mongo.connection(MONGO_URL_1C);
  const Campaign1C = mongo1C.model('Campaign', { _id: String }, 'Campaign');

  const $match = { _id: { $in: [GOLD_ID, BRONZE_ID, SILVER_ID] } };

  const campaigns = await Campaign1C.aggregate([{ $match }]);

  debug('campaigns', campaigns.length);

  const blockCampaign = lo.find(campaigns, { _id: GOLD_ID });

  const newAssortments = assortmentFromCampaign(blockCampaign);

  debug('newAssortments', lo.map(newAssortments, 'name'));

  const mergedAssortments = await updateAssortments(newAssortments, blockCampaign._id);

  const ps = psFromCampaign(campaigns, mergedAssortments);

  debug(ps);

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
    name: `${parentBlockName({ name }, campaign)} / ${lo.replace(name, /^[^а-я]*/i, '')}`,
    code: name,
    articleIds: lo.map(articles, 'articleId'),
  }));

}

function parentBlockName(condition, campaign) {
  const conditions = conditionsFromCampaign(campaign);
  const blockConditions = lo.filter(conditions, ({ sum }) => sum);
  const ordString = condition.name.match(/^\d+/);
  const res = lo.find(blockConditions, ({ name }) => lo.startsWith(name, ordString));
  if (!res) {
    return null;
  }
  return blockName(res.name);
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


async function updateAssortments(newAssortments, source) {

  const $match = { source };
  const $project = { id: true, name: true };
  const oldAssortments = await Assortment.aggregate([{ $match }, { $project }]);
  const assortmentsByName = lo.mapValues(lo.keyBy(oldAssortments, 'name'), ({ id }) => id);
  const updateAssortments = lo.map(newAssortments, assortment => ({
    ...assortment,
    source,
    id: assortmentsByName[assortment.name],
  }));

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

  const dateB = DATE_B;
  const dateE = DATE_E;

  const blocks = blocksFromCampaign(blockCampaign, assortment);

  return {
    dateE,
    dateB,
    blocks,
    levels: levelsFromCampaigns(campaigns, blocks, assortment),
  };

}

function levelsFromCampaigns(campaigns, blocks, assortment) {

  return LEVELS.map(({ id, name, prize }) => {

    const campaign = lo.find(campaigns, { _id: id });

    return {
      name,
      prize,
      campaignId: id,
      blockRequirements: levelBlockRequirementsFromCampaign(campaign, blocks),
      requirements: levelRequirementsFromCampaign(campaign, assortment),
    };

  });

}

function levelBlockRequirementsFromCampaign(campaign, blocks) {
  return blocks.map(({ code, name }) => ({
    name,
    shipmentCost: lo.find(conditionsFromCampaign(campaign), { name: code }).sum,
  }));
}

const LEVEL_REQ_MAP = new Map([
  ['country', 'countryCnt'],
  ['brand', 'brandCnt'],
  ['skuCount', 'skuCnt'],
  ['qty', 'pieceCnt'],
  ['volume', 'litreCnt'],
]);


function levelRequirementsFromCampaign(campaign, assortment) {
  return lo.filter(assortment.map(({ code, id }) => {

    const res = {
      assortmentId: id,
      facingCnt: null,
    };

    const condition = lo.find(conditionsFromCampaign(campaign), { name: code });

    if (!condition) {
      return null;
    }

    LEVEL_REQ_MAP.forEach((prop, prop1C) => {
      const val = condition[prop1C];
      if (val) {
        res[prop] = val;
      }
    });

    return res;

  }));

}
