require("dotenv").config();

const { getSafepayConfigurationErrors } = require("../src/services/safepay");

const errors = getSafepayConfigurationErrors();
if (errors.length) {
  console.error("Safepay subscription checkout is not ready:");
  for (const error of errors) console.error(`- ${error}`);
  console.error("\nSet these values in backend/.env. Never share or commit merchant or webhook secrets.");
  process.exitCode = 1;
} else {
  console.log(`Safepay ${process.env.SAFEPAY_ENV || "sandbox"} subscription configuration looks complete.`);
  console.log("This check validates configuration format only; verify the checkout and webhook using Safepay sandbox.");
}
