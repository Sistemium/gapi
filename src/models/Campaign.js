import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Campaign',
  schema: {
    name: String,
    code: String,
  },
  tsType: 'timestamp',
}).model();
