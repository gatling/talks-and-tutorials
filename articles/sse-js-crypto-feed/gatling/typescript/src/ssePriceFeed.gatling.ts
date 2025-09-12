import {
  simulation,
  scenario,
  constantUsersPerSec,
  atOnceUsers,
  rampUsers,
  pause,
  jmesPath,
  getParameter,
} from "@gatling.io/core";
import { http, sse } from "@gatling.io/http";

// --- Parameters & Constants ---
const BASE_URL = getParameter("baseUrl", "http://localhost:3000");
const PRICE_MIN = 0;
const PRICE_MAX = 1_000_000;

// User profile parameters
const QUICK_AT_ONCE = parseInt(getParameter("quickAtOnce", "10"), 10);
const QUICK_RAMP = parseInt(getParameter("quickRamp", "50"), 10);
const QUICK_RAMP_DURATION = parseInt(getParameter("quickRampDuration", "60"), 10);
const QUICK_CONSTANT_RATE = parseFloat(getParameter("quickConstantRate", "2"));
const QUICK_CONSTANT_DURATION = parseInt(getParameter("quickConstantDuration", "300"), 10);

const ACTIVE_RAMP = parseInt(getParameter("activeRamp", "20"), 10);
const ACTIVE_RAMP_DURATION = parseInt(getParameter("activeRampDuration", "120"), 10);
const ACTIVE_CONSTANT_RATE = parseFloat(getParameter("activeConstantRate", "0.5"));
const ACTIVE_CONSTANT_DURATION = parseInt(getParameter("activeConstantDuration", "300"), 10);

const MONITOR_AT_ONCE = parseInt(getParameter("monitorAtOnce", "5"), 10);
const MONITOR_RAMP = parseInt(getParameter("monitorRamp", "5"), 10);
const MONITOR_RAMP_DURATION = parseInt(getParameter("monitorRampDuration", "300"), 10);

// --- Protocol ---
const httpProtocol = http.baseUrl(BASE_URL);

// --- Reusable SSE Check ---
const priceUpdateCheck = sse.checkMessage("price-update")
  .matching(jmesPath("event").is("price-update"))
  .check(
    jmesPath("data").exists(),
    jmesPath("data").transform(raw => {
      const price = JSON.parse(raw).price;
      return price > PRICE_MIN && price < PRICE_MAX;
    }),
  );

// --- Scenarios ---
const quickChecker = scenario("QuickPriceChecker")
  .exec(
    sse("Prices").get("/prices")
      .await(10).on(priceUpdateCheck),
    pause(2, 8),
    sse("Prices").close()
  );

const activeTrader = scenario("ActiveTrader")
  .exec(
    sse("Prices").get("/prices")
      .await(30).on(priceUpdateCheck),
    pause(25, 35),
    sse("Prices").close()
  );

const longTermMonitor = scenario("LongTermMonitor")
  .exec(
    sse("Prices").get("/prices")
      .await(300).on(priceUpdateCheck),
    pause(280, 320),
    sse("Prices").close()
  );

// --- Simulation Setup ---
export default simulation((setUp) => {
  setUp(
    quickChecker.injectOpen(
      atOnceUsers(QUICK_AT_ONCE),
      rampUsers(QUICK_RAMP).during(QUICK_RAMP_DURATION),
      constantUsersPerSec(QUICK_CONSTANT_RATE).during(QUICK_CONSTANT_DURATION)
    ),
    activeTrader.injectOpen(
      rampUsers(ACTIVE_RAMP).during(ACTIVE_RAMP_DURATION),
      constantUsersPerSec(ACTIVE_CONSTANT_RATE).during(ACTIVE_CONSTANT_DURATION)
    ),
    longTermMonitor.injectOpen(
      atOnceUsers(MONITOR_AT_ONCE),
      rampUsers(MONITOR_RAMP).during(MONITOR_RAMP_DURATION)
    )
  ).protocols(httpProtocol);
});
