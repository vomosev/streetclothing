module.exports = {
  plans: [
    {
      id: 'street-pass-monthly',
      name: 'Street Pass Monthly',
      description:
        'Membership for the STREET/PLATINUM community — early access to every drop, free shipping and member-only colorways.',
      amount: 900,
      interval: 'month',
      intervalCount: 1,
      features: [
        'Early access to every drop, 24 hours before public release',
        'Free standard shipping on all orders',
        'Member-only platinum colorways',
        'Extended 60-day returns',
        'Priority restock notifications',
      ],
    },
    {
      id: 'street-pass-yearly',
      name: 'Street Pass Yearly',
      description:
        'Twelve months of Street Pass for the price of ten — every membership perk, billed once a year.',
      amount: 9000,
      interval: 'year',
      intervalCount: 1,
      features: [
        'Everything in Street Pass Monthly',
        'Two months free versus monthly billing',
        'Guaranteed size hold on limited drops',
        'Annual members-only archive piece invite',
        'Free express shipping upgrades',
      ],
    },
  ],
  products: [
    {
      id: 'gift-card-50',
      name: 'Digital Gift Card — $50',
      description:
        'A $50 STREET/PLATINUM digital gift card, delivered by email and redeemable on any piece in the store.',
      amount: 5000,
    },
    {
      id: 'drop-preorder-deposit',
      name: 'Drop Pre-Order Deposit',
      description:
        'Reserve your size on the next limited drop. The $25 deposit is credited against the final price at release.',
      amount: 2500,
    },
  ],
};