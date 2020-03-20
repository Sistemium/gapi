import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'WarehousePaletteConfirmed',
  schema: {
    barcode: String,
    deviceUUID: String,
    deviceCts: String,
    warehousePaletteId: String,
    warehouseBoxIds: [String],
    warehouseItemIds: [String],
  },
  indexes: [{ barcode: 1 }],
  tsType: 'timestamp',
}).model();
