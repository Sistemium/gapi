export const declare = `declare local temporary table #discount (

    contractId STRING,
    priceGroupId STRING,
    discount MONEY,
    type STRING,

    primary key(contractId, priceGroupId)

  )`;

export const insert = `insert into #discount (
    contractId,
    priceGroupId,
    discount,
    type,
  ) values (?, ?, ?, ?)`;

export const merge = `merge into bs.ContractPriceGroup as d using with auto name (
    select
      c.id as contract,
      a.id as priceGroup,
      d.discount,
      d.type,
      0 as isDeleted
    from #discount d
      join bs.Contract c on c.xid = d.contractId
      join bs.PriceGroup a on a.xid = d.priceGroupId
  ) as t on t.contract = d.contract and t.priceGroup = d.priceGroup
  when not matched then insert
  when matched and (
      d.discount <> t.discount or
      d.type <> t.type or
      d.contract <> t.contract or
      d.priceGroup <> t.priceGroup
    ) then update
  `;
