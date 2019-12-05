import log from 'sistemium-telegram/services/log';
// import fpOmit from 'lodash/fp/omit';
import lo from 'lodash';
import Anywhere from 'sistemium-sqlanywhere';

import { toDateString } from '../lib/dates';
import Campaign from '../models/Campaign';

const { debug } = log('import:campaigns');

// const omitId = fpOmit('_id');

export default async function (model) {

  const raw = await model.find({
    variants: { $not: { $size: 0 } },
    'variants.conditions.articles': { $not: { $size: 0 } },
  });

  debug('raw', raw[0]);

  const data = raw.map(importCampaign);

  const merged = await Campaign.mergeIfChanged(data);

  debug('merged', merged.length, 'of', raw.length);

  await importOld();

}

function importCampaign(rawCampaign) {

  const campaign = rawCampaign.toObject();

  const variants = lo.map(campaign.variants, importVariant);

  return {
    ...lo.pick(campaign, ['code', 'name', 'discount', 'restrictions']),
    id: rawCampaign.id,
    dateB: toDateString(campaign.dateB),
    dateE: toDateString(campaign.dateE),
    source: 'new',
    isActive: true,
    commentText: null,
    variants,
  };

}

function importVariant({ name, conditions, id }) {

  const articleIds = conditions.map(({ articles }) => {
    const ids = lo.map(articles, article => {
      const { articleId, sameArticleIds } = article;
      return [articleId, ...sameArticleIds];
    });
    return lo.uniq(lo.flatten(ids));
  });

  return {
    id,
    name,
    articleIds: lo.uniq(lo.flatten(articleIds)),
  };

}


const SELECT_CAMPAIGNS = `SELECT
    uuidToStr(xid) as id, name, commentText, isActive, dateB, dateE,
    (select max(xid) from bs.ActivityPeriod ap
          where not (date(cmp.dateE) < dateB or date(cmp.dateB) > dateE)
    ) as [campaignGroupId]
  FROM ch.Campaign as [cmp]
  WHERE dateE >= dateAdd(month, -2, today())
  ORDER BY cmp.ts
`;

export async function importOld() {

  const conn = new Anywhere();
  await conn.connect();
  debug('connected');

  const data = await conn.execImmediate(SELECT_CAMPAIGNS);

  debug('importOld:source', data.length);

  const merged = await Campaign.mergeIfChanged(data.map(item => ({
    ...item,
    source: 'old',
    discount: null,
  })));

  debug('importOld:merged', merged.length, 'of', data.length);

  await conn.disconnect();
  debug('disconnected');

}
