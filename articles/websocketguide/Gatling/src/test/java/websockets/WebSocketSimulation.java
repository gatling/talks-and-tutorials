package websockets;

import java.util.stream.Collectors;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.http.action.ws.WsInboundMessage;
import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

public class WebSocketSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol =
        http.wsBaseUrl("ws://localhost:8765")
            .wsUnmatchedInboundMessageBufferSize(100);

    ScenarioBuilder scn = scenario("Users")
        .exec(
            ws("Connect").connect("/").await(10).on(
                ws.checkTextMessage("Connect:check")
                    .check(bodyString().is("connected"))
            ),
            ws("Send hello message")
                .sendText("Hello WebSocket!")
                .await(5).on(ws.checkTextMessage("Send hello message:check").check(bodyString().saveAs("message1"))),
            exec(session -> {
                System.out.println("First message received: " + session.getString("message1"));
                return session;
            }),
            during(10).on(
                ws.processUnmatchedMessages((messages, session) -> {
                    if (messages.isEmpty()) {
                        System.out.println("No message received during the last second");
                    } else {
                        var data = messages.stream()
                            .filter(m -> m instanceof WsInboundMessage.Text)
                            .map(m -> ((WsInboundMessage.Text) m).message())
                            .collect(Collectors.joining(", "));
                        System.out.println("Messages received during the last second: " + data);
                    }
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
