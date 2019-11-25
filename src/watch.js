import log from 'sistemium-telegram/services/log';
import * as mongoose from 'sistemium-mongo/lib/mongoose';
import debounce from 'lodash/debounce';

// import { schema as stockSchema } from '../models/Stock';
// import { articleSchema } from '../models/Article';
// import { processingSchema } from '../models/Processing';
//
import campaignsImport from './import/campaignsImport';

const { debug, error } = log('watch');

const WATCH_DEBOUNCE = parseInt(process.env.WATCH_DEBOUNCE, 0) || 5000;
const { MONGO_URL_1C: MONGO_URL } = process.env;


main().catch(error);

async function main() {

  debug('MONGO_URL', MONGO_URL);
  const mongo = await mongoose.connection(MONGO_URL);

  await mongoose.connect();

  const Campaign = mongo.model('Campaign', { _id: String }, 'Campaign');

  const debouncedProcessing = debounce(() => {
    campaignsImport(Campaign).catch(error);
  }, WATCH_DEBOUNCE);

  Campaign.watch()
    .on('change', ({ operationType }) => {
      debug('Campaign', operationType);
      debouncedProcessing();
    });

  debouncedProcessing();

}

process.on('SIGINT', async () => {

  error('SIGINT');

  await mongoose.disconnect()
    .then(() => debug('disconnected main'))
    .catch(error);

  process.exit();

});
