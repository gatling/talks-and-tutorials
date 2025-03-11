package ecommerce;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

public class EcommerceGithubActionSampleJava extends Simulation {

  HttpProtocolBuilder httpProtocol =
    http.baseUrl("https://ecomm.gatling.io")
      .acceptHeader("application/json")
      .contentTypeHeader("application/json");

  ScenarioBuilder GetHome = scenario("Ecommerce")
    .exec(http("Get home")
      .get("/"));

  {
    setUp(
      GetHome.injectOpen(atOnceUsers(1))
    ).assertions(
      global().successfulRequests().percent().gt(90.0)
    ).protocols(httpProtocol);
  }
}
