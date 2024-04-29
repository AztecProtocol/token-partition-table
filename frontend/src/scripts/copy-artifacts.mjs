import fs from "fs";
import { copyFile } from "fs/promises";

if (!fs.existsSync("src/artifacts")) {
  fs.mkdirSync("src/artifacts");
}

copyFile(
  "../aztec-token-partition-table/src/artifacts/Attestor.ts",
  "src/artifacts/Attestor.ts",
);
copyFile(
  "../aztec-token-partition-table/src/artifacts/Token.ts",
  "src/artifacts/Token.ts",
);
copyFile(
  "../aztec-token-partition-table/src/contracts/target/attestor-Attestor.json",
  "src/artifacts/attestor-Attestor.json",
);
copyFile(
  "../aztec-token-partition-table/src/contracts/target/token-Token.json",
  "src/artifacts/token-Token.json",
);

const updatePath = (fileName) => {
  fs.readFile(fileName, "utf8", function (_, data) {
    let formatted = data.replace(new RegExp("../contracts/target"), ".");

    fs.writeFile(fileName, formatted, "utf8", function (err) {
      if (err) return console.log(err);
    });
  });
};

updatePath("src/artifacts/Attestor.ts");
updatePath("src/artifacts/Token.ts");
