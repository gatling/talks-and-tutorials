package io.gatling.grpc.qdrant;


import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.grpc.GrpcProtocolBuilder;
import io.grpc.Status;
import qdrant.*;
import qdrant.Collections;


import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.grpc.GrpcDsl.*;

public class CollectionSimulation extends Simulation {

    GrpcProtocolBuilder baseGrpcProtocol = grpc.forAddress(System.getProperty("url"), 6334)
            .asciiHeader("api-key").value(System.getProperty("api-key"));

    ScenarioBuilder CollectionsOpti = scenario("LoadTest Collections")
            .exec( session -> {
                        session = session.set("compteur", 0);
                        return session;
                    }
            ).asLongAs(session -> session.get("stop") == null || session.get("stop") == Status.Code.OK).on(
                    exec(
                            grpc("Create a collection")
                                    .unary(CollectionsGrpc.getCreateMethod())
                                    .send(session -> Collections.CreateCollection.newBuilder()
                                            .setCollectionName("test" + session.getInt("compteur"))
                                            .setOnDiskPayload(true)
                                            .setHnswConfig(
                                                    Collections.HnswConfigDiff.newBuilder()
                                                            .setM(0)
                                                            .build()
                                            ).setQuantizationConfig(
                                                    Collections.QuantizationConfig.newBuilder()
                                                            .setBinary(Collections.BinaryQuantization.newBuilder()
                                                                    .setAlwaysRam(true)
                                                                    .build())
                                                            .build()
                                            )
                                            .setVectorsConfig(Collections.VectorsConfig.newBuilder().
                                                    setParams(Collections.VectorParams.newBuilder()
                                                            .setSize(512)
                                                            .setOnDisk(true)
                                                            .setDistance(Collections.Distance.Cosine)
                                                            .build())
                                                    .build())
                                            .build())
                                    .check(
                                            response(Collections.CollectionOperationResponse::getResult).is(true),
                                            statusCode().saveAs("stop")
                                    ))
                            .exec(
                                    session -> {
                                        session = session.set("compteur", session.getInt("compteur") + 1);
                                        return session;
                                    }
                            )
            );

    ScenarioBuilder CollectionsNotOpti = scenario("LoadTest Collections")
            .exec( session -> {
                        session = session.set("compteur", 0);
                        return session;
                    }
            ).asLongAs(session -> session.get("stop") == null || session.get("stop") == Status.Code.OK).on(
                    exec(
                            grpc("Create a collection")
                                    .unary(CollectionsGrpc.getCreateMethod())
                                    .send(session -> Collections.CreateCollection.newBuilder()
                                            .setCollectionName("test" + session.getInt("compteur"))
                                            .setVectorsConfig(Collections.VectorsConfig.newBuilder().
                                                    setParams(Collections.VectorParams.newBuilder()
                                                            .setSize(512)
                                                            .setDistance(Collections.Distance.Cosine)
                                                            .build())
                                                    .build())
                                            .build())
                                    .check(
                                            response(Collections.CollectionOperationResponse::getResult).is(true),
                                            statusCode().saveAs("stop")
                                    ))
                            .exec(
                                    session -> {
                                        session = session.set("compteur", session.getInt("compteur") + 1);
                                        return session;
                                    }
                            )
            );



    {
        String name = System.getProperty("scenario");
        System.out.println("Scenario name: " + name);
        ScenarioBuilder scn;
        if (name == null || name.equals("notopti")) {
            scn = CollectionsNotOpti;
        } else {

            scn = CollectionsOpti;

        }

        setUp(scn.injectOpen(atOnceUsers(1))).protocols(baseGrpcProtocol);
    }
}
