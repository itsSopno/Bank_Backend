import crypto from "crypto";

/**
 * ১০ ডিজিটের ইউনিক ব্যাংক অ্যাকাউন্ট নম্বর তৈরি করে (e.g. "1008492015")
 */
export const generateAccountNumber = (): string => {
  const bankPrefix = "100"; // ব্যাংকের স্পেসিফিক প্রিফিক্স
  const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `${bankPrefix}${randomDigits}`;
};

/**
 * প্রফেশনাল ইউনিক Transaction ID তৈরি করে (e.g. "TXN-20261120-A9F3C")
 */
export const generateTransactionId = (): string => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TXN-${today}-${randomHex}`;
};

/**
 * ইউনিক Loan Application ID তৈরি করে (e.g. "LN-20261120-4K91")
 */
export const generateLoanId = (): string => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomHex = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LN-${today}-${randomHex}`;
};

/**
 * ব্যাংকিং স্ট্যান্ডার্ড EMI (Equated Monthly Installment) হিসাব করে
 * @param principal - লোনের মোট টাকার পরিমাণ
 * @param annualRatePercent - বাৎসরিক সুদের হার (e.g. 8.5%)
 * @param durationMonths - মোট মাসের সংখ্যা (e.g. 12 or 24)
 * @returns প্রতি মাসের কিস্তির পরিমাণ (২ দশমিক স্থান পর্যন্ত)
 */
export const calculateLoanEMI = (
  principal: number,
  annualRatePercent: number,
  durationMonths: number
): number => {
  if (annualRatePercent === 0) {
    return Number((principal / durationMonths).toFixed(2));
  }

  const monthlyRate = annualRatePercent / 12 / 100;
  const emi =
    (principal *
      monthlyRate *
      Math.pow(1 + monthlyRate, durationMonths)) /
    (Math.pow(1 + monthlyRate, durationMonths) - 1);

  return Number(emi.toFixed(2));
};
