import 'sistemium-telegram/config/aws';
import { Consumer } from 'sqs-consumer';
import { SQS } from 'aws-sdk';
import log from 'sistemium-telegram/services/log';
import campaignNews from './news/campaignNews';

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

async function handleMessage(message) {
  debug('message:', message.Body);
  await campaignNews(message.Body);
}
