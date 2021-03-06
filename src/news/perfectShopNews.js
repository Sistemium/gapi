import Anywhere from 'sistemium-sqlanywhere';
import log from 'sistemium-debug';
import lo from 'lodash';
import eachSeries from 'async/eachSeries';
import mapSeries from 'async/mapSeries';
import * as mongo from 'sistemium-mongo/lib/mongoose';

import { toDateString } from '../lib/dates';
import assert from '../lib/assert';
import * as sql from './sql/psNewsSQL';

import PerfectShop, * as PS from '../models/marketing/PerfectShop';
import Assortment from '../models/marketing/Assortment';
import OutletStats from '../models/marketing/OutletStats';

const { debug, error } = log('news:ps');

export default async function (date) {

  const anywhere = new Anywhere();

  await anywhere.connect();
  await mongo.connect();

  await doUpdateStats(anywhere, date).catch(error);

  await mongo.disconnect();
  await anywhere.disconnect();

}


async function doUpdateStats(anywhere, date) {

  const today = date || toDateString(new Date());
  debug('doUpdateStats', today);

  const ps = await PerfectShop.findOne({ dateB: { $lte: today }, dateE: { $gte: today } });
  assert(ps, `Not found PS record for ${date}`);

  const { dateB, dateE } = ps;
  debug('ps', dateB, dateE);

  const results = await makePSResults(anywhere, ps);
  debug('results', results.length);

  await mergeOutletSalesman(anywhere, dateB, dateE);

  await OutletStats.merge(results);

  debug('finish');

}


async function makePSResults(anywhere, ps) {

  const { blocks, dateB, dateE } = ps;
  const { levels } = ps;

  await anywhere.execImmediate(sql.DECLARE_BLOCK);

  const articleIdsByBlock = await mapSeries(blocks, async ({ assortmentIds }) => {
    const assortments = await Assortment.find({ id: { $in: assortmentIds } });
    return lo.map(assortments, 'articleIds');
  });

  const articleIds = lo.uniq(lo.flattenDeep(articleIdsByBlock));

  debug(articleIds.length);

  await eachSeries(lo.chunk(articleIds, 250), async chunk => {
    await anywhere.execImmediate(sql.INSERT_BLOCK, chunk.map(id => [id]));
  });

  debug('inserted');

  const statsRaw = await anywhere.execImmediate(sql.SELECT_SHIPMENTS, [dateB, dateE]);

  const stats = lo.map(statsRaw, stat => ({
    ...stat,
    shipmentCost: parseFloat(stat.shipmentCost),
    litreCnt: parseFloat(stat.litreCnt),
  }));

  debug('stats', stats.length, lo.take(stats, 1));

  const byOutletId = lo.groupBy(stats, 'outletId');
  const assortmentMap = await PS.findAssortmentMap(blocks);
  const articleIdsMapByLevel = new Map(levels.map(level => [
    level.name,
    PS.articleIdBlockMapWithAssortmentMap(PS.levelBlocks(level, blocks), assortmentMap),
  ]));

  return lo.map(byOutletId, (outletStats, outletId) => {

    const statsByLevel = lo.map(levels, level => ({
      levelName: level.name,
      assortments: PS.levelResults(level, outletStats, assortmentMap),
      blocks: PS.blockResults(level, outletStats, articleIdsMapByLevel.get(level.name)),
    }));

    const bestStatIndex = lo.findLastIndex(statsByLevel, stat => {
      const { assortments: a, blocks: b } = stat;
      return successResults(a) && successResults(b);
    });

    const perfectShop = {
      level: bestStatIndex >= 0 ? statsByLevel[bestStatIndex].levelName : null,
      stats: lo.keyBy(statsByLevel, 'levelName'),
    };

    if (bestStatIndex + 1 < statsByLevel.length) {

      const nextStat = statsByLevel[bestStatIndex + 1];
      const { assortments: a, blocks: b } = nextStat;

      Object.assign(perfectShop, {
        nextLevel: nextStat.levelName,
        assortmentsProgress: levelProgressInfo(a),
        blocksProgress: levelProgressInfo(b),
        // assortments: a,
        // blocks: b,
      });

    }

    return {
      outletId,
      dateB,
      dateE,
      perfectShop,
    };

  });

}

async function mergeOutletSalesman(anywhere, dateB, dateE) {

  const rawData = await anywhere.execImmediate(sql.SELECT_OUTLET_SALESMAN, [dateB, dateE]);

  const data = rawData.map(item => ({
    outletId: item.outletId,
    dateB,
    dateE,
    outletName: item.outletName,
    salesman: {
      id: item.salesmanId,
      name: salesmanName(item.salesmanName),
      salesGroupName: item.salesGroupName,
    },
  }));

  await OutletStats.merge(data);

}


function successResults(results) {
  return !lo.find(results, notSuccess);
}

function notSuccess({ result }) {
  return !result;
}

function levelProgressInfo(stat) {
  return `${stat.length - lo.filter(stat, notSuccess).length} / ${stat.length}`;
}

function salesmanName(name) {
  return lo.take(lo.split(name, /[ ]+/), 2).join(' ');
}
