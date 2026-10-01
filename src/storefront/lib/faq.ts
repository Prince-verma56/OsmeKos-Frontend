export type Faq = { q: string; a: string };
export type FaqGroup = { id: string; title: string; items: Faq[] };

export const FAQS: FaqGroup[] = [
  {
    id: "product",
    title: "The lotion",
    items: [
      {
        q: "Who is the Body Lotion for?",
        a: "It's formulated for all skin types, and especially for skin that feels dry, tight or rough. The ceramides and niacinamide support the skin barrier, so it suits daily use all year round.",
      },
      {
        q: "Will it feel greasy?",
        a: "No. It's a lightweight emulsion that absorbs within seconds and leaves a soft, non-greasy finish, so you can get dressed straight after applying it.",
      },
      {
        q: "What does 'Triple Ceramide Complex' mean?",
        a: "Three skin-identical ceramides: Ceramide NP (0.5%), AP (0.2%) and EOP (0.2%), 0.9% in total. Together they replenish the lipids your skin barrier is made of.",
      },
      {
        q: "Does it contain fragrance?",
        a: "Yes, a light one. The fragrance components that labelling rules ask brands to declare (limonene, citronellol, linalool, geraniol and hexyl cinnamal) are listed on the bottle and on our ingredients page.",
      },
      {
        q: "Is it safe for sensitive skin?",
        a: "It's gentle enough for daily use, but because it contains fragrance we recommend a patch test before first use. Apply a little to your inner arm and wait 24 hours.",
      },
      {
        q: "Can I use it on my face?",
        a: "It's formulated as a body lotion, so we recommend keeping it for the body. Avoid contact with the eyes.",
      },
      {
        q: "Can I use it during pregnancy?",
        a: "Please check with your doctor before starting any new skincare during pregnancy or while breastfeeding. You can show them the full ingredient list on our ingredients page.",
      },
      {
        q: "What is the shelf life?",
        a: "24 months from the date of manufacture, printed on each bottle with the batch number. Store it in a cool, dry place away from direct sunlight.",
      },
    ],
  },
  {
    id: "usage",
    title: "Using it",
    items: [
      {
        q: "When should I apply it?",
        a: "Morning and evening, or whenever skin feels dry. It works best straight after a shower, while skin is still slightly damp, because it locks that water in.",
      },
      {
        q: "How much should I use?",
        a: "Two or three pumps cover an arm or a leg. Massage it in with slow circular motions until it's fully absorbed.",
      },
      {
        q: "Can I layer it with other products?",
        a: "Yes. Apply it after any body serums or treatments. During the day, apply sunscreen on top of it on exposed skin.",
      },
    ],
  },
  {
    id: "orders",
    title: "Orders & delivery",
    items: [
      {
        q: "How fast will my order arrive?",
        a: "We dispatch within 24 hours from New Delhi. Delivery usually takes 2 to 4 working days, depending on your PIN code.",
      },
      {
        q: "How much does shipping cost?",
        a: "Shipping is free on orders above ₹999. Below that, a flat ₹79 applies.",
      },
      {
        q: "Which payment methods do you accept?",
        a: "UPI, debit and credit cards, and cash on delivery.",
      },
      {
        q: "How do I track my order?",
        a: "Once your order is dispatched we send a tracking link by email and SMS. If you can't find it, contact us with your order number and we'll share it.",
      },
      {
        q: "Do you ship outside India?",
        a: "Not yet. We currently deliver to PIN codes across India only.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns & refunds",
    items: [
      {
        q: "Can I return a product?",
        a: "Yes. Unopened products in their original packaging can be returned within 14 days of delivery. For hygiene reasons we can't accept opened products.",
      },
      {
        q: "My order arrived damaged. What now?",
        a: "We're sorry. Write to us within 48 hours of delivery with your order number and a photo, and we'll send a replacement at no cost.",
      },
      {
        q: "When will I get my refund?",
        a: "Refunds are issued to your original payment method within 5 to 7 working days of the return reaching us. Cash on delivery orders are refunded by bank transfer or UPI.",
      },
    ],
  },
];
