package io.gatling.grpc.qdrant;


import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.grpc.GrpcProtocolBuilder;
import io.grpc.Status;
import qdrant.JsonWithInt;
import qdrant.Points;
import qdrant.PointsGrpc;

import java.util.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.grpc.GrpcDsl.*;

public class QuerySimulation extends Simulation {

    GrpcProtocolBuilder baseGrpcProtocol = grpc.forAddress(System.getProperty("url"), 6334)
            .asciiHeader("api-key").value(System.getProperty("api-key"));


    ScenarioBuilder Query = scenario("Query")
            .exec(session -> {
                session = session.set("collectionName", "test0");
                return session;
            }).exec(
                    grpc("Query points without filter")
                            .unary(PointsGrpc.getScrollMethod())
                            .send(session -> Points.ScrollPoints.newBuilder()
                                    .setCollectionName(session.getString("collectionName"))
                                    .setLimit(100)
                                    .build())
                            .check(
                                    response(Points.ScrollResponse::getResultList)
                                            .transform(resultList -> resultList.stream()
                                                    .allMatch(point -> {
                                                        Map<String, qdrant.JsonWithInt.Value> payload = point.getPayloadMap();
                                                        return payload.get("city").hasStringValue();
                                                    }))
                                            .is(true)
                            )



            ).exec(
                    grpc("Query Points with filter ")
                            .unary(PointsGrpc.getScrollMethod())
                            .send(
                                    session -> Points.ScrollPoints.newBuilder()
                                            .setCollectionName(session.getString("collectionName"))
                                            .setLimit(100)
                                            .setFilter(Points.Filter.newBuilder()
                                                    .addMust(Points.Condition.newBuilder()
                                                            .setField(Points.FieldCondition.newBuilder()
                                                                    .setKey("city")
                                                                    .setMatch(Points.Match.newBuilder()
                                                                            .setKeyword("Paris")
                                                                            .build())
                                                                    .build())
                                                            .build())
                                                    .build())
                                            .build()
                            )
                            .check(
                                    response(Points.ScrollResponse::getResultList)
                                            .transform(resultList -> resultList.stream()
                                                    .allMatch(point -> {
                                                        Map<String, qdrant.JsonWithInt.Value> payload = point.getPayloadMap();
                                                        return payload.get("city").getStringValue().equals("Paris");
                                                    }))
                                            .is(true)
                            )
            );




    {

        setUp(Query.injectOpen(atOnceUsers(1))).protocols(baseGrpcProtocol);
    }
}
