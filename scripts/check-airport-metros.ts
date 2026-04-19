import { metrosMatching } from "@/lib/airportMetros";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

const lon = metrosMatching("lon");
assert(lon.length === 1 && lon[0].iata === "LON", "lon matches London");

const londonCase = metrosMatching("London");
assert(
  londonCase.length === 1 && londonCase[0].iata === "LON",
  "case-insensitive match",
);

const nyc = metrosMatching("NYC");
assert(nyc.length === 1 && nyc[0].iata === "NYC", "IATA code exact match");

const par = metrosMatching("par");
assert(par[0]?.iata === "PAR", "par matches Paris");

const rio = metrosMatching("rio");
assert(rio[0]?.iata === "RIO", "rio matches Rio de Janeiro");

const empty = metrosMatching("z");
assert(empty.length === 0, "too-short query returns empty");

const sto = metrosMatching("stockholm");
assert(
  sto.length === 1 && sto[0].airports.some((a) => a.iata === "ARN"),
  "stockholm includes ARN",
);

console.log("\nAll metro matcher assertions passed.");
