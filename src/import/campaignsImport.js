import log from 'sistemium-debug';
import lo from 'lodash';
import Anywhere from 'sistemium-sqlanywhere';

import { toDateString } from '../lib/dates';
import Campaign from '../models/marketing/Campaign';
import CampaignsPriority from '../models/marketing/CampaignsPriority';

const { debug } = log('import:campaigns');

export default async function (model) {

  await importOld();

  const filter = {
    variants: { $elemMatch: { 'conditions.articles': { $not: { $size: 0 } } } },
    dateE: { $gte: toDateString(new Date(), -7) },
  };

  const { CAMPAIGNS_PARTNER_IDS } = process.env;

  if (!CAMPAIGNS_PARTNER_IDS) {
    debug('empty CAMPAIGNS_PARTNER_IDS');
    return;
  }

  const partnerIds = CAMPAIGNS_PARTNER_IDS !== '*' && CAMPAIGNS_PARTNER_IDS.split(',');

  if (partnerIds) {
    filter['variants.restrictions.partnerGroupIds'] = { $in: partnerIds };
  }

  const raw = await model.find(filter);

  const data = raw.map(importCampaign);

  debug('source', raw.length);

  const withDiscount = lo.filter(data, hasAnyDiscount);
  const withoutDiscount = lo.filter(data, d => !hasAnyDiscount(d));

  const merged = await Campaign.mergeIfChanged(withDiscount);

  debug('merged', merged.length, 'withoutDiscount', withoutDiscount.length);

}

export function hasAnyDiscount({ discount, variants }) {

  if (discount) {
    return true;
  }

  return lo.find(variants, ({ articles }) => lo.find(articles, 'discount'));

}

export function importCampaign(rawCampaign) {

  const campaign = rawCampaign.toObject ? rawCampaign.toObject() : rawCampaign;

  const variants = lo.map(campaign.variants, importVariant);

  return {
    ...lo.pick(campaign, ['code', 'name', 'discount', 'restrictions']),
    id: rawCampaign.id,
    dateB: toDateString(campaign.dateB),
    dateE: toDateString(campaign.dateE),
    source: 'new',
    isActive: true,
    commentText: null,
    variants: lo.filter(variants),
    processing: null,
  };

}

function discountFull({ discountOwn, discountComp }) {
  return (discountOwn || 0) + (discountComp || 0);
}

function conditionsArticleIds(condition) {
  const { articleId, sameArticleIds } = condition;
  return lo.uniq([articleId, ...sameArticleIds]);
}

function conditionToArticle(condition) {
  return lo.map(condition.articles, a => ({
    id: a.articleId,
    articleIds: conditionsArticleIds(a),
    discount: discountFull(a),
  }));
}

export function importVariant(v) {

  const {
    name,
    conditions,
    id,
    restrictions,
  } = v;

  const articleIds = conditions.map(({ articles }) => {
    const ids = lo.map(articles, conditionsArticleIds);
    return lo.uniq(lo.flatten(ids));
  });

  const articles = lo.flatten(lo.map(conditions, conditionToArticle));

  const res = {
    id,
    name,
    articles,
    articleIds: lo.uniq(lo.flatten(articleIds)),
  };

  if (restrictions) {
    res.restrictions = lo.pick(restrictions, ['outletId', 'partnerId', 'salesmanId']);
  }

  if (!res.articleIds.length) {
    return null;
  }

  return res;

}


const SELECT_CAMPAIGNS = `SELECT
    uuidToStr(xid) as id,
    groupCode,
    processing,
    coalesce(
      -- if priorityId is not null then string('Важное', ' ', cmp.name) endif,
      if groupCode in ('op','mvz','cfo','ot') and name not regexp '^[.]*(ОП|МВЗ|ЦФО).*'
      then string(
          case
            when groupCode = 'op' then '.ОП'
            when groupCode = 'ot' then 'ON-T'
            when groupCode = 'mvz' then 'МВЗ'
            when groupCode = 'cfo' then 'ЦФО'
            else ''
          end,
          ' ', cmp.name
      ) endif,
    name) as name,
    commentText, isActive, dateB, dateE,
    priorityId,
    territory,
    oneTime,
    repeatable,
    needPhoto,
    comments,
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
  const priorities = await CampaignsPriority.find();

  const priorityMap = lo.keyBy(priorities, 'id');

  debug('importOld:source', data.length);

  const merged = await Campaign.mergeIfChanged(data.map(item => ({
    ...item,
    comments: item.comments ? JSON.parse(item.comments) : null,
    name: lo.filter([lo.get(priorityMap, `${item.priorityId}.name`), item.name]).join(' '),
    isActive: item.isActive === 1 || item.processing === 'published',
    oneTime: !!item.oneTime,
    repeatable: !!item.repeatable,
    needPhoto: !!item.needPhoto,
    source: 'old',
    discount: null,
  })));

  debug('importOld:merged', merged.length);

  await conn.disconnect();
  debug('disconnected');

}
