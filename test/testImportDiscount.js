import { expect, assert } from 'chai';
import * as mongo from 'sistemium-mongo/lib/mongoose';
import lo from 'lodash';

import { readJsonFile } from '../src/lib/fs';
import * as di from '../src/import/discountImport';
import ContractPriceGroup from '../src/models/ContractPriceGroup';

const Discount = discountModel();
const PipelineResult = pipelineResult();

describe('Discount import', function () {

  it('should detect priority', async function () {

    const today = new Date().setUTCHours(0, 0, 0, 0);
    const priorityFn = di.latterPriority(today);

    const discountPlain = await readJsonFile('static/discountImportPipeline.json');
    const discount = new PipelineResult(discountPlain);

    const cpgPlain = await readJsonFile('static/contractPriceGroup.r50.json');
    const cpg = new ContractPriceGroup(cpgPlain).toObject();

    expect(discount.dateE).to.be.instanceOf(Date);
    expect(cpg.dateE).to.be.instanceOf(Date);

    const newItems = di.discountPipelineMap('contractId', 'priceGroupId')(discount);
    console.log(newItems);

    lo.forEach(newItems, newItem => {
      const priority = priorityFn(newItem, cpg);
      console.log(priority);
    });

  });

  it('should detect expired', async function () {

    const EXPIRING = 'expiring';
    const discountPlain = await readJsonFile('static/discount.r50.json');
    const discount = new Discount(discountPlain).toObject();
    const expiring = await readJsonFile('static/expiringContractPriceGroups.json');
    const today = new Date();
    const configKeys = [today, 'contractId', 'priceGroups', 'priceGroupId'];

    const expired = di.matchExpiredDiscounts([expiring], [discount], ...configKeys);
    // console.log(expired[0]);
    expect(expired).to.be.instanceOf(Array);

    const discountActual = { ...discount, dateE: new Date() };
    expiring.keys[0].contractId = EXPIRING;

    const expired2 = di.matchExpiredDiscounts([expiring], [discountActual], ...configKeys);

    expect(expired2.length).to.equal(1);
    expect(expired2[0].expiredKeys[0].contractId).to.equal(EXPIRING);

  });

  it('should should nullify ContractPriceGroup', async function () {

    this.timeout(15000);

    const { MONGO_URL, MONGO_URL_1C } = process.env;

    assert(MONGO_URL, 'MONGO_URL must be set');
    assert(MONGO_URL_1C, 'MONGO_URL_1C must be set');

    const sourceMongo = await mongo.connection(MONGO_URL_1C);
    await mongo.connect(MONGO_URL);

    const sourceDiscountModel = discountModel(sourceMongo);

    const config = [ContractPriceGroup, 'contractId', 'priceGroups', 'priceGroupId'];
    await di.nullifyMissing(sourceDiscountModel, di.clientDate(), ...config);

    await mongo.disconnect();

  });

  it('should should nullify all expired', async function () {

    this.timeout(45000);
    const { MONGO_URL, MONGO_URL_1C } = process.env;

    assert(MONGO_URL, 'MONGO_URL must be set');
    assert(MONGO_URL_1C, 'MONGO_URL_1C must be set');

    const sourceMongo = await mongo.connection(MONGO_URL_1C);
    await mongo.connect(MONGO_URL);

    const sourceDiscountModel = discountModel(sourceMongo);

    await di.nullifyAllMissing(sourceDiscountModel, di.clientDate());

    await mongo.disconnect();

  });

});

function discountModel(mongoose = mongo) {
  const name = 'Discount';
  return mongoose.model(name, {
    _id: String,
    ndoc: String,
    date: Date,

    dateB: Date,
    dateE: Date,

    isProcessed: Boolean,
    isDeleted: Boolean,

    discount: Number,
    commentary: String,

    articles: [{
      _id: false,
      articleId: String,
      discount: Number,
    }],

    priceGroups: [{
      _id: false,
      priceGroupId: String,
      discount: Number,
    }],

    receivers: [{
      _id: false,
      partnerId: String,
      contractId: String,
    }],
  }, name);
}

function pipelineResult() {
  const name = 'PipelineResult';
  return mongo.model(name, {
    'dateE': Date,
    'discount': Number,
    'discountCategoryId': String,
    'isDeleted': Boolean,
    'isProcessed': Boolean,
    'documentId': String,
    'documentDate': Date,
    'receivers': Array,
    'targetId': String,
    'articleDiscount': Number,
  }, name);
}
