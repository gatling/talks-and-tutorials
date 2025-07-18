
# Github Integration

This GitHub repository hosts the Gatling simulation and websocket server that we showcased on the [How to load test WebSocket](https://docs.gatling.io/guides/complex-use-cases/websocket/) article.


## Prerequisites

- JDK 11+ and Maven
- Node.js and npm, to run the example server

## Run example

Server, in the `server` folder:

```shell
npm install
npm run start
```

Gatling simulation, in the `gatling` folder:

```shell
mvn gatling:test
```

## To Go Further

* [Gatling Website](https://gatling.io/)

## Support

If you encounter any issues or have questions, please open an issue on this repository.
