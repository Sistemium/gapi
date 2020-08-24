export default [
  { $match: { _id: '3566912a-471e-11ea-819a-005056850f57' } },
  { $unwind: '$priceGroups' },
  {
    $project: {
      _id: false,
      documentId: '$_id',
      discount: true,
      isDeleted: true,
      isProcessed: true,
      dateE: true,
      discountCategoryId: true,
      documentDate: '$dateB',
      receivers: '$receivers',
      targetId: '$priceGroups.priceGroupId',
      articleDiscount: '$priceGroups.discount',
    },
  },
  { $match: { targetId: '60f22942-1002-11e0-9d54-00237deee66e' }},
];
