// Forex pairs data
const forexPairs = [
  { value: "EURUSD", label: "EUR/USD", pipLocation: 4, base: "EUR", quote: "USD" },
  { value: "USDJPY", label: "USD/JPY", pipLocation: 2, base: "USD", quote: "JPY" },
  { value: "GBPUSD", label: "GBP/USD", pipLocation: 4, base: "GBP", quote: "USD" },
  { value: "USDCHF", label: "USD/CHF", pipLocation: 4, base: "USD", quote: "CHF" },
  { value: "AUDUSD", label: "AUD/USD", pipLocation: 4, base: "AUD", quote: "USD" },
  { value: "USDCAD", label: "USD/CAD", pipLocation: 4, base: "USD", quote: "CAD" },
  { value: "NZDUSD", label: "NZD/USD", pipLocation: 4, base: "NZD", quote: "USD" },
  { value: "EURGBP", label: "EUR/GBP", pipLocation: 4, base: "EUR", quote: "GBP" },
  { value: "EURJPY", label: "EUR/JPY", pipLocation: 2, base: "EUR", quote: "JPY" },
  { value: "GBPJPY", label: "GBP/JPY", pipLocation: 2, base: "GBP", quote: "JPY" },
];

// Fetch exchange rate for a given currency to USD
async function getExchangeRate(currency = "USD") {
  const cachedRate = localStorage.getItem(`${currency}NgnRate`);
  const cachedTime = localStorage.getItem(`${currency}RateTimestamp`);
  const now = Date.now();
  if (cachedRate && cachedTime && now - cachedTime < 3600000) {
    return parseFloat(cachedRate);
  }
  try {
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/23eaa1d5650316be05fe1720/latest/${currency}`);
    if (response.data.result !== "success") {
      throw new Error(response.data["error-type"] || "API error");
    }
    const rate = response.data.conversion_rates.NGN;
    localStorage.setItem(`${currency}NgnRate`, rate);
    localStorage.setItem(`${currency}RateTimestamp`, now);
    return rate;
  } catch (error) {
    console.error(`Error fetching ${currency}/NGN exchange rate:`, error);
    document.getElementById("error").textContent = `Failed to fetch ${currency}/NGN rate. Using fallback rate (1650 NGN/USD).`;
    document.getElementById("error").classList.remove("hidden");
    return 1650; // Fallback rate
  }
}

// Fetch quote currency to USD rate for non-USD pairs
async function getQuoteToUSDRate(quoteCurrency) {
  if (quoteCurrency === "USD") return 1; // No conversion needed
  const cachedRate = localStorage.getItem(`${quoteCurrency}USDRate`);
  const cachedTime = localStorage.getItem(`${quoteCurrency}USDRateTimestamp`);
  const now = Date.now();
  if (cachedRate && cachedTime && now - cachedTime < 3600000) {
    return parseFloat(cachedRate);
  }
  try {
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/23eaa1d5650316be05fe1720/pair/${quoteCurrency}/USD`);
    if (response.data.result !== "success") {
      throw new Error(response.data["error-type"] || "API error");
    }
    const rate = response.data.conversion_rate;
    localStorage.setItem(`${quoteCurrency}USDRate`, rate);
    localStorage.setItem(`${quoteCurrency}USDRateTimestamp`, now);
    return rate;
  } catch (error) {
    console.error(`Error fetching ${quoteCurrency}/USD exchange rate:`, error);
    document.getElementById("error").textContent = `Failed to fetch ${quoteCurrency}/USD rate. Using fallback rate (1).`;
    document.getElementById("error").classList.remove("hidden");
    return 1; // Fallback rate
  }
}

// Form validation
function validateForm() {
  const errors = {};
  const pair = document.getElementById("pair").value;
  const balance = document.getElementById("balance").value;
  const riskAmount = document.getElementById("risk-amount").value;
  const riskType = document.getElementById("risk-type").value;
  const entryPrice = document.getElementById("entry-price").value;
  const stopLoss = document.getElementById("stop-loss").value;
  const takeProfit = document.getElementById("take-profit").value;

  if (!pair) errors.pair = "Please select a trading pair";
  if (!balance || parseFloat(balance) <= 0) errors.balance = "Please enter a valid account balance";
  if (!riskAmount || parseFloat(riskAmount) <= 0) errors.riskAmount = "Please enter a valid risk amount";
  if (!entryPrice || parseFloat(entryPrice) <= 0) errors.entryPrice = "Please enter a valid entry price";
  if (!stopLoss || parseFloat(stopLoss) <= 0) errors.stopLoss = "Please enter a valid stop loss";
  if (takeProfit && parseFloat(takeProfit) <= 0) errors.takeProfit = "Please enter a valid take profit";
  if (riskType === "percentage" && parseFloat(riskAmount) >= 100) {
    errors.riskAmount = "Risk percentage cannot be 100% or more";
  }
  if (parseFloat(entryPrice) === parseFloat(stopLoss)) {
    errors.stopLoss = "Stop loss cannot be the same as entry price";
  }

  ["pair", "balance", "risk-amount", "entry-price", "stop-loss", "take-profit"].forEach(field => {
    const errorElement = document.getElementById(`${field}-error`);
    errorElement.textContent = errors[field] || "";
    errorElement.classList.toggle("hidden", !errors[field]);
    document.getElementById(field).classList.toggle("border-destructive", !!errors[field]);
  });

  return Object.keys(errors).length === 0;
}

