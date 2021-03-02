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
  discountComp: { type: Number, default: 0 },
  discountOwn: { type: Number, default: 0 },
  discountCash: { type: Number, default: 0 },
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

const layout = {
  pictures: [
    {
      _id: false,
      id: String,
      articlePictureId: String,
      src: String,
      thumbnailSrc: String,
      label: String,
      height: Number,
    },
  ],
  align: String,
  commentText: String,
};

const mongoSchema = new Schema(optionSchema);
mongoSchema.add({
  campaignId: String,
  dateB: String,
  dateE: String,
  territory: String,
  oneTime: { type: Boolean, default: false },
  repeatable: { type: Boolean, default: false },
  needPhoto: { type: Boolean, default: false },
  priorityId: String,
  creatorAuthId: String,
  layout,
});

export default new ModelSchema({
  collection: 'Action',
  mongoSchema,
  tsType: 'timestamp',
}).model();
