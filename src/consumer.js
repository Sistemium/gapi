import { Consumer } from 'sqs-consumer';
import { SQS } from 'aws-sdk';
import log from 'sistemium-debug';
import campaignNews from './news/campaignNews';
import campaignsSharing from './import/campaignsSharing';
import exportArchive from './import/exportArchive';
import exportOutletStats from './import/exportOutletStats';
import perfectShopNews from './news/perfectShopNews';

const { debug, error } = log('news');
const { SQS_QUEUE_URL } = process.env;

if (!SQS_QUEUE_URL) {
  throw new Error('No SQS_QUEUE_URL');
}

const app = Consumer.create({
  queueUrl: SQS_QUEUE_URL,
  handleMessage,
  sqs: new SQS({ region: 'eu-west-1' }),
});

['error', 'processing_error', 'timeout_error'].forEach(eventName => {
  app.on(eventName, err => {
    error(eventName, err.message);
  });
});

app.start();

process.on('SIGINT', stop);

function stop() {
  error('stopping');
  app.stop();
  process.exit();
  // error('stopped');
}

async function handleMessage({ Body: msgBody }) {

  debug('message:', msgBody);

  const { name, param } = msgParam(msgBody);

  switch (name) {
    case 'exportOutletStats':
      await exportOutletStats(param);
      break;
    case 'perfectShopNews':
      await perfectShopNews(param);
      break;
    case 'campaignsSharing':
      await campaignsSharing();
      break;
    case 'exportArchive':
      await exportArchive();
      break;
    case 'campaignNews':
    case 'send':
    case 'test':
      await campaignNews(name);
      break;
    default:
      error('unknown message type', msgBody);
  }

}

function msgParam(msgBody) {
  const [, name, param] = msgBody.match(/(^[^/]+)\/?(.*)$/);
  return { name, param };
}
