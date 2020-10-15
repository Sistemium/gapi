import * as mongo from 'sistemium-mongo/lib/mongoose';
import log from 'sistemium-telegram/services/log';
import { toOneLookup } from 'sistemium-mongo/lib/pipeline';
import lo from 'lodash';
import Action from '../models/Action';
import Campaign from '../models/Campaign';
import assert from '../lib/assert';
import { lastImportedFilter, saveOffset } from '../models/Importing';

const { debug, error } = log('sharing:campaigns');
const PUBLISHED = 'published';

export default async function () {

  const { MONGO_URL, MONGO_URL_ACTIONS } = process.env;

  assert(MONGO_URL, 'MONGO_URL must be set');
  assert(MONGO_URL_ACTIONS, 'MONGO_URL_ACTIONS must be set');

  const sourceMongo = await mongo.connection(MONGO_URL_ACTIONS);
  await mongo.connect(MONGO_URL);

  try {
    await shareActions(sourceMongo);
    await shareCampaigns();
    await shareCampaignPictures();
  } catch (e) {
    error(e);
  }

  await mongo.disconnect();

}

const SHARE_ACTIONS = 'ShareActions';

async function shareActions(sourceMongo) {

  const source = sourceMongo.model('Action', Action.schema, 'Action');
  const sinceLastImported = await lastImportedFilter(SHARE_ACTIONS);
  assert(Object.keys(sinceLastImported).length, 'ShareActions last import must be set');

  const sourceActions = await source.aggregate([
    { $match: lo.pick(sinceLastImported, 'ts') },
    ...toOneLookup('Campaign', 'campaignId'),
    { $match: lo.omit(sinceLastImported, 'ts') },
    { $sort: { ts: 1 } },
  ]);

  debug('shareActions:sourceActions', sourceActions.length);

  if (!sourceActions.length) {
    return;
  }

  const data = sourceActions.map(importAction);

  const campaignIds = lo.uniq(lo.map(data, 'campaignId'));

  const ownCampaigns = await Campaign.find({ id: { $in: campaignIds } });

  const merged = await Action.mergeIfNotMatched(data, shouldUpsertAction, shouldUpsertAction);
  debug('shareActions:merged', merged.length);

  const { ts: offset } = lo.last(sourceActions);
  await saveOffset(SHARE_ACTIONS, offset);

  function shouldUpsertAction(action) {
    const campaign = lo.find(ownCampaigns, { id: action.campaignId });
    return !campaign || campaign.processing !== PUBLISHED;
  }

}

function importAction(action) {
  return lo.omit(action, ['_id', 'ts']);
}

async function shareCampaignPictures() {
  debug('shareCampaignPictures', 'not implemented');
}

async function shareCampaigns() {
  debug('shareCampaigns', 'not implemented');
}
