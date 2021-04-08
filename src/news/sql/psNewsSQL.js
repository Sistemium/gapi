export const DECLARE_BLOCK = `declare local temporary table #block (

    // blockName STRING,
    // assortmentId STRING,
    articleId STRING,

    primary key(articleId)

  )`;

export const INSERT_BLOCK = `insert into #block (
    // blockName,
    // assortmentId,
    articleId
  ) values (?)`;

export const SELECT_SHIPMENTS = `SELECT
    o.xid as outletId,
    a.xid as articleId,
    country.xid as countryId,
    brand.xid as brandId,
    isNull(articleSame.xid, a.xid) as skuId,
    cast(sum(sp.volume) as INT) as pieceCnt,
    sum(sp.volume * a.pieceVolume) as litreCnt,
    sum(sp.price0 * sp.volume) as shipmentCost
  FROM ch.Shipment sh
    JOIN bs.Outlet o on o.id = sh.outlet
    JOIN ch.ShipmentPosition sp on sp.shipment = sh.id
    JOIN bs.ArticleTable a on a.id = sp.article
      LEFT JOIN bs.ArticleTable articleSame on articleSame.id = a.articleSame
    JOIN #block b on b.articleId = a.xid
    LEFT JOIN bs.Brand on brand.id = a.brand
    LEFT JOIN ch.Country on country.id = a.country
  WHERE sh.[date] between ? and ?
    and sh.booking in ('Бух', 'Упр')
    and sh.processed in ('true', '1')
  GROUP BY outletId, articleId, skuId, countryId, brandId
`;

export const SELECT_OUTLET_SALESMAN = `SELECT
    c.name as outletName,
    sm.name as salesmanName,
    sg.name as salesGroupName,
    c.xid as outletId,
    sm.xid as salesmanId
  FROM bs.PerfectShopSalesman sm
      join bs.OutletSalesmanContract so on so.salesman = sm.id
      join bs.Customer c on c.id = so.outlet
      join bs.SalesGroup sg on sg.id = sm.salesGroup
  WHERE so.isDeleted = 0
    and exists (
      select * from ch.Shipment sh
      where sh.outlet = c.id
        and [date] between ? and ?
        and salesman = sm.id
        and sh.booking in ('Бух', 'Упр')
        and sh.processed in ('true', '1')
    )`;
