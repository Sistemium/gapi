import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Campaign',
  schema: {
    name: String,
    code: String,
    dateB: String,
    dateE: String,
    discount: Number,
    variants: Array,
    commentText: String,
    isActive: Boolean,
    source: String,
    restrictions: Object,
    groupCode: String,
    processing: String,

    needPhoto: Boolean,
    oneTime: Boolean,
    repeatable: Boolean,
    territory: String,

    priorityId: String,

    parentCampaignId: String,

    restrictedActions: Array,
  },
  tsType: 'timestamp',
}).model();
