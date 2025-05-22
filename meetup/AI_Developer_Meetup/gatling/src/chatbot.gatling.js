import {
  simulation,
  scenario,
  exec,
  csv,
  StringBody,
  feed,
  atOnceUsers,
  jsonPath,
  asJson,
} from "@gatling.io/core";
import { http, status } from "@gatling.io/http";

export default simulation((setUp) => {
  const feeder = csv("messages.csv").random();

  const GetHomeandSendMessage = exec(

    http("Get Home")
    .get("/")
    .check(status().is(200)),

    feed(feeder),

    http("Send Message")
      .post("/chat")
      .body(StringBody('{"message": "#{message}", "history": [{"role": "user", "content": "#{message}"}]}'))
      .asJson()
      .check(jsonPath('$.response').exists())
      .check(status().is(200))
  );


  const httpProtocol = http
    .baseUrl("https://organic-panda-smooth.ngrok-free.app")
    .acceptHeader("application/json")
    .userAgentHeader("SamirBrowser");


  const users = scenario("Users").exec(GetHomeandSendMessage);

  setUp(users.injectOpen(atOnceUsers(1))).protocols(httpProtocol);
});
