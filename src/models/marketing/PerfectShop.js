import ModelSchema from 'sistemium-mongo/lib/schema';
import lo from 'lodash';
import Assortment from './Assortment';

const BLOCK = {
  _id: false,
  ord: Number,
  name: String, // Vodka
  commentText: String,
  assortmentIds: [String],
};

export const BLOCK_REQUIREMENTS = () => [{
  _id: false,
  name: String,
  shipmentCost: Number,
}];

export const LEVEL_REQUIREMENTS = () => [{
  _id: false,
  assortmentId: String,
  countryCnt: Number,
  brandCnt: Number,
  skuCnt: Number,
  pieceCnt: Number,
  litreCnt: Number,
  facingCnt: Number,
}];

const LEVEL = {
  _id: false,
  name: String, // Bronze
  prize: Number,
  blockRequirements: BLOCK_REQUIREMENTS(),
  requirements: LEVEL_REQUIREMENTS(),
};

export default new ModelSchema({
  collection: 'PerfectShop',
  schema: {
    dateB: String,
    dateE: String,
    blocks: [BLOCK],
    levels: [LEVEL],
  },
  tsType: 'timestamp',
}).model();


const aggregators = {
  countryCnt: stats => lo.uniq(lo.map(stats, 'countryId')).length,
  brandCnt: stats => lo.uniq(lo.map(stats, 'brandId')).length,
  skuCnt: stats => lo.uniq(lo.map(stats, 'skuId')).length,
  pieceCnt: stats => lo.sumBy(stats, 'pieceCnt'),
  litreCnt: stats => lo.sumBy(stats, 'litreCnt'),
};

export async function findAssortmentMap(blocks = []) {
  const assortmentIds = lo.flatten(lo.map(blocks, 'assortmentIds'));
  const assortments = await Assortment.find({ id: { $in: assortmentIds } });
  return lo.keyBy(assortments, 'id');
}

export function articleIdBlockMapWithAssortmentMap(blocks, assortmentMap) {

  const res = {};

  blocks.forEach(({ name, assortmentIds }) => {
    assortmentIds.forEach(assortmentId => {
      const { articleIds = [] } = assortmentMap[assortmentId] || {};
      articleIds.forEach(articleId => {
        res[articleId] = name;
      });
    });
  });

  return res;

}

export function levelResults(level, outletStats, assortmentMap) {

  const { requirements } = level;

  return lo.flatten(requirements.map(levelRequirements => {
    const { assortmentId } = levelRequirements;
    const assortment = assortmentMap[assortmentId];
    return checkAssortmentRequirements(assortment, levelRequirements, outletStats);
  }));

}

export function blockResults(level, outletStats, articleIdBlockMap) {

  const { blockRequirements } = level;

  const statsByBlock = lo.groupBy(outletStats, ({ articleId }) => articleIdBlockMap[articleId]);

  return blockRequirements.map(({ name, shipmentCost: goal }) => {

    const value = lo.sumBy(statsByBlock[name], 'shipmentCost') || 0;

    return {
      name,
      goal,
      value,
      result: value >= goal,
    };

  });

}


export function checkAssortmentRequirements(assortment, levelRequirements, outletStats) {

  const { articleIds = [], id: assortmentId, name: assortmentName } = assortment;

  const matching = lo.filter(outletStats, ({ articleId }) => articleIds.includes(articleId));

  const res = lo.map(aggregators, (aggregator, rule) => {
    const goal = levelRequirements[rule];
    if (!goal) {
      return null;
    }
    const value = aggregator(matching);
    return {
      assortmentId,
      assortmentName,
      rule,
      value,
      goal,
      result: value >= goal,
    };
  });

  return lo.filter(res);

}

export function levelBlocks({ requirements }, blocks) {

  const predicate = assortmentId => lo.find(requirements, { assortmentId });

  return blocks.map(({ name, assortmentIds }) => ({
    name,
    assortmentIds: lo.filter(assortmentIds, predicate),
  }));

}
