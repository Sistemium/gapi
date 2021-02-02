import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'CampaignsPriority',
  schema: {
    name: String,
    ord: Number,
    cls: String,
    isInternal: { type: Boolean, default: false },
  },
  tsType: 'timestamp',
}).model();
