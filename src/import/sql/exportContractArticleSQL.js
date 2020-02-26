export const declare = `declare local temporary table #discount (

    contractId STRING,
    articleId STRING,
    discount MONEY,
    type STRING,

    primary key(contractId, articleId)

  )`;

export const insert = `insert into #discount (
    contractId,
    articleId,
    discount,
    type,
  ) values (?, ?, ?, ?)`;

export const merge = `merge into bs.ContractArticle as d using with auto name (
    select
      c.id as contract,
      a.id as article,
      d.discount,
      d.type,
      0 as isDeleted
    from #discount d
      join bs.Contract c on c.xid = d.contractId
      join bs.ArticleTable a on a.xid = d.articleId
  ) as t on t.contract = d.contract and t.article = d.article
  when not matched then insert
  when matched and (
      d.discount <> t.discount or
      d.type <> t.type or
      d.contract <> t.contract or
      d.article <> t.article
    ) then update
  `;

// export const nullify = `update ch.Debt
//     set
//       summ0 = 0,
//       summ1 = 0
//     where (isNull(summ0, 0) <> 0 or isNull(summ1, 0) <> 0)
//       and code not in (
//         select code from #debt
//       )
//      -- and 1 = 0
//   `;
//
// export const postProcess = 'call bs.merge_Debt()';
