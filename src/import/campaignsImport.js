import log from 'sistemium-telegram/services/log';
import fpOmit from 'lodash/fp/omit';

import Campaign from '../models/Campaign';

const { debug } = log('import:campaigns');

const omitId = fpOmit('_id');

export default async function (model) {

  const raw = await model.find();

  debug('raw', raw.length);

  const data = raw.map(item => omitId({ ...item.toObject(), id: item.id }));

  const merged = await Campaign.merge(data);

  debug('merged', merged.length, merged[10]);

  return Promise.resolve(null);

}
