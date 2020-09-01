import ModelSchema from 'sistemium-mongo/lib/schema';
import assert from '../lib/assert';

const Importing = new ModelSchema({
  collection: 'Importing',
  schema: {
    name: String,
    timestamp: Date,
    params: Object,
  },
  mergeBy: ['name'],
}).model();

export default Importing;

export async function lastImportedFilter(name) {
  assert(name, 'name param is required');
  const lastImport = await Importing.findOne({ name });
  const { params: { offset: $gt, filter = '{}' } } = lastImport || { params: {} };
  return { ...JSON.parse(filter), ...($gt ? { ts: { $gt } } : {}) };
}

export async function saveOffset(name, offset) {
  assert(name, 'name param is required');
  await Importing.updateOne({ name }, { $set: { 'params.offset': offset, ts: new Date() } });
}
