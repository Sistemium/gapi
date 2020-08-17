import { toManyFiltered, toOneLookup } from 'sistemium-mongo/lib/pipeline';
import log from 'sistemium-telegram/services/log';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import * as mongo from 'sistemium-mongo/lib/mongoose';
import lo from 'lodash';
import { v4 } from 'uuid';
import http from '../lib/axios';
import Publication from '../models/etc/Publication';
import Campaign from '../models/Campaign';
import Action from '../models/Action';
import ActionHistory from '../models/ActionHistory';
import { toDateString, humanDate } from '../lib/dates';
import { campaignGroups } from '../lib/campaigns';
import { importOld } from '../import/campaignsImport';

const { debug } = log('news:campaign');

debug('init');

const BULLET = '•';
const TAB = '╰';

export default async function (message) {

  await mongo.connect();
  const dryRun = message === 'test';

  if (!dryRun) {
    await importOld();
  }

  const campaigns = await findCreated();
  const history = await findUpdated();

  await publishCreated(campaigns, history, dryRun);

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

  const date = new Date();
  const dateB = toDateString(date, 0);
  const dateE = toDateString(date, 1);

  await eachSeriesAsync(filtered, async groupData => {

    const { campaigns, label, history } = groupData;
    const chapters = newsChapters(campaigns, history);
    const subject = `Обновление акций ${label} ${humanDate(date)}`;

    const newsMessage = {
      body: campaignsNewsBody(chapters),
      subject,
      dateB,
      dateE,
      appVersion: '0.0.0',
    };

    // debug(newsMessage);

    if (dryRun) {
      debug('DRY_RUN:chapters', JSON.stringify(chapters));
      debug('DRY_RUN:newsMessage', newsMessage.subject, newsMessage.body);
      return;
    }

    const created = await createNewsMessage(newsMessage);
    debug('created', created.subject, created.id);

    const publication = await savePublication(date, subject, chapters, groupData.code);
    debug('publication', publication);

    await commitCampaigns(campaigns, publication);
    await commitHistory(history, publication);

  });

}

async function savePublication(date, subject, chapters, code) {
  return Publication.create({
    id: v4(),
    type: 'campaignNews',
    date,
    subject,
    chapters,
    tags: [code],
  });
}

async function commitCampaigns(campaigns, publication) {

  const $in = lo.flatten(lo.map(campaigns, ({ actions }) => lo.map(actions, 'id')));
  const { id: publicationId } = publication;

  debug('commitCampaigns', publicationId, $in);

  if (!$in.length) {
    return;
  }

  const $set = { isPublished: true, publicationId };

  await Action.updateMany({ id: { $in } }, { $set }, { strict: false });

}

async function commitHistory(history, publication) {

  const $in = lo.map(history, 'id');
  const { id: publicationId } = publication;

  debug('commitHistory', publicationId, $in);

  if (!$in.length) {
    return;
  }

  const $set = { isPublished: true, publicationId };

  await ActionHistory.updateMany({ id: { $in } }, { $set }, { strict: false });

}

function campaignsNewsBody(chapters) {
  return lo.map(chapters, section => [
    `*${section.header}*`,
    '',
    ...section.chapters.map(({ name, text, list }) => lo.filter([
      `${BULLET} ${name}`,
      text && `${TAB} ${text}`,
      list && list.map(item => `${TAB} ${item}`),
    ]).join('\n')),
  ].join('\n')).join('\n\n');
}

function newsChapters(campaigns, history) {

  const chapters = [];

  if (campaigns.length) {
    const lines = campaigns.map(campaignNewsLine);
    chapters.push({
      type: 'added',
      header: 'Добавлены новые акции',
      chapters: lo.orderBy(lines, 'name'),
    });
  }

  if (history.length) {
    const lines = history.map(historyNewsLine);
    chapters.push({
      type: 'modified',
      header: 'Изменены условия акций',
      chapters: lo.orderBy(lines, 'name'),
    });
  }

  return chapters;

}

function actualDatesFilter(today = toDateString(new Date())) {
  return {
    dateB: { $lte: today },
    dateE: { $gte: today },
  };
}


function campaignNewsLine(campaign) {

  return {
    name: mapName(campaign),
    list: lo.uniq(campaign.actions.map(mapName)),
  };

}


function historyNewsLine(history) {

  const { campaign, action, commentText } = history;

  return {
    name: `${mapName(campaign)} (${mapName(action)})`,
    text: lo.trim(commentText),
  };

}


function mapName({ name }) {
  return lo.trim(name, '. ');
}


export async function createNewsMessage(props) {
  return http.post('NewsMessage', props);
}
