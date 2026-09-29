import type { InvoiceLabels } from "./invoice-labels";

/**
 * The invoice's labels in Burmese (Myanmar script, Unicode — never Zawgyi), written by hand (wave 2 of decision 0187).
 * Never a machine translation.
 *
 * For Myanmar businesses and Myanmar workers abroad (Thailand):
 *
 *  - **ငွေတောင်းခံလွှာ** for invoice and **ဈေးနှုန်းတင်ပြလွှာ** (quotation) for an estimate — the machine row said
 *    "ခန့်မှန်းချက်", a guess.
 *  - **ထုတ်ပေးသူ** (issuer) / **ဖောက်သည်** (customer) for the two parties.
 *  - **အခွန်**, the generic tax: the seller's own tax name (commercial tax …) is printed on each line.
 *  - **ခွဲစုစုပေါင်း** / **စုစုပေါင်း** for subtotal / total, **ပေးရန်ကျန်ငွေ** for the balance due (native-check question).
 *  - Spelling ဈေး, not the older စျေး. Western digits and the app's own `1,234.50` (Myanmar digits ၁၂၃ are a
 *    native-check question); dates are numeric day-first, `29/09/2026`.
 *
 * Keys are exactly `InvoiceLabels` minus the French-only `totalWithTax`.
 */
export const MY_LABELS: Required<Omit<InvoiceLabels, "totalWithTax">> = {
  invoice: "ငွေတောင်းခံလွှာ",
  from: "ထုတ်ပေးသူ",
  billTo: "ဖောက်သည်",
  invoiceDetails: "ငွေတောင်းခံလွှာ အသေးစိတ်",
  invoiceNo: "ငွေတောင်းခံလွှာ အမှတ်",
  issueDate: "ထုတ်ပေးသည့်ရက်",
  dueDate: "ပေးရမည့်ရက်",
  poNo: "အော်ဒါ အမှတ်",
  phone: "ဖုန်း",
  email: "အီးမေးလ်",
  colSn: "စဉ်",
  colDescription: "ဖော်ပြချက်",
  colQty: "အရေအတွက်",
  colPrice: "ဈေးနှုန်း",
  colDisc: "လျှော့ဈေး",
  colTax: "အခွန်",
  colAmount: "ကျသင့်ငွေ",
  subTotal: "ခွဲစုစုပေါင်း",
  discount: "လျှော့ဈေး",
  tax: "အခွန်",
  shipping: "ပို့ဆောင်ခ",
  total: "စုစုပေါင်း",
  amountPaid: "ပေးချေပြီးငွေ",
  balanceDue: "ပေးရန်ကျန်ငွေ",
  notes: "မှတ်ချက်များ",
  terms: "စည်းကမ်းနှင့် သတ်မှတ်ချက်များ",
  paymentInstructions: "ငွေပေးချေရန် ညွှန်ကြားချက်များ",
  authorizedSignature: "လက်မှတ်",
  footerGenerated: "Invotick ဖြင့် ပြုလုပ်ထားသော ငွေတောင်းခံလွှာ",
  footerTagline: "ပရော်ဖက်ရှင်နယ် ငွေတောင်းခံလွှာများကို စက္ကန့်ပိုင်းအတွင်း ဖန်တီးပါ",
  footerScan: "Invotick ဒေါင်းလုဒ်ဆွဲရန် စကင်ဖတ်ပါ",
  footerContact: "ဆက်သွယ်ရန်",
};

/** Only what an estimate says differently — merged over [MY_LABELS]. */
export const MY_ESTIMATE_LABELS: Partial<InvoiceLabels> = {
  invoice: "ဈေးနှုန်းတင်ပြလွှာ",
  invoiceDetails: "ဈေးနှုန်းတင်ပြလွှာ အသေးစိတ်",
  invoiceNo: "တင်ပြလွှာ အမှတ်",
  dueDate: "သက်တမ်းကုန်ရက်",
  footerGenerated: "Invotick ဖြင့် ပြုလုပ်ထားသော ဈေးနှုန်းတင်ပြလွှာ",
};
