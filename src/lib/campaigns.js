export function campaignGroups() {
  return [
    {
      label: 'ОП',
      value: 'op',
      order: 1,
    },
    {
      label: 'МВЗ',
      value: 'mvz',
      order: 2,
    },
    {
      label: 'ЦФО',
      value: 'cfo',
      order: 3,
    },
  ];
}

const mapCampaigns = campaignGroups().map(({ value, label }) => [value, label]);

export const campaignGroupsMap = new Map(mapCampaigns);
