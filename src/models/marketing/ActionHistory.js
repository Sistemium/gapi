import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'ActionHistory',
  schema: {
    actionId: String,
    commentText: String,
    archived: Object,
  },
  tsType: 'timestamp',
}).model();
