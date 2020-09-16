import ModelSchema from 'sistemium-mongo/lib/schema';
import { Schema } from 'sistemium-mongo/lib/mongoose';

const required = {
  pcs: Number,
  volume: Number,
  volumeTo: Number,
  sku: Number,
  cost: Number,
  costTo: Number,
  isMultiple: {
    type: Boolean,
    default: false,
  },
  etc: String,
};

const axis = { id: String, ...required };

const optionSchema = new Schema({
  name: String,
  commentText: String,
  ranges: [{ name: String }],
  required,
  discountComp: Number,
  discountOwn: Number,
  discountCash: Number,
  price: Number,
  cashBonus: Number,
  discountMatrix: {
    type: {
      axisX: [axis],
      axisY: [axis],
      values: [{ x: String, y: String, discountOwn: Number }],
    },
    default: null,
  },
});

optionSchema.add({
  options: {
    type: [optionSchema],
    default: undefined,
  },
  restrictions: {
    type: [optionSchema],
    default: undefined,
  },
});

const mongoSchema = new Schema(optionSchema);
mongoSchema.add({
  campaignId: String,
  dateB: String,
  dateE: String,
  territory: String,
  oneTime: Boolean,
  repeatable: Boolean,
  needPhoto: Boolean,
  priorityId: String,
});

export default new ModelSchema({
  collection: 'Action',
  mongoSchema,
  tsType: 'timestamp',
}).model();
