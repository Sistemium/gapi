import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Publication',
  schema: {
    type: String,
    date: String,
    subject: String,
    chapters: Array,
    tags: Array,
  },
  tsType: 'timestamp',
}).model();
