export const declare = `declare local temporary table #discount (

    partnerId STRING,
    priceGroupId STRING,
    discount MONEY,
    type STRING,

    primary key(partnerId, priceGroupId)

  )`;

export const insert = `insert into #discount (
    partnerId,
    priceGroupId,
    discount,
    type,
  ) values (?, ?, ?, ?)`;

export const merge = `merge into bs.PartnerPriceGroup as d using with auto name (
    select
      c.id as partner,
      a.id as priceGroup,
      d.discount,
      d.type,
      0 as isDeleted
    from #discount d
      join bs.Partner c on c.xid = d.partnerId
      join bs.PriceGroup a on a.xid = d.priceGroupId
  ) as t on t.partner = d.partner and t.priceGroup = d.priceGroup
  when not matched then insert
  when matched and (
      d.discount <> t.discount or
      d.type <> t.type or
      d.partner <> t.partner or
      d.priceGroup <> t.priceGroup
    ) then update
  `;
