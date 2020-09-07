import 'sistemium-telegram/config/aws';
import { Consumer } from 'sqs-consumer';
import { SQS } from 'aws-sdk';
import log from 'sistemium-telegram/services/log';
import campaignNews from './news/campaignNews';
import campaignsSharing from './import/campaignsSharing';

const { debug, error } = log('news');
const { SQS_QUEUE_URL } = process.env;

if (!SQS_QUEUE_URL) {
  throw new Error('No SQS_QUEUE_URL');
}

const app = Consumer.create({
  queueUrl: SQS_QUEUE_URL,
  handleMessage,
  sqs: new SQS(),
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
  // error('stopped');
}

async function handleMessage({ Body: msgBody }) {

  debug('message:', msgBody);

  switch (msgBody) {
    case 'campaignsSharing':
      await campaignsSharing();
      break;
    case 'campaignNews':
    case 'send':
    case 'test':
    default:
      await campaignNews(msgBody);
  }

}
