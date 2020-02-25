import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Importing',
  schema: {
    name: String,
    timestamp: Date,
    params: Object,
  },
  mergeBy: ['name'],
}).model();
