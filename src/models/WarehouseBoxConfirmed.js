import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'WarehouseBoxConfirmed',
  schema: {
    barcode: String,
    deviceUUID: String,
    deviceCts: String,
    warehouseBoxId: String,
    warehouseItemIds: [Array],
  },
  indexes: [{ barcode: 1 }],
  tsType: 'timestamp',
}).model();
