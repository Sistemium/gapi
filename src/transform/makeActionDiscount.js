import lo from 'lodash';
import log from 'sistemium-debug';
import { toOneLookup } from 'sistemium-mongo/lib/pipeline';

// import ActionDiscount from '../models/marketing/ActionDiscount';
import Action from '../models/marketing/Action';

const { debug } = log('transform:action');

export default async function () {

  debug('start');

  const data = await getData('2021-01-01');

  const mapped = lo.map(data, actionDiscountFromAction);

  const filtered = lo.filter(mapped, 'length');
  const flattened = lo.flatten(filtered);

  debug(lo.filter(flattened, ({
    name,
    type,
  }) => name && type === 'action'), 'of', filtered.length, 'from total', data.length);

}

export function actionDiscountName(props) {
  const { actionName, campaignName, name } = props;
  const { type, discountTotal } = props;

  debug(actionName, campaignName, type, discountTotal);

  return name;
}

function actionDiscountFromAction(campaignAction) {

  const { name: campaignName } = campaignAction.campaign || {};
  const { options: variants, id: actionId, name: actionName } = campaignAction;

  const ownDiscount = discountInfo(campaignAction);
  const defaults = { campaignName, actionName };

  if (ownDiscount) {
    return [{
      ...defaults,
      actionId,
      ...ownDiscount,
      type: 'action',
    }];
  }

  const variantsDiscount = lo.map(variants, variant => {
    const res = discountInfo(variant);
    const { options } = variant;
    return res ? { ...res, type: 'variant' } : lo.map(options, discountInfo).map(o => ({ ...o, type: 'option' }));
  });

  const res = lo.flattenDeep(variantsDiscount);

  return lo.map(lo.filter(res), item => ({
    ...item,
    actionId,
    campaignName,
    ...defaults,
  }));

}

function discountInfo(action) {

  const { discountOwn, discountComp, _id: ref } = action;
  const discountTotal = (discountOwn || 0) + (discountComp || 0);

  if (!discountTotal) {
    return null;
  }

  const { ranges } = action;
  const name = action.name || (lo.get(ranges, 'length') === 1 ? ranges[0].name : undefined);

  const res = {
    ref,
    name,
    discountOwn,
    discountComp,
    discountTotal,
  };

  if (!name && ranges && ranges.length) {
    res.ranges = ranges;
  }

  return res;

}

async function getData(dateB) {

  const $match = {
    'campaign.dateB': { $gte: dateB },
    'campaign.processing': 'published',
  };

  debug('getData', $match);

  const pipeline = [
    ...toOneLookup('Campaign', 'campaignId'),
    { $match },
    { $sort: { ts: 1 } },
  ];

  return Action.aggregate(pipeline);

}
