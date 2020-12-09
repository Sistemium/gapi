export const declare = `declare local temporary table #removed (

    name STRING,
    objectXid STRING,

    primary key(name, objectXid)

  )`;

export const insert = `insert into #removed (
    name,
    objectXid,
  ) values (?, ?)`;

export const merge = `merge into ch.EntityRemoved as d using with auto name (
    select
      name,
      objectXid,
      0 as isTemporary
    from #removed
  ) as t on t.name = d.name and t.objectXid = d.objectXid
  when not matched then insert
  when matched then skip
`;
