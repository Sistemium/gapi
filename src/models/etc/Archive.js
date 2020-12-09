import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Archive',
  schema: {
    name: String,
  },
  tsType: 'timestamp',
}).model();
