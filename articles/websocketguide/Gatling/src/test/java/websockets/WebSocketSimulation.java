package websockets;

import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.http.action.ws.WsInboundMessage;
import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

public class WebSocketSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol =
        http.wsBaseUrl("ws://localhost:8765")
            .wsUnmatchedInboundMessageBufferSize(1024);

    ScenarioBuilder scn = scenario("Users")
        .exec(
            ws("Connect").connect("/").await(10).on(
                ws.checkTextMessage("Connect:check")
                    .check(bodyString().is("connected"))
            ),
            during(20).on(
                ws.processUnmatchedMessages((messages, session) -> {
                    var data = messages.stream()
                        .filter(m -> m instanceof WsInboundMessage.Text)
                        .map(m -> ((WsInboundMessage.Text) m).message())
                        .collect(Collectors.joining(", "));
                    System.out.println("messages received last second: " + data);
                    return session;
                }),
                pause(1)
            ),
            ws("Close").close()
        );

    {
        setUp(
            scn.injectOpen(atOnceUsers(1))
        ).protocols(httpProtocol);
    }
}
