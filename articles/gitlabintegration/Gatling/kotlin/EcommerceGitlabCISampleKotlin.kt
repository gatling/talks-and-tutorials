import io.gatling.javaapi.core.*
import io.gatling.javaapi.http.*
import io.gatling.javaapi.core.CoreDsl.*
import io.gatling.javaapi.http.HttpDsl.*

class EcommerceGitlabCISampleKotlin : Simulation() {

    val httpProtocol = http
        .baseUrl("https://ecomm.gatling.io")
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")

    val GetHome = scenario("Ecommerce")
        .exec(http("Get home").get("/"))
    
    init {
        setUp(
            GetHome.injectOpen(atOnceUsers(1))
        ).assertions(
                global().successfulRequests().percent().gt(90.0)
            ).protocols(httpProtocol)
    }
}