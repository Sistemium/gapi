import log from 'sistemium-telegram/services/log';
import * as mongoose from 'sistemium-mongo/lib/mongoose';
import debounce from 'lodash/debounce';

// import { schema as stockSchema } from '../models/Stock';
// import { articleSchema } from '../models/Article';
// import { processingSchema } from '../models/Processing';
//
import campaignsImport from './import/campaignsImport';
import articleImport from './import/articleImport';
import discountImport from './import/discountImport';

const { debug, error } = log('watch');

const WATCH_DEBOUNCE = parseInt(process.env.WATCH_DEBOUNCE, 0) || 5000;
const { MONGO_URL_1C: MONGO_URL } = process.env;


main().catch(error);

async function main() {

  debug('MONGO_URL', MONGO_URL);
  const mongo = await mongoose.connection(MONGO_URL);

  await mongoose.connect();

  watch(mongo);

}

function watch(mongo) {

  watcher('Campaign', campaignsImport, false);
  watcher('Article', articleImport, false);
  watcher('Discount', discountImport, true);

  function watcher(name, callback, immediate = false) {

    const model = mongo.model(name, { _id: String }, name);

    const debouncedProcessing = debounce(() => {
      callback(model).catch(error);
    }, WATCH_DEBOUNCE);


    model.watch()
      .on('change', ({ operationType }) => {
        debug(name, operationType);
        debouncedProcessing();
      })
      .on('error', err => error(err));

    if (immediate) {
      callback(model).catch(error);
    }

  }

}

process.on('SIGINT', async () => {

  error('SIGINT');

  await mongoose.disconnect()
    .then(() => debug('disconnected main'))
    .catch(error);

  process.exit();

});
