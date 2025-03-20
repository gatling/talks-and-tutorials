import {
  simulation,
  scenario,
  atOnceUsers,
  global,
} from "@gatling.io/core";
import { http } from "@gatling.io/http";

export default simulation((setUp) => {

  const httpProtocol = http
    .baseUrl("https://ecomm.gatling.io")

  const GetHome = scenario("Ecommerce").exec(
    http("Get home").get("/")
  );
  setUp(
    GetHome.injectOpen(atOnceUsers(1)),
  ).assertions(
    global().successfulRequests().percent().gt(90.0)
  ).protocols(httpProtocol);
});