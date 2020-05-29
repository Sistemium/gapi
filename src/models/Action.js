import ModelSchema from 'sistemium-mongo/lib/schema';
import { Schema } from 'mongoose';

const optionSchema = new Schema({
  // id: String,
  name: String,
  campaignId: String,
  commentText: String,
  ranges: { type: [{ name: String }], default: undefined },
  required: {
    pcs: Number,
    volume: Number,
    sku: Number,
    cost: Number,
  },
  discountComp: Number,
  discountOwn: Number,
  price: Number,
  dateB: String,
  dateE: String,
  territory: String,
  oneTime: Boolean,
  repeatable: Boolean,
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

export default new ModelSchema({
  collection: 'Action',
  mongoSchema: optionSchema,
  tsType: 'timestamp',
}).model();
