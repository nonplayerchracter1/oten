// scripts/hashPassword.js
const bcrypt = require("bcrypt");

async function hashPassword(password) {
  const saltRounds = 12;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);

  // Verify the hash
  const isValid = await bcrypt.compare(password, hash);
  console.log(`Verification: ${isValid ? "✓" : "✗"}`);

  return hash;
}

// Hash your admin passwords
hashPassword("admin123").then((hash) => {
  console.log("\nUse this hash in your SQL:");
  console.log(hash);
});
