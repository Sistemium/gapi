import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Configuration',
  schema: {
    type: String,
    dateB: String,
    dateE: String,
    rules: Object,
  },
  tsType: 'timestamp',
}).model();
