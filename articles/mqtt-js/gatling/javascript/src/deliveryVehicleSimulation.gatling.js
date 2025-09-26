import {
  StringBody,
  atOnceUsers,
  details,
  exec,
  getParameter,
  jmesPath,
  rampUsers,
  scenario,
  simulation
} from "@gatling.io/core";
import { mqtt } from "@gatling.io/mqtt";

export default simulation((setUp) => {
  const requestedProfile = getParameter("loadProfile", "ramp").toLowerCase();
  const supportedProfiles = new Set(["ramp", "spike", "steady", "soak", "smoke"]);
  const profileKey = supportedProfiles.has(requestedProfile) ? requestedProfile : "ramp";
  const telemetryIntervalMs = Math.max(50, parseInt(getParameter("telemetryIntervalMs", "1000"), 10));

  const profileCatalog = {
    ramp: {
      deviceCount: 5000,
      durationSeconds: 10 * 60,
      steps: (count) => [rampUsers(count).during({ amount: 10, unit: "minutes" })]
    },
    spike: {
      deviceCount: 2000,
      durationSeconds: 10 * 60,
      steps: (count) => [rampUsers(count).during({ amount: 30, unit: "seconds" })]
    },
    steady: {
      deviceCount: 3000,
      durationSeconds: 30 * 60,
      steps: (count) => [atOnceUsers(count)]
    },
    soak: {
      deviceCount: 1000,
      durationSeconds: 2 * 60 * 60,
      steps: (count) => [atOnceUsers(count)]
    },
    smoke: {
      deviceCount: 2,
      durationSeconds: 2 * 60,
      steps: (_count) => [atOnceUsers(2)]
    }
  };

  const defaultProfile = profileCatalog[profileKey];
  const deviceCount = Math.max(1, parseInt(getParameter("deviceCount", defaultProfile.deviceCount.toString()), 10));
  const telemetryDurationSeconds = Math.max(
    1,
    parseInt(getParameter("telemetryDurationSeconds", defaultProfile.durationSeconds.toString()), 10)
  );

  const brokerHost = getParameter("brokerHost", "broker.hivemq.com");
  const brokerPort = parseInt(getParameter("brokerPort", "8883"), 10);
  const useTls = getParameter("brokerTls", "true") === "true";
  const engineStatusParam = getParameter("engineStatus", "idle").toLowerCase();
  const topicParameter = getParameter("topic", "");
  const uuidExpression = StringBody("#{randomUuid()}");
  const updateInterval = { amount: telemetryIntervalMs, unit: "milliseconds" };
  const updateIterations = Math.max(1, Math.floor((telemetryDurationSeconds * 1000) / telemetryIntervalMs));
  const baseLat = parseFloat(getParameter("baseLat", "37.7749"));
  const baseLng = parseFloat(getParameter("baseLng", "-122.4194"));
  const spawnRadius = parseFloat(getParameter("spawnRadius", "0.05"));
  const movementStep = parseFloat(getParameter("movementStep", "0.005"));
  const startingFuel = parseFloat(getParameter("startingFuel", "95"));
  const minimumFuel = parseFloat(getParameter("minimumFuel", "15"));

  const nextOffset = (radius) => (Math.random() - 0.5) * 2 * radius;

  const mqttProtocol = mqtt
    .broker(brokerHost, brokerPort)
    .correlateBy(jmesPath("vehicleId"))
    .useTls(useTls);

  const scn = scenario(`Telemetry-${profileKey}`)
    .exec((session) => {
      const vehicleId = uuidExpression(session);
      const topic = topicParameter || `fleet/${vehicleId}/telemetry`;
      const initialLat = baseLat + nextOffset(spawnRadius);
      const initialLng = baseLng + nextOffset(spawnRadius);

      return session
        .set("vehicleId", vehicleId)
        .set("engineStatus", engineStatusParam)
        .set("topic", topic)
        .set("lat", Number(initialLat.toFixed(6)))
        .set("lng", Number(initialLng.toFixed(6)))
        .set("fuelLevel", startingFuel)
        .set("reportedAt", new Date().toISOString());
    })
    .exec(mqtt("Connect vehicle").connect())
    .repeat(updateIterations, "updateIndex")
    .on(
      exec((session) => {
        const currentLat = session.get("lat");
        const currentLng = session.get("lng");
        const currentFuel = session.get("fuelLevel");
        const updatedLat = currentLat + nextOffset(movementStep);
        const updatedLng = currentLng + nextOffset(movementStep);
        const newFuelLevel = Math.max(minimumFuel, currentFuel - Math.random() * 0.8);

        return session
          .set("lat", Number(updatedLat.toFixed(6)))
          .set("lng", Number(updatedLng.toFixed(6)))
          .set("fuelLevel", Number(newFuelLevel.toFixed(2)))
          .set("reportedAt", new Date().toISOString());
      })
        .exec(
          mqtt("Publish telemetry")
            .publish("#{topic}")
            .message(
              StringBody(
                '{"vehicleId":"#{vehicleId}","lat":#{lat},"lng":#{lng},"ts":"#{reportedAt}","fuelLevel":#{fuelLevel},"engineStatus":"#{engineStatus}"}'
              )
            )
        )
        .pause(updateInterval)
    );

  const injectionSteps = defaultProfile.steps(deviceCount);

  setUp(scn.injectOpen(...injectionSteps))
    .protocols(mqttProtocol)
    .assertions(
      details("Connect vehicle").successfulRequests().percent().gte(99),
      details("Publish telemetry").responseTime().percentile(95).lt(200),
      details("Publish telemetry").failedRequests().percent().lt(0.1)
    );
});
