export const declare = `declare local temporary table #stats (

    outletId STRING,
    salesmanId STRING,
    stats STRING,
    dateB STRING,
    dateE STRING,
    xid UNIQUEIDENTIFIER,

    primary key(xid)

  )`;

export const insert = `insert into #stats (
    dateB,
    dateE,
    outletId,
    salesmanId,
    stats,
    xid
  ) values (?, ?, ?, ?, ?, ?)`;

export const merge = `merge into bs.OutletStats as d using with auto name (
    select
      o.id as outlet,
      s.id as salesman,
      d.stats,
      d.dateB,
      d.dateE,
      d.xid
    from #stats d
      join ch.Salesman s on s.xid = d.salesmanId
      join bs.Outlet o on o.xid = d.outletId
  ) as t on t.xid = d.xid
  when not matched then insert
  when matched and (
      d.stats <> t.stats or
      d.salesman <> t.salesman
    ) then update
  `;

// export const nullify = `
//   `;
//
// export const postProcess = 'call bs.merge_()';
