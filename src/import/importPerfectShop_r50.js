import * as mongo from 'sistemium-mongo/lib/mongoose';
import log from 'sistemium-debug';
import lo from 'lodash';
import mapSeries from 'async/mapSeries';

import { assertVar } from '../lib/assert';
import Assortment from '../models/marketing/Assortment';
import PerfectShop from '../models/marketing/PerfectShop';
// import { toDateString } from '../lib/dates';

const { debug } = log('import');

const { MONGO_URL_1C, MONGO_URL } = process.env;

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

  // const blockCampaign = lo.find(campaigns, { _id: GOLD_ID });
  //
  // const newAssortments = assortmentFromCampaign(blockCampaign);
  //
  // debug('newAssortments', lo.map(newAssortments, 'name'));
  //
  // const mergedAssortments = await updateAssortments(newAssortments, GOLD_ID);

  const mergedAssortments = await allAssortmentsFromCampaigns(campaigns);

  const ps = psFromCampaign(campaigns, mergedAssortments);

  debug(ps);

  await mergePS(ps);

  await mongo1C.close();
  await mongo.disconnect();
  debug('finish');

}

async function allAssortmentsFromCampaigns(campaigns) {

  const allIds = await mapSeries(campaigns, async campaign => {

    const newAssortments = assortmentFromCampaign(campaign);

    return updateAssortments(newAssortments, GOLD_ID);

  });

  const mergedAssortmentIds = lo.uniq(lo.flatten(allIds));

  return Assortment.find({ id: { $in: mergedAssortmentIds } });

}

function conditionsFromCampaign({ variants: [{ conditions }] }) {
  return conditions;
}

function assortmentFromCampaign(campaign) {

  const conditions = conditionsFromCampaign(campaign);
  const assortmentConditions = lo.filter(conditions, ({ sum, name }) => !sum || name.match(/(тихие вина|ВИНО)/));

  return lo.map(assortmentConditions, ({ name, articles }) => {

    // const parentName = parentBlockName({ name }, campaign);
    const firstName = blockName(name);
    const lastName = lo.replace(name, /^БЛОК [^ ]+ - /, '');

    return {
      name: `${firstName} / ${lastName}`,
      code: name,
      articleIds: lo.map(articles, 'articleId'),
    };

  });

}

function ordStringFromName(name) {
  const ordString = name.match(/^\d+/);
  const blockString = name.match(/^БЛОК [^ ]+/);
  if (ordString) {
    return ordString;
  }
  if (blockString) {
    return blockString;
  }
  // throw new Error(`Unknown ordStringFromName: "${name}"`);
  return '0';
}

// function ordFromString(string) {
//   if (string.match(/^\d+/)) {
//     return parseInt(string, 0);
//   }
// }

function blocksFromCampaign(campaigns, mergedAssortments) {

  const conditions = lo.flatten(lo.map(campaigns, conditionsFromCampaign));
  const allCodes = lo.map(mergedAssortments, 'code');
  const assortmentsMap = lo.mapValues(lo.keyBy(mergedAssortments, 'code'), ({ id }) => id);

  const allBlocks = lo.map(lo.filter(conditions, 'sum'), ({ name }) => {

    const ordString = ordStringFromName(name);
    const assortmentCodes = lo.filter(allCodes, code => lo.startsWith(code, ordString));
    return {
      name,
      assortmentIds: lo.map(assortmentCodes, code => assortmentsMap[code]),
    };

  });

  const blocksByName = lo.groupBy(allBlocks, ({ name }) => blockName(name));

  return lo.map(blocksByName, (blockAssortments, name) => {

    const assortmentIds = lo.uniq(lo.flatten(lo.map(blockAssortments, 'assortmentIds')));

    const ordString = ordStringFromName(name);

    return {
      name: blockName(name),
      code: name,
      ord: parseInt(ordString, 0) || 0,
      assortmentIds,
    };

  });

}

function blockName(conditionName) {

  const [, r50Name] = conditionName.match(/^БЛОК ([^ ]+) /) || [];

  if (r50Name) {
    return r50Name;
  }

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
  const updated = lo.map(newAssortments, assortment => ({
    ...assortment,
    source,
    id: assortmentsByName[assortment.name],
  }));

  const mergedAssortmentIds = await Assortment.merge(updated);
  debug('mergedAssortments', mergedAssortmentIds.length);

  return mergedAssortmentIds;

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

  // const blockCampaign = lo.find(campaigns, { _id: GOLD_ID });

  const dateB = DATE_B;
  const dateE = DATE_E;

  const blocks = blocksFromCampaign(campaigns, assortment);

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
  const conditions = lo.filter(conditionsFromCampaign(campaign), 'sum');
  // debug('conditions', conditions[0].name);
  // debug('blocks', blocks[0]);
  return blocks.map(({ name }) => ({
    name,
    shipmentCost: lo.find(conditions, c => blockName(c.name) === name)
      .sum,
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
