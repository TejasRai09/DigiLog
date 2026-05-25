/** Keys stored in `user_homepage_cards.card_key` — must match backend. */
export const HOMEPAGE_CARD_KEYS = {
  FORMS_HUB: 'forms_hub',
  BI_CONTROL_TOWER: 'bi_control_tower',
};

export const HOMEPAGE_CARD_OPTIONS = [
  {
    key: HOMEPAGE_CARD_KEYS.FORMS_HUB,
    label: 'Forms Hub',
    description: 'Large homepage card linking to operational forms and logbooks.',
  },
  {
    key: HOMEPAGE_CARD_KEYS.BI_CONTROL_TOWER,
    label: 'BI Control Tower',
    description: 'Large homepage card linking to assigned analytics dashboards.',
  },
];

export function homepageCardLabel(key) {
  return HOMEPAGE_CARD_OPTIONS.find((c) => c.key === key)?.label ?? key;
}
