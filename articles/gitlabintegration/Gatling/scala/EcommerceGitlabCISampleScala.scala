import io.gatling.core.scenario.Simulation
import io.gatling.core.Predef._
import io.gatling.http.Predef._

class EcommerceGitlabCISampleScala extends Simulation {

  val httpProtocol = http
    .baseUrl("https://ecomm.gatling.io")
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  val GetHome = scenario("Ecommerce")
    .exec(http("Get home").get("/"))

  setUp(
  GetHome.inject(atOnceUsers(1))
).assertions(
  global.successfulRequests.percent.gt(90.0)
).protocols(httpProtocol)
}