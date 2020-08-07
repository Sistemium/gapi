import { toManyFiltered, toOneLookup } from 'sistemium-mongo/lib/pipeline';
import log from 'sistemium-telegram/services/log';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import * as mongo from 'sistemium-mongo/lib/mongoose';
import lo from 'lodash';
import http from '../lib/axios';
import Campaign from '../models/Campaign';
import Action from '../models/Action';
import ActionHistory from '../models/ActionHistory';
import { toDateString } from '../lib/dates';
import { campaignGroups } from '../lib/campaigns';
import { importOld } from '../import/campaignsImport';

const { debug } = log('news:campaign');

debug('init');

const BULLET = '•';
const TAB = '╰';

export default async function (message) {

  await mongo.connect();

  await importOld();
  const campaigns = await findCreated();
  const history = await findUpdated();

  await publishCreated(campaigns, history, message === 'test');

}

async function findUpdated() {

  const $match = { isPublished: { $ne: true }, commentText: { $ne: '' } };

  const lookupAction = toOneLookup(
    'Action',
    'actionId',
    'action',
  );

  const lookupCampaign = toOneLookup(
    'Campaign',
    'action.campaignId',
    'campaign',
  );

  const pipeline = [
    { $match },
    ...lookupAction,
    ...lookupCampaign,
  ];

  const history = await ActionHistory.aggregate(pipeline);

  debug('history', history.length);

  return history;

}

async function findCreated() {

  const $match = {
    ...actualDatesFilter(),
    processing: 'published',
  };

  const lookup = toManyFiltered(
    'Action',
    'campaignId',
    'actions',
    { isPublished: { $ne: true } },
  );

  const pipeline = [
    { $match },
    lookup,
    { $match: { actions: { $not: { $size: 0 } } } },
  ];

  const campaigns = await Campaign.aggregate(pipeline);

  debug('campaigns:', campaigns.length);

  return campaigns;

}

async function publishCreated(allCampaigns, allHistory, dryRun = false) {

  const grouped = lo.map(campaignGroups(), ({ value, label }) => ({
    label,
    code: value,
    campaigns: lo.filter(allCampaigns, { groupCode: value }),
    history: lo.filter(allHistory, ({ campaign }) => campaign.groupCode === value),
  }));

  const filtered = lo.filter(grouped, g => g.campaigns.length || g.history.length);

  if (!filtered.length) {
    debug('publishCreated:empty');
    return;
  }

  await eachSeriesAsync(filtered, async groupData => {

    const { campaigns, label, history } = groupData;

    const newsMessage = {
      body: campaignsNewsBody(campaigns, history),
      subject: `Обновление акций ${label}`,
      dateB: toDateString(new Date(), 0),
      dateE: toDateString(new Date(), 1),
      appVersion: '0.0.0',
    };

    // debug(newsMessage);

    if (dryRun) {
      debug('DRY_RUN', newsMessage.subject, newsMessage.body);
      return;
    }

    const created = await createNewsMessage(newsMessage);
    debug('created', created.subject, created.id);

    await commitCampaigns(campaigns);
    await commitHistory(history);

  });

}

async function commitCampaigns(campaigns) {

  const $in = lo.flatten(lo.map(campaigns, ({ actions }) => lo.map(actions, 'id')));

  debug('commitCampaigns', $in);

  if (!$in.length) {
    return;
  }

  await Action.updateMany({ id: { $in } }, { $set: { isPublished: true } }, { strict: false });

}

async function commitHistory(history) {

  const $in = lo.map(history, 'id');

  if (!$in.length) {
    return;
  }

  const $set = { isPublished: true };

  await ActionHistory.updateMany({ id: { $in } }, { $set }, { strict: false });

}

function historyNewsLine(history) {

  const { campaign, action, commentText } = history;

  return [
    BULLET,
    `${lo.trim(campaign.name, '. ')} (${lo.trim(action.name)})\n${TAB} ${lo.trim(commentText)}`,
  ].join(' ');

}

function campaignsNewsBody(campaigns, history) {

  const body = [];

  if (campaigns.length) {
    const lines = campaigns.map(campaignNewsLine);
    body.push([
      '*Добавлены новые акции:*',
      '',
      ...lo.orderBy(lines),
    ].join('\n'));
  }

  if (history.length) {
    const lines = history.map(historyNewsLine);
    body.push([
      '*Изменены условия акций:*',
      '',
      ...lo.orderBy(lines),
    ].join('\n'));
  }

  return lo.filter(body).join('\n\n');

}

function actualDatesFilter(today = toDateString(new Date())) {
  return {
    dateB: { $lte: today },
    dateE: { $gte: today },
  };
}


function campaignNewsLine(campaign) {

  const actions = lo.uniq(campaign.actions.map(actionNewsLine));

  return [
    `${BULLET} ${lo.trim(campaign.name, '. ')}`,
    ...actions,
  ].join('\n');

}

function actionNewsLine(action) {
  return `${TAB} ${lo.trim(action.name)}`;
}

export async function createNewsMessage(props) {
  return http.post('NewsMessage', props);
}