// Calculate lot size
async function calculateLotSize(event) {
  event.preventDefault();
  console.log("Form submitted, preventing default behavior");
  if (!validateForm()) {
    console.log("Validation failed");
    return;
  }
  console.log("Validation passed, proceeding with calculation");

  console.log("Inputs:", {
    balance,
    riskAmount,
    riskType,
    entryPrice,
    stopLoss,
    takeProfit,
    pair,
  });

  const balance = parseFloat(document.getElementById("balance").value);
  const riskAmount = parseFloat(document.getElementById("risk-amount").value);
  const riskType = document.getElementById("risk-type").value;
  const entryPrice = parseFloat(document.getElementById("entry-price").value);
  const stopLoss = parseFloat(document.getElementById("stop-loss").value);
  const takeProfit = parseFloat(document.getElementById("take-profit").value) || 0;
  const pair = document.getElementById("pair").value;

  // Calculate risk amount in NGN
  const riskInNGN = riskType === "percentage" ? (riskAmount / 100) * balance : riskAmount;
  if (riskInNGN > balance) {
    document.getElementById("risk-amount-error").textContent = "Risk amount cannot exceed account balance";
    document.getElementById("risk-amount-error").classList.remove("hidden");
    document.getElementById("risk-amount").classList.add("border-destructive");
    return;
  }

  // Calculate pip difference
  const selectedPair = forexPairs.find(p => p.value === pair);
  const pipLocation = selectedPair?.pipLocation || 4;
  let pipSize = pipLocation === 4 ? 0.0001 : 0.01;
  const stopLossPips = Math.abs(entryPrice - stopLoss) / pipSize;
  if (stopLossPips === 0) {
    document.getElementById("stop-loss-error").textContent = "Stop loss must differ from entry price to calculate pips";
    document.getElementById("stop-loss-error").classList.remove("hidden");
    document.getElementById("stop-loss").classList.add("border-destructive");
    return;
  }
  const takeProfitPips = takeProfit ? Math.abs(takeProfit - entryPrice) / pipSize : 0;

  // Calculate pip value with live exchange rate
  const quoteCurrency = selectedPair.quote;
  const usdNgnRate = await getExchangeRate("USD");
  const lotSizeInQuote = 100000;
  pipSize = selectedPair.pipLocation === 4 ? 0.0001 : 0.01;
  const pipValueInQuote = lotSizeInQuote * pipSize;

  let pipValuePerStandardLot;

  if (quoteCurrency === "USD") {
    pipValuePerStandardLot = 10;
  } else {
    const quoteToUSDRate = await getQuoteToUSDRate(quoteCurrency);
    if (quoteToUSDRate) {
      pipValuePerStandardLot = (pipValueInQuote / entryPrice) * quoteToUSDRate;
    } else {
      pipValuePerStandardLot = (pipValueInQuote / entryPrice) * 1;
    }
  }


  const pipValueNaira = pipValuePerStandardLot * usdNgnRate;

  console.log("Calculated values:", {
    stopLossPips,
    pipValuePerStandardLot,
    pipValueNaira,
    lotSize,
    pipValue,
    potentialProfit,
    potentialLoss,
  });

  // Calculate lot size
  const lotSize = riskInNGN / (stopLossPips * pipValueNaira);
  const pipValue = lotSize * pipValueNaira;
  const potentialProfit = takeProfitPips ? pipValue * takeProfitPips : 0;
  const potentialLoss = pipValue * stopLossPips;

  // Update results
  document.getElementById("lot-size").textContent = lotSize.toFixed(2);
  document.getElementById("pip-value").textContent = `₦${pipValue.toLocaleString()}`;
  document.getElementById("potential-profit").textContent = takeProfitPips ? `₦${potentialProfit.toLocaleString()}` : "N/A";
  document.getElementById("potential-loss").textContent = `₦${potentialLoss.toLocaleString()}`;
  document.getElementById("risk-amount-result").textContent = `₦${riskInNGN.toLocaleString()}`;

  // Show results, hide placeholder
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("no-results").classList.add("hidden");
  document.getElementById("error").classList.add("hidden");
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
}

// Event listener for form submission
document.getElementById("lot-size-form").addEventListener("submit", calculateLotSize);

// Reset button
document.getElementById("reset-btn").addEventListener("click", () => {
  document.getElementById("lot-size-form").reset();
  document.getElementById("results").classList.add("hidden");
  document.getElementById("no-results").classList.remove("hidden");
  document.getElementById("error").classList.add("hidden");
  ["pair", "balance", "risk-amount", "entry-price", "stop-loss", "take-profit"].forEach(field => {
    document.getElementById(`${field}-error`).classList.add("hidden");
    document.getElementById(field).classList.remove("border-destructive");
  });
});