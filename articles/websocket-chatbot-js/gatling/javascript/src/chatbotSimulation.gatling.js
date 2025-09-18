/**
 * Gatling simulation script for load testing a WebSocket-based chatbot application.
 *
 * @module chatbotSimulation.gatling
 */

import {
  simulation,
  constantUsersPerSec,
  scenario,
  feed,
  pause,
  exec,
  repeat,
  regex,
  csv,
  getParameter,
} from "@gatling.io/core";
import { http, ws } from "@gatling.io/http";

/**
 * Main Gatling simulation definition.
 */
export default simulation((setUp) => {
  
  const baseUrl = getParameter("baseUrl", "http://localhost:3000");
  const wsBaseUrl = getParameter("wsBaseUrl", "ws://localhost:3000");
  const usersPerSec = parseInt(getParameter("usersPerSec", "2"));
  const durationSeconds = parseInt(getParameter("durationSeconds", "15"));
  const questionsFeeder = csv("resources/health_insurance_chatbot_questions.csv").random();
  const httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    .doNotTrackHeader("1")
    .acceptLanguageHeader("en-US,en;q=0.5")
    .acceptEncodingHeader("gzip, deflate")
    .userAgentHeader("Gatling2")
    .wsBaseUrl(wsBaseUrl);

  /**
   * @constant {ScenarioBuilder} scn - Scenario definition for WebSocket interaction.
   */
  const scn = scenario("WebSocket")
    .exec(
      /**
       * Sends an HTTP GET request to the home page.
       */
      http("Home").get("/"),
      pause(1),
      /**
       * Sets a unique user ID in the session.
       *
       * @param {Session} session - The Gatling session object.
       * @returns {Session} The updated session.
       */
      exec((session) => session.set("id", "Gatling" + session.userId())),
      
      ws("Connect WS").connect("/"),
      
      pause(1),
      /**
       * Determines a random number of customer questions for this session.
       *
       * @param {Session} session - The Gatling session object.
       * @returns {Session} The updated session with a random question count.
       */
      exec((session) =>
        session.set("maxQuestions", Math.floor(Math.random() * 10) + 1),
      ),
      /**
       * Repeats sending customer questions and awaiting chatbot responses.
       *
       * @param {number} i - The iteration index.
       */
      repeat((session) => session.get("maxQuestions"), "i").on(
        feed(questionsFeeder),
        /**
         * Sends a user question over WebSocket and awaits a response.
         */
        ws("Customer Question")
          .sendText((session) => session.get("user_question"))
          .await(30).on(
            /**
             * Checks for a chatbot response message matching any text.
             */
            ws.checkTextMessage("Chatbot Response").check(regex("(.*)")),
          ),
      ),
      
      pause(1),
      
      ws("Close WS").close(),
    );
  /**
   * Sets up the scenario with the specified injection profile and protocol.
   */
  setUp(
    scn.injectOpen(constantUsersPerSec(usersPerSec).during(durationSeconds)),
  ).protocols(httpProtocol);
});
